import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const CC_STORAGE_KEY = 'growth_column_configs_v2'
const WMC_SAVE_DEBOUNCE_MS = 500

/* ──────────────────────────────────────────
   column_definitions DB 테이블 → columnConfig 변환
   — column_definitions: 읽기 전용 (컬럼/지표 정의)
   — column_configs: widgetMetricConfig만 저장 (위젯 표시 설정)
─────────────────────────────────────────── */

/** column_definitions rows → columnConfig 형태 변환 */
function transformRows(defRows, metaRows) {
  const result = {}

  // table_metadata → { tableName: { display_name, date_column } }
  const metaMap = {}
  ;(metaRows || []).forEach(r => {
    metaMap[r.table_name] = { displayName: r.display_name, dateColumn: r.date_column }
  })

  // Group by table_name
  const grouped = {}
  ;(defRows || []).forEach(r => {
    if (!grouped[r.table_name]) grouped[r.table_name] = []
    grouped[r.table_name].push(r)
  })

  for (const [tableName, rows] of Object.entries(grouped)) {
    const meta = metaMap[tableName] || {}
    const columns = {}
    const dimensionColumns = []
    const computed = []
    const derivedDimensions = []

    // Sort by sort_order
    rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    for (const row of rows) {
      switch (row.category) {
        case 'metric':
          columns[row.column_key] = {
            alias: row.label || '',
            visible: true,
            fmt: row.fmt || 'number',
            agg: row.agg?.toLowerCase() || 'sum',
          }
          break
        case 'dimension':
          columns[row.column_key] = {
            alias: row.label || '',
            visible: true,
            fmt: 'text',
            agg: null,
          }
          dimensionColumns.push(row.column_key)
          break
        case 'hidden':
          columns[row.column_key] = {
            alias: row.label || '',
            visible: false,
            fmt: row.fmt || 'number',
            agg: null,
          }
          break
        case 'computed': {
          const aggLower = row.agg?.toLowerCase()
          computed.push({
            id: row.column_key,
            name: row.label || row.column_key,
            aggType: aggLower === 'count' || aggLower === 'count_distinct' ? aggLower : undefined,
            aggRaw: aggLower || undefined,
            terms: row.terms_json || [],
            fmt: row.fmt || 'number',
          })
          break
        }
        case 'derived':
          // derived metrics — MARKETING_DERIVED 상수가 처리하므로 여기서는 무시
          break
        case 'derived_dimension': {
          // 파생 디멘전 (예: 지점-객실타입 조합)
          columns[row.column_key] = {
            alias: row.label || '',
            visible: true,
            fmt: 'text',
            agg: null,
          }
          dimensionColumns.push(row.column_key)
          derivedDimensions.push({
            id: row.column_key,
            terms: row.terms_json || [],
          })
          break
        }
      }
    }

    result[tableName] = {
      displayName: meta.displayName || tableName,
      dateColumn: meta.dateColumn || '',
      columns,
      dimensionColumns,
      computed,
      derivedDimensions,
    }
  }

  return result
}

/** localStorage 캐시 */
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(CC_STORAGE_KEY) || '{}') } catch { return {} }
}
function saveLocal(cc) {
  try { localStorage.setItem(CC_STORAGE_KEY, JSON.stringify(cc)) } catch {}
}

export function useColumnConfig() {
  const [columnConfig, _setColumnConfig] = useState(() => loadLocal())
  const [loading, setLoading] = useState(true)

  const latestRef = useRef(columnConfig)
  const wmcTimers = useRef({})
  const lastPersistTs = useRef({})

  useEffect(() => { latestRef.current = columnConfig }, [columnConfig])

  /* ── 초기 로드: column_definitions + table_metadata + column_configs(widgetMetricConfig) ── */
  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    ;(async () => {
      try {
        const [defRes, metaRes, wmcRes] = await Promise.all([
          supabase.from('column_definitions').select('*'),
          supabase.from('table_metadata').select('*'),
          supabase.from('column_configs').select('table_name, config'),
        ])

        if (defRes.error) {
          console.warn('[useColumnConfig] column_definitions 조회 실패:', defRes.error.message)
          setLoading(false)
          return
        }

        // 1) column_definitions → columnConfig 변환
        const baseConfig = transformRows(defRes.data, metaRes.data)

        // 2) column_configs에서 widgetMetricConfig 머지
        if (wmcRes.data) {
          wmcRes.data.forEach(row => {
            if (baseConfig[row.table_name] && row.config?.widgetMetricConfig) {
              baseConfig[row.table_name].widgetMetricConfig = row.config.widgetMetricConfig
            }
          })
        }

        _setColumnConfig(baseConfig)
        saveLocal(baseConfig)
      } catch (err) {
        console.warn('[useColumnConfig] 로드 실패:', err)
      }
      setLoading(false)
    })()
  }, [])

  /* ── Realtime: column_definitions 변경 감지 → 전체 리로드 ── */
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('coldef-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'column_definitions' },
        async () => {
          // column_definitions가 변경되면 전체 리로드
          const [defRes, metaRes] = await Promise.all([
            supabase.from('column_definitions').select('*'),
            supabase.from('table_metadata').select('*'),
          ])
          if (defRes.error) return
          const baseConfig = transformRows(defRes.data, metaRes.data)

          // 기존 widgetMetricConfig 보존
          _setColumnConfig(prev => {
            for (const tn of Object.keys(baseConfig)) {
              if (prev[tn]?.widgetMetricConfig) {
                baseConfig[tn].widgetMetricConfig = prev[tn].widgetMetricConfig
              }
            }
            saveLocal(baseConfig)
            return baseConfig
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  /* ── Realtime: column_configs (widgetMetricConfig) 변경 감지 ── */
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('wmc-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'column_configs' },
        (payload) => {
          const tableName = payload.new?.table_name
          if (!tableName) return
          if (Date.now() - (lastPersistTs.current[tableName] || 0) < 3000) return

          const wmCfg = payload.new?.config?.widgetMetricConfig
          if (!wmCfg) return

          _setColumnConfig(prev => {
            if (!prev[tableName]) return prev
            const next = { ...prev, [tableName]: { ...prev[tableName], widgetMetricConfig: wmCfg } }
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
    Object.values(wmcTimers.current).forEach(clearTimeout)
  }, [])

  /* ── getColumnConfig ── */
  const getColumnConfig = useCallback((tableName) => {
    return latestRef.current[tableName] || { columns: {}, computed: [], dimensionColumns: [] }
  }, [])

  /* ── setColumnConfig (하위 호환 — widgetMetricConfig만 저장) ── */
  const setColumnConfig = useCallback((tableName, tableConfig) => {
    _setColumnConfig(prev => {
      const next = { ...prev, [tableName]: tableConfig }
      saveLocal(next)
      latestRef.current = next
      return next
    })

    // widgetMetricConfig만 column_configs에 저장
    if (supabase && tableConfig?.widgetMetricConfig) {
      clearTimeout(wmcTimers.current[tableName])
      wmcTimers.current[tableName] = setTimeout(() => {
        lastPersistTs.current[tableName] = Date.now()
        supabase
          .from('column_configs')
          .upsert({
            table_name: tableName,
            config: { widgetMetricConfig: tableConfig.widgetMetricConfig },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'table_name' })
          .then(({ error }) => {
            if (error) console.warn('[useColumnConfig] widgetMetricConfig 저장 실패:', error.message)
          })
      }, WMC_SAVE_DEBOUNCE_MS)
    }
  }, [])

  return {
    columnConfig,
    getColumnConfig,
    setColumnConfig,
    loading,
  }
}
