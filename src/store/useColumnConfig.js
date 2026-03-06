import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { MARKETING_SEED_CONFIG, PRODUCT_SEED_CONFIG } from './useConfig'

const CC_STORAGE_KEY = 'growth_column_configs_v1'
const SAVE_DEBOUNCE_MS = 500

/* ──────────────────────────────────────────
   columnConfig 전용 훅
   — dashboard_config와 완전 독립
   — Supabase `column_configs` 테이블 사용
─────────────────────────────────────────── */

const SEED_CONFIGS = {
  marketing_data: MARKETING_SEED_CONFIG,
  product_revenue_raw: PRODUCT_SEED_CONFIG,
}

/** localStorage에서 캐시된 columnConfig 로드 */
function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(CC_STORAGE_KEY) || '{}')
  } catch { return {} }
}

/** localStorage에 columnConfig 캐시 저장 */
function saveLocal(cc) {
  try { localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(cc)) } catch {}
}

/**
 * 시드 config 적용: 키가 없거나 columns가 비어있으면 시드로 채움
 * @returns {object} { merged, changed }
 */
function applySeed(cc) {
  let merged = { ...cc }
  let changed = false

  for (const [tableName, seed] of Object.entries(SEED_CONFIGS)) {
    const existing = merged[tableName]
    if (!existing || !existing.columns || Object.keys(existing.columns).length === 0) {
      merged[tableName] = { ...seed }
      changed = true
    }
  }

  return { merged, changed }
}

export function useColumnConfig() {
  const [columnConfig, _setColumnConfig] = useState(() => {
    const local = loadLocal()
    const { merged } = applySeed(local)
    return merged
  })

  const latestRef = useRef(columnConfig)
  const saveTimers = useRef({})          // 테이블별 디바운스 타이머
  const lastPersistTs = useRef({})       // 테이블별 자기 에코 방지 타임스탬프
  const migrationDone = useRef(false)

  useEffect(() => { latestRef.current = columnConfig }, [columnConfig])

  /* ── Supabase: 초기 로드 ── */
  useEffect(() => {
    if (!supabase) return
    ;(async () => {
      const { data, error } = await supabase
        .from('column_configs')
        .select('table_name, config')

      if (error) {
        console.warn('[useColumnConfig] DB 조회 실패:', error.message)
        // DB 실패 시 — 기존 dashboard_config에서 마이그레이션 시도
        if (!migrationDone.current) {
          migrationDone.current = true
          await migrateFromDashboardConfig()
        }
        return
      }

      if (data && data.length > 0) {
        // DB에 데이터 있음 → state에 반영
        const remote = {}
        data.forEach(row => { remote[row.table_name] = row.config })
        const { merged } = applySeed(remote)
        _setColumnConfig(merged)
        saveLocal(merged)
      } else {
        // DB에 데이터 없음 → 마이그레이션 또는 시드 업로드
        if (!migrationDone.current) {
          migrationDone.current = true
          await migrateFromDashboardConfig()
        }
      }
    })()
  }, [])

  /** dashboard_config.config.columnConfig에서 1회성 마이그레이션 */
  async function migrateFromDashboardConfig() {
    if (!supabase) return

    // 1) 기존 dashboard_config에서 columnConfig 꺼내기
    const { data: dashRow } = await supabase
      .from('dashboard_config')
      .select('config')
      .eq('id', 'default')
      .maybeSingle()

    const oldCc = dashRow?.config?.columnConfig
    let toUpload = {}

    if (oldCc && Object.keys(oldCc).length > 0) {
      // 기존 데이터 있음 → 마이그레이션
      toUpload = { ...oldCc }
    }

    // 시드 적용
    const { merged } = applySeed(toUpload)
    toUpload = merged

    // 2) column_configs 테이블에 일괄 INSERT
    const rows = Object.entries(toUpload).map(([table_name, config]) => ({
      table_name,
      config,
      updated_at: new Date().toISOString(),
    }))

    if (rows.length > 0) {
      const { error } = await supabase
        .from('column_configs')
        .upsert(rows, { onConflict: 'table_name' })

      if (error) {
        console.warn('[useColumnConfig] 마이그레이션 실패:', error.message)
      }
    }

    _setColumnConfig(toUpload)
    saveLocal(toUpload)
  }

  /* ── Supabase: Realtime 구독 ── */
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('column-config-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'column_configs' },
        (payload) => {
          const tableName = payload.new?.table_name
          if (!tableName) return

          // 자기 에코 방지: 최근 3초 이내에 내가 저장한 테이블이면 무시
          if (Date.now() - (lastPersistTs.current[tableName] || 0) < 3000) return

          const remoteConfig = payload.new?.config
          if (!remoteConfig) return

          _setColumnConfig(prev => {
            const next = { ...prev, [tableName]: remoteConfig }
            saveLocal(next)
            return next
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  /* ── cleanup ── */
  useEffect(() => () => {
    Object.values(saveTimers.current).forEach(clearTimeout)
  }, [])

  /* ── getColumnConfig ── */
  const getColumnConfig = useCallback((tableName) => {
    return latestRef.current[tableName] || { columns: {}, computed: [], dimensionColumns: [] }
  }, [])

  /* ── setColumnConfig ── */
  const setColumnConfig = useCallback((tableName, tableConfig) => {
    _setColumnConfig(prev => {
      const next = { ...prev, [tableName]: tableConfig }
      saveLocal(next)
      latestRef.current = next
      return next
    })

    // Supabase 디바운스 저장 (테이블별 독립)
    if (supabase) {
      clearTimeout(saveTimers.current[tableName])
      saveTimers.current[tableName] = setTimeout(() => {
        lastPersistTs.current[tableName] = Date.now()
        supabase
          .from('column_configs')
          .upsert({
            table_name: tableName,
            config: latestRef.current[tableName],
            updated_at: new Date().toISOString(),
          }, { onConflict: 'table_name' })
          .then(({ error }) => {
            if (error) console.warn('[useColumnConfig] DB 저장 실패:', error.message)
          })
      }, SAVE_DEBOUNCE_MS)
    }
  }, [])

  return {
    columnConfig,       // 전체 맵: { tableName: { columns, dimensionColumns, computed, displayName } }
    getColumnConfig,
    setColumnConfig,
  }
}
