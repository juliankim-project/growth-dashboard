import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'growth_config_v5'   // v5: 위젯 10종 재설계 (timeseries→line, donut→pie 등)
const DB_ROW_ID = 'default'              // Supabase dashboard_config 행 ID
const SAVE_DEBOUNCE_MS = 500             // Supabase 저장 디바운스

/* ──────────────────────────────────────────
   기본 설정
─────────────────────────────────────────── */
export const DEFAULT_CONFIG = {
  sectionLabels: {},  // { 'marketing': '퍼포먼스' }
  subLabels: {},  // { 'marketing.performance': '매체별 분석' }
  customSections: [],  // [{id, label}] — 커스텀 L1 메인탭
  customSubs: {},  // { 'marketing': [{id, label}] }
  dashboards: {},  // { 'section.sub[.l3sub].tabId': { template, widgets } }
  l3tabs: {},  // { 'section.sub[.l3sub]': [{id, label}] }
  l3subs: {},  // { 'section.sub': [{id, label}] }  ← 새 L3 사이드바 서서브
  deletedBuiltinSubs: {},  // { 'overview': ['dashboard'], 'product': ['funnel'] }
  subDataSources: {},  // { 'section.sub': { table, fieldMap: { metricId: 'colName' } } }
  subColors: {},  // { 'section.sub': 'indigo' | 'amber' | 'emerald' | 'violet' | 'rose' | null }
  /* ── 앱 설정 ── */
  projectName: 'Growth HQ',
  logoUrl: null,      // base64 이미지 or null
  /* ── 아이콘 오버라이드 ── */
  sectionIcons: {},        // { 'sectionId': 'IconName' }
  subIcons: {},        // { 'sectionId.subId': 'IconName' }
  l3subIcons: {},        // { 'sectionId.subId.l3subId': 'IconName' }
  /* ── 테이블 컬럼 설정 (레거시 — useColumnConfig로 이전됨) ── */
  columnConfig: {},        // 하위호환용 유지, 실제 데이터는 column_configs 테이블 사용
}

/* ──────────────────────────────────────────
   템플릿 정의
─────────────────────────────────────────── */
export const TEMPLATES = {
  A: {
    id: 'A', name: 'Template A',
    desc: 'KPI 4개 · 라인 · 바차트 + 테이블',
    preview: '▦▦▦▦ / ────── / ▬▬ ▤▤',
    slots: [
      { id: 'a1', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'a2', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'a3', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'a4', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'a5', defaultType: 'line', span: 'col-span-4', row: 1 },
      { id: 'a6', defaultType: 'bar', span: 'col-span-2', row: 2 },
      { id: 'a7', defaultType: 'table', span: 'col-span-2', row: 2 },
    ],
  },
  B: {
    id: 'B', name: 'Template B',
    desc: 'KPI 3개 · 파이 · 라인',
    preview: '▦▦▦◎ / ────────',
    slots: [
      { id: 'b1', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'b2', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'b3', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'b4', defaultType: 'pie', span: 'col-span-1', row: 0 },
      { id: 'b5', defaultType: 'line', span: 'col-span-4', row: 1 },
      { id: 'b6', defaultType: 'bar', span: 'col-span-4', row: 2 },
    ],
  },
  C: {
    id: 'C', name: 'Template C',
    desc: 'KPI 4개 · 라인 + 파이 · 테이블',
    preview: '▦▦▦▦ / ──◎ / ▤▤▤',
    slots: [
      { id: 'c1', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'c2', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'c3', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'c4', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'c5', defaultType: 'line', span: 'col-span-3', row: 1 },
      { id: 'c6', defaultType: 'pie', span: 'col-span-1', row: 1 },
      { id: 'c7', defaultType: 'table', span: 'col-span-4', row: 2 },
    ],
  },
  D: {
    id: 'D', name: 'Template D',
    desc: '미니멀 — KPI 6개 · 라인',
    preview: '▦▦▦ / ▦▦▦ / ──────',
    slots: [
      { id: 'd1', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'd2', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'd3', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'd4', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'd5', defaultType: 'kpi', span: 'col-span-1', row: 1 },
      { id: 'd6', defaultType: 'kpi', span: 'col-span-1', row: 1 },
      { id: 'd7', defaultType: 'kpi', span: 'col-span-1', row: 1 },
      { id: 'd8', defaultType: 'kpi', span: 'col-span-1', row: 1 },
      { id: 'd9', defaultType: 'line', span: 'col-span-4', row: 2 },
    ],
  },
}

/* ──────────────────────────────────────────
   위젯 타입 — 10종 플랫 리스트
─────────────────────────────────────────── */
export const WIDGET_TYPES = [
  { id: 'kpi',        label: 'KPI 카드',      icon: '💳', metricMode: 'single',  needsGroup: false },
  { id: 'line',       label: '라인 차트',      icon: '📈', metricMode: 'multi',   needsGroup: false },
  { id: 'bar',        label: '바 차트',        icon: '📊', metricMode: 'single',  needsGroup: true  },
  { id: 'table',      label: '데이터 테이블',  icon: '📋', metricMode: 'multi',   needsGroup: true  },
  { id: 'funnel',     label: '전환 퍼널',      icon: '🔻', metricMode: 'stages',  needsGroup: false },
  { id: 'pie',        label: '파이/도넛',      icon: '🍩', metricMode: 'single',  needsGroup: true  },
  { id: 'comparison', label: '비교 분석',      icon: '⚖️', metricMode: 'multi',   needsGroup: false },
  { id: 'ranking',    label: '랭킹',           icon: '🏆', metricMode: 'single',  needsGroup: true  },
  { id: 'alert',      label: '알림 모니터',    icon: '🚨', metricMode: 'multi',   needsGroup: false },
  { id: 'timeline',   label: '타임라인',       icon: '⏱️', metricMode: 'multi',   needsGroup: false },
]

/* ── 중위탭 색깔 옵션 (순수 장식용) ── */
export const SUB_COLOR_OPTIONS = [
  { id: 'indigo',  hex: '#818cf8', label: '인디고' },
  { id: 'amber',   hex: '#fbbf24', label: '앰버' },
  { id: 'emerald', hex: '#34d399', label: '에메랄드' },
  { id: 'violet',  hex: '#a78bfa', label: '바이올렛' },
  { id: 'rose',    hex: '#fb7185', label: '로즈' },
  { id: 'sky',     hex: '#38bdf8', label: '스카이' },
  { id: 'orange',  hex: '#fb923c', label: '오렌지' },
]

/* ──────────────────────────────────────────
   기본 위젯 config — 10종
─────────────────────────────────────────── */
export const DEFAULT_WIDGET_CONFIG = {
  kpi:        { metric: '', label: '' },
  line:       { metrics: [], title: '일별 트렌드' },
  bar:        { metric: '', groupBy: '', title: '채널별 성과' },
  table:      { metrics: [], groupBy: '', title: '성과 테이블' },
  funnel:     { stages: [
    { id: 's1', label: '단계1', metric: '' },
    { id: 's2', label: '단계2', metric: '' },
    { id: 's3', label: '단계3', metric: '' },
  ], title: '전환 퍼널' },
  pie:        { metric: '', groupBy: '', title: '구성 비율' },
  comparison: { metrics: [], compareMode: 'period', title: '기간 비교' },
  ranking:    { metric: '', groupBy: '', topN: 10, sortDir: 'desc', title: '랭킹' },
  alert:      { metrics: [], thresholds: {}, title: '알림 모니터' },
  timeline:   { metrics: [], title: '트렌드 요약' },
}

/* ──────────────────────────────────────────
   대시보드 초기값 생성
─────────────────────────────────────────── */
export function makeDashboard() {
  /* 모든 탭은 DashboardGrid (slots 배열) — 타입별 전체 페이지는 제거됨 */
  return { slots: [] }
}

/* ──────────────────────────────────────────
   React Hook
─────────────────────────────────────────── */
/* 구 테이블명 → marketing_data 마이그레이션 */
const OLD_TABLE_NAMES = new Set([
  'marketing_perf', 'meta_perf', 'perf_meta',
  'perf_google', 'perf_naver_pl', 'perf_naver_brand',
])

/* 위젯 타입 리네임 맵 */
const TYPE_RENAME = { timeseries: 'line', donut: 'pie', funnel_chart: 'funnel' }
const REMOVED_TYPES = new Set([
  'sim_budget', 'sim_goal', 'sim_scenario',
  'funnel_breakdown', 'cohort_heatmap', 'cohort_trend', 'kanban_board',
])

function migrateConfig(raw) {
  const merged = { ...DEFAULT_CONFIG, ...raw }
  if (!merged.subColors) merged.subColors = {}
  let changed = false

  /* 구 테이블명 → marketing_data 마이그레이션 */
  if (merged.subDataSources) {
    const newDS = Object.fromEntries(
      Object.entries(merged.subDataSources).map(([k, v]) => {
        if (OLD_TABLE_NAMES.has(v?.table)) {
          changed = true
          return [k, { ...v, table: 'marketing_data' }]
        }
        return [k, v]
      })
    )
    if (changed) merged.subDataSources = newDS
  }

  /* 대시보드 내 위젯 타입 마이그레이션: 리네임 + 삭제된 타입 제거 + table 프로퍼티 승격 */
  if (merged.dashboards) {
    Object.keys(merged.dashboards).forEach(dKey => {
      const dash = merged.dashboards[dKey]
      if (!dash?.slots) return
      const newSlots = []
      dash.slots.forEach(slot => {
        if (REMOVED_TYPES.has(slot.type)) { changed = true; return }
        const newType = TYPE_RENAME[slot.type] || slot.type
        if (newType !== slot.type) changed = true
        /* table 프로퍼티 승격: config._table → slot.table */
        const table = slot.table || slot.config?._table || null
        const cfg = { ...slot.config }
        delete cfg._table
        newSlots.push({ ...slot, type: newType, table, config: cfg })
      })
      if (changed) dash.slots = newSlots
    })
  }

  if (changed) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch { }
  }
  return merged
}

export function useConfig() {
  const [config, _setConfig] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      return migrateConfig(raw)
    } catch { return { ...DEFAULT_CONFIG } }
  })

  const latestRef = useRef(config)
  const saveTimer = useRef(null)
  const lastPersistTs = useRef(0)        // Realtime 자기 에코 방지용 타임스탬프
  useEffect(() => { latestRef.current = config }, [config])

  /* ── Supabase: 초기 로드 (DB 값으로 동기화) ── */
  useEffect(() => {
    if (!supabase) return
    ;(async () => {
      const { data, error } = await supabase
        .from('dashboard_config')
        .select('config')
        .eq('id', DB_ROW_ID)
        .maybeSingle()

      if (error) {
        console.warn('[useConfig] DB 조회 실패:', error.message)
        return
      }
      if (data?.config) {
        const merged = migrateConfig(data.config)
        _setConfig(merged)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch {}
      } else {
        // DB에 데이터 없음 → 현재 localStorage 값을 DB에 업로드 (첫 배포)
        await supabase.from('dashboard_config').upsert({
          id: DB_ROW_ID,
          config: latestRef.current,
          updated_at: new Date().toISOString(),
        })
      }
    })()
  }, [])

  /* ── Supabase: Realtime 구독 (다른 유저 변경 실시간 반영) ── */
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('config-sync')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'dashboard_config', filter: `id=eq.${DB_ROW_ID}` },
        (payload) => {
          /* 자기 에코 방지: 최근 3초 이내에 내가 저장한 경우 무시 */
          if (Date.now() - lastPersistTs.current < 3000) return
          const remote = payload.new?.config
          if (!remote) return
          const merged = migrateConfig(remote)
          _setConfig(merged)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch {}
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  /* ── cleanup ── */
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  /** persist: state + localStorage + Supabase(debounced) */
  const persist = useCallback(updater => {
    _setConfig(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      latestRef.current = next
      return next
    })
    // Supabase 디바운스 저장
    if (supabase) {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        lastPersistTs.current = Date.now()   // Realtime 자기 에코 방지
        supabase
          .from('dashboard_config')
          .upsert({ id: DB_ROW_ID, config: latestRef.current, updated_at: new Date().toISOString() })
          .then(({ error }) => {
            if (error) console.warn('[useConfig] DB 저장 실패:', error.message)
          })
      }, SAVE_DEBOUNCE_MS)
    }
  }, [])

  /* ── 앱 설정 ── */
  const setProjectName = (name) =>
    persist(prev => ({ ...prev, projectName: name }))

  const setLogoUrl = (url) =>
    persist(prev => ({ ...prev, logoUrl: url }))

  /* ── 아이콘 오버라이드 ── */
  const setSectionIcon = (id, icon) =>
    persist(prev => ({ ...prev, sectionIcons: { ...(prev.sectionIcons || {}), [id]: icon } }))

  const setSubIcon = (sectionId, subId, icon) =>
    persist(prev => ({ ...prev, subIcons: { ...(prev.subIcons || {}), [`${sectionId}.${subId}`]: icon } }))

  const setL3SubIcon = (sectionId, subId, l3subId, icon) =>
    persist(prev => ({ ...prev, l3subIcons: { ...(prev.l3subIcons || {}), [`${sectionId}.${subId}.${l3subId}`]: icon } }))

  /* ── L1/L2 라벨 ── */
  const setSectionLabel = (id, label) =>
    persist(prev => ({ ...prev, sectionLabels: { ...prev.sectionLabels, [id]: label } }))

  const setSubLabel = (sectionId, subId, label) =>
    persist(prev => ({ ...prev, subLabels: { ...prev.subLabels, [`${sectionId}.${subId}`]: label } }))

  /* ── 빌트인 서브탭 숨기기 / 복원 ── */
  const hideBuiltinSub = (sectionId, subId) => {
    persist(prev => {
      const cur = prev.deletedBuiltinSubs[sectionId] || []
      if (cur.includes(subId)) return prev
      return {
        ...prev,
        deletedBuiltinSubs: { ...prev.deletedBuiltinSubs, [sectionId]: [...cur, subId] },
      }
    })
  }

  const showBuiltinSub = (sectionId, subId) => {
    persist(prev => {
      const cur = prev.deletedBuiltinSubs[sectionId] || []
      return {
        ...prev,
        deletedBuiltinSubs: { ...prev.deletedBuiltinSubs, [sectionId]: cur.filter(id => id !== subId) },
      }
    })
  }

  const isBuiltinSubHidden = (sectionId, subId) =>
    (config.deletedBuiltinSubs[sectionId] || []).includes(subId)

  /* ── L2 서브 색깔 (장식용) ── */
  const getSubColor = (sectionId, subId) =>
    config.subColors?.[`${sectionId}.${subId}`] || null

  const setSubColor = (sectionId, subId, color) =>
    persist(prev => ({
      ...prev,
      subColors: { ...(prev.subColors || {}), [`${sectionId}.${subId}`]: color },
    }))

  /* ── L2 서브 데이터 소스 ── */
  const getSubDataSource = (sectionId, subId) =>
    config.subDataSources[`${sectionId}.${subId}`] || { table: 'marketing_data', fieldMap: {} }

  const setSubDataSource = (sectionId, subId, dataSource) =>
    persist(prev => ({
      ...prev,
      subDataSources: { ...prev.subDataSources, [`${sectionId}.${subId}`]: dataSource },
    }))

  /* ── L1 커스텀 섹션(메인탭) ── */
  const getCustomSections = () => config.customSections || []

  const addCustomSection = (label) => {
    const id = `cm_${Date.now()}`
    persist(prev => ({
      ...prev,
      customSections: [...(prev.customSections || []), { id, label }],
    }))
    return id
  }

  const removeCustomSection = (id) => {
    persist(prev => {
      // cascade: 이 섹션에 속한 모든 데이터 삭제
      const newSectionLabels = { ...prev.sectionLabels }
      delete newSectionLabels[id]
      const prefix = `${id}.`
      const filterOut = (obj) =>
        Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !k.startsWith(prefix)))
      const newCustomSubs = { ...prev.customSubs }
      delete newCustomSubs[id]
      return {
        ...prev,
        customSections: (prev.customSections || []).filter(s => s.id !== id),
        sectionLabels: newSectionLabels,
        subLabels: filterOut(prev.subLabels),
        customSubs: newCustomSubs,
        l3subs: filterOut(prev.l3subs),
        l3tabs: filterOut(prev.l3tabs),
        dashboards: filterOut(prev.dashboards),
        subDataSources: filterOut(prev.subDataSources),
        subColors: filterOut(prev.subColors),
      }
    })
  }

  /* ── L2 커스텀 서브탭 ── */
  const addCustomSub = (sectionId, label) => {
    const id = `cx_${Date.now()}`
    persist(prev => {
      const cur = prev.customSubs[sectionId] || []
      return {
        ...prev,
        customSubs: { ...prev.customSubs, [sectionId]: [...cur, { id, label }] },
      }
    })
    return id
  }

  const removeCustomSub = (sectionId, subId) => {
    persist(prev => {
      const cur = prev.customSubs[sectionId] || []
      const l3Key = `${sectionId}.${subId}`
      const dash = { ...prev.dashboards }
      const l3t = { ...prev.l3tabs }
      const l3s = { ...prev.l3subs }

      // cascade: L3 subs → L4 tabs → dashboards
      const subL3Subs = l3s[l3Key] || []
      subL3Subs.forEach(ls => {
        const tabsKey = `${l3Key}.${ls.id}`
        const tabs = l3t[tabsKey] || []
        tabs.forEach(t => { delete dash[`${tabsKey}.${t.id}`] })
        delete l3t[tabsKey]
      })
      delete l3s[l3Key]

      // cascade: direct L4 tabs (backward compat)
      const directTabs = l3t[l3Key] || []
      directTabs.forEach(t => { delete dash[`${l3Key}.${t.id}`] })
      delete l3t[l3Key]

      const ds = { ...prev.subDataSources }
      delete ds[l3Key]
      const sc = { ...(prev.subColors || {}) }
      delete sc[l3Key]
      return {
        ...prev,
        customSubs: { ...prev.customSubs, [sectionId]: cur.filter(s => s.id !== subId) },
        dashboards: dash,
        l3tabs: l3t,
        l3subs: l3s,
        subDataSources: ds,
        subColors: sc,
      }
    })
  }

  /* ── L3 사이드바 서서브 (새 레벨) ── */
  const getL3Subs = (sid, sub) =>
    config.l3subs[`${sid}.${sub}`] || []

  const addL3Sub = (sid, sub, label) => {
    const id = `ls_${Date.now()}`
    const key = `${sid}.${sub}`
    persist(prev => {
      const cur = prev.l3subs[key] || []
      return {
        ...prev,
        l3subs: { ...prev.l3subs, [key]: [...cur, { id, label }] },
      }
    })
    return id
  }

  const removeL3Sub = (sid, sub, l3subId) => {
    const key = `${sid}.${sub}`
    persist(prev => {
      const cur = prev.l3subs[key] || []
      const tabsKey = `${key}.${l3subId}`
      const tabs = prev.l3tabs[tabsKey] || []
      const dash = { ...prev.dashboards }
      tabs.forEach(t => { delete dash[`${tabsKey}.${t.id}`] })
      const l3t = { ...prev.l3tabs }
      delete l3t[tabsKey]
      return {
        ...prev,
        l3subs: { ...prev.l3subs, [key]: cur.filter(s => s.id !== l3subId) },
        l3tabs: l3t,
        dashboards: dash,
      }
    })
  }

  const renameL3Sub = (sid, sub, l3subId, label) => {
    const key = `${sid}.${sub}`
    persist(prev => {
      const cur = prev.l3subs[key] || []
      return {
        ...prev,
        l3subs: { ...prev.l3subs, [key]: cur.map(s => s.id === l3subId ? { ...s, label } : s) },
      }
    })
  }

  const reorderL3Subs = (sid, sub, fromIdx, toIdx) => {
    const key = `${sid}.${sub}`
    persist(prev => {
      const cur = [...(prev.l3subs[key] || [])]
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= cur.length || toIdx >= cur.length) return prev
      const [item] = cur.splice(fromIdx, 1)
      cur.splice(toIdx, 0, item)
      return { ...prev, l3subs: { ...prev.l3subs, [key]: cur } }
    })
  }

  /* ── L4 탭 (구 L3 탭, l3sub 선택 지원) ── */
  /* tabsScope: l3sub 있으면 'sid.sub.l3sub', 없으면 'sid.sub' */
  const _tabsScope = (sid, sub, l3sub) => l3sub ? `${sid}.${sub}.${l3sub}` : `${sid}.${sub}`

  const getL3Tabs = (sid, sub, l3sub = null) =>
    config.l3tabs[_tabsScope(sid, sub, l3sub)] || []

  const addL3Tab = (sid, sub, label, l3sub = null) => {
    const id = `t3_${Date.now()}`
    const scope = _tabsScope(sid, sub, l3sub)
    const dash = makeDashboard()
    persist(prev => {
      const cur = prev.l3tabs[scope] || []
      return {
        ...prev,
        l3tabs: { ...prev.l3tabs, [scope]: [...cur, { id, label }] },
        dashboards: { ...prev.dashboards, [`${scope}.${id}`]: dash },
      }
    })
    return id
  }

  const removeL3Tab = (sid, sub, tabId, l3sub = null) => {
    const scope = _tabsScope(sid, sub, l3sub)
    persist(prev => {
      const cur = prev.l3tabs[scope] || []
      const dash = { ...prev.dashboards }
      delete dash[`${scope}.${tabId}`]
      return {
        ...prev,
        l3tabs: { ...prev.l3tabs, [scope]: cur.filter(t => t.id !== tabId) },
        dashboards: dash,
      }
    })
  }

  const renameL3Tab = (sid, sub, tabId, label, l3sub = null) => {
    const scope = _tabsScope(sid, sub, l3sub)
    persist(prev => {
      const cur = prev.l3tabs[scope] || []
      return {
        ...prev,
        l3tabs: {
          ...prev.l3tabs,
          [scope]: cur.map(t => t.id === tabId ? { ...t, label } : t),
        },
      }
    })
  }

  const reorderL3Tabs = (sid, sub, fromIdx, toIdx, l3sub = null) => {
    const scope = _tabsScope(sid, sub, l3sub)
    persist(prev => {
      const cur = [...(prev.l3tabs[scope] || [])]
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= cur.length || toIdx >= cur.length) return prev
      const [item] = cur.splice(fromIdx, 1)
      cur.splice(toIdx, 0, item)
      return { ...prev, l3tabs: { ...prev.l3tabs, [scope]: cur } }
    })
  }

  /* ── 대시보드 (l3sub + tabId 지원) ── */
  const getDashboard = (sid, sub, tabId = null, l3sub = null) => {
    const base = _tabsScope(sid, sub, l3sub)
    const key = tabId ? `${base}.${tabId}` : base
    return config.dashboards[key] || null
  }

  const saveDashboard = (sid, sub, dashboard, tabId = null, l3sub = null) => {
    const base = _tabsScope(sid, sub, l3sub)
    const key = tabId ? `${base}.${tabId}` : base
    persist(prev => ({ ...prev, dashboards: { ...prev.dashboards, [key]: dashboard } }))
  }

  /* ── getter ── */
  const getSectionLabel = id => config.sectionLabels[id] || null
  const getSubLabel = (sid, s) => config.subLabels[`${sid}.${s}`] || null
  const getCustomSubs = sid => config.customSubs[sid] || []

  /* ── 컬럼 설정 → useColumnConfig 훅으로 이전 ── */

  return {
    config,
    getSectionLabel, getSubLabel, getCustomSubs, getDashboard, saveDashboard,
    setSectionLabel, setSubLabel,
    setProjectName, setLogoUrl,
    setSectionIcon, setSubIcon, setL3SubIcon,
    getCustomSections, addCustomSection, removeCustomSection,
    addCustomSub, removeCustomSub,
    hideBuiltinSub, showBuiltinSub, isBuiltinSubHidden,
    getSubColor, setSubColor,
    getSubDataSource, setSubDataSource,
    getL3Subs, addL3Sub, removeL3Sub, renameL3Sub, reorderL3Subs,
    getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab, reorderL3Tabs,
  }
}
