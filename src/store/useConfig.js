import { useState, useCallback } from 'react'

const STORAGE_KEY = 'growth_config_v4'   // v4: 빌트인 숨기기 + 서브 데이터소스

/* ──────────────────────────────────────────
   기본 설정
─────────────────────────────────────────── */
export const DEFAULT_CONFIG = {
  sectionLabels:      {},  // { 'marketing': '퍼포먼스' }
  subLabels:          {},  // { 'marketing.performance': '매체별 분석' }
  customSections:     [],  // [{id, label}] — 커스텀 L1 메인탭
  customSubs:         {},  // { 'marketing': [{id, label}] }
  dashboards:         {},  // { 'section.sub[.l3sub].tabId': { template, widgets } }
  l3tabs:             {},  // { 'section.sub[.l3sub]': [{id, label}] }
  l3subs:             {},  // { 'section.sub': [{id, label}] }  ← 새 L3 사이드바 서서브
  deletedBuiltinSubs: {},  // { 'overview': ['dashboard'], 'product': ['funnel'] }
  subDataSources:     {},  // { 'section.sub': { table, fieldMap: { metricId: 'colName' } } }
}

/* ──────────────────────────────────────────
   템플릿 정의
─────────────────────────────────────────── */
export const TEMPLATES = {
  A: {
    id: 'A', name: 'Template A',
    desc: 'KPI 4개 · 시계열 · 바차트 + 테이블',
    preview: '▦▦▦▦ / ────── / ▬▬ ▤▤',
    slots: [
      { id:'a1', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'a2', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'a3', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'a4', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'a5', defaultType:'timeseries', span:'col-span-4', row:1 },
      { id:'a6', defaultType:'bar',        span:'col-span-2', row:2 },
      { id:'a7', defaultType:'table',      span:'col-span-2', row:2 },
    ],
  },
  B: {
    id: 'B', name: 'Template B',
    desc: 'KPI 3개 · 도넛 · 시계열',
    preview: '▦▦▦◎ / ────────',
    slots: [
      { id:'b1', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'b2', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'b3', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'b4', defaultType:'donut',      span:'col-span-1', row:0 },
      { id:'b5', defaultType:'timeseries', span:'col-span-4', row:1 },
      { id:'b6', defaultType:'bar',        span:'col-span-4', row:2 },
    ],
  },
  C: {
    id: 'C', name: 'Template C',
    desc: 'KPI 4개 · 시계열 + 도넛 · 테이블',
    preview: '▦▦▦▦ / ──◎ / ▤▤▤',
    slots: [
      { id:'c1', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'c2', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'c3', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'c4', defaultType:'kpi',        span:'col-span-1', row:0 },
      { id:'c5', defaultType:'timeseries', span:'col-span-3', row:1 },
      { id:'c6', defaultType:'donut',      span:'col-span-1', row:1 },
      { id:'c7', defaultType:'table',      span:'col-span-4', row:2 },
    ],
  },
  D: {
    id: 'D', name: 'Template D',
    desc: '미니멀 — KPI 6개 · 시계열',
    preview: '▦▦▦ / ▦▦▦ / ──────',
    slots: [
      { id:'d1', defaultType:'kpi', span:'col-span-1', row:0 },
      { id:'d2', defaultType:'kpi', span:'col-span-1', row:0 },
      { id:'d3', defaultType:'kpi', span:'col-span-1', row:0 },
      { id:'d4', defaultType:'kpi', span:'col-span-1', row:0 },
      { id:'d5', defaultType:'kpi', span:'col-span-1', row:1 },
      { id:'d6', defaultType:'kpi', span:'col-span-1', row:1 },
      { id:'d7', defaultType:'kpi', span:'col-span-1', row:1 },
      { id:'d8', defaultType:'kpi', span:'col-span-1', row:1 },
      { id:'d9', defaultType:'timeseries', span:'col-span-4', row:2 },
    ],
  },
}

/* ──────────────────────────────────────────
   위젯 타입
─────────────────────────────────────────── */
export const WIDGET_TYPES = [
  { id:'kpi',        label:'KPI 카드',      icon:'💳' },
  { id:'timeseries', label:'시계열 차트',   icon:'📈' },
  { id:'bar',        label:'바 차트',       icon:'📊' },
  { id:'donut',      label:'도넛 차트',     icon:'🍩' },
  { id:'table',      label:'데이터 테이블', icon:'📋' },
]

/* ──────────────────────────────────────────
   지표 목록
   group: 'metric' = 원시 지표 / 'rate' = 단가·비율 파생지표
─────────────────────────────────────────── */
export const METRICS = [
  /* ── 지표 (원시) ── */
  { id:'cost',         label:'광고비',           field:'spend',        fmt:'currency', group:'metric' },
  { id:'impr',         label:'노출',             field:'impressions',  fmt:'number',   group:'metric' },
  { id:'clicks',       label:'클릭',             field:'clicks',       fmt:'number',   group:'metric' },
  { id:'view_content', label:'상세페이지 조회',  field:'view_content', fmt:'number',   group:'metric' },
  { id:'signup',       label:'회원가입',         field:'signups',      fmt:'number',   group:'metric' },
  { id:'conv',         label:'구매',             field:'purchases',    fmt:'number',   group:'metric' },
  { id:'revenue',      label:'매출',             field:'revenue',      fmt:'currency', group:'metric' },
  { id:'installs',     label:'인스톨',           field:'installs',     fmt:'number',   group:'metric' },
  /* ── 단가 / 비율 (파생) ── */
  { id:'cpm',          label:'CPM',              field:null,           fmt:'currency', group:'rate', derived:true },
  { id:'cpc',          label:'CPC',              field:'cpc',          fmt:'currency', group:'rate' },
  { id:'ctr',          label:'CTR',              field:null,           fmt:'pct',      group:'rate', derived:true },
  { id:'cpa_view',     label:'CPA(조회)',         field:null,           fmt:'currency', group:'rate', derived:true },
  { id:'cac',          label:'CAC',              field:null,           fmt:'currency', group:'rate', derived:true },
  { id:'cps',          label:'CPS',              field:null,           fmt:'currency', group:'rate', derived:true },
  { id:'roas',         label:'ROAS',             field:null,           fmt:'roas',     group:'rate', derived:true },
]

/* 파생지표 계산에 필요한 기반 지표 ID */
export const DERIVED_BASE_METRICS = ['cost', 'impr', 'clicks', 'view_content', 'signup', 'conv', 'revenue']

/* GROUP_BY: DB 컬럼명 snake_case 사용 */
export const GROUP_BY = [
  { id:'channel',     label:'채널'        },
  { id:'campaign',    label:'캠페인'      },
  { id:'ad_group',    label:'광고그룹'    },
  { id:'ad_creative', label:'크리에이티브' },
]

/* ──────────────────────────────────────────
   기본 위젯 config
─────────────────────────────────────────── */
export const DEFAULT_WIDGET_CONFIG = {
  kpi:        { metric:'cost',    label:'' },
  timeseries: { metrics:['cost','revenue'], title:'일별 트렌드' },
  bar:        { metric:'cost',    groupBy:'channel', title:'채널별 성과' },
  donut:      { metric:'cost',    groupBy:'channel', title:'구성 비율' },
  table:      { metrics:['cost','installs','conv','revenue'], groupBy:'channel', title:'성과 테이블' },
}

/* ──────────────────────────────────────────
   대시보드 초기값 생성 (빈 슬롯 배열)
─────────────────────────────────────────── */
export function makeDashboard() {
  return { slots: [] }
}

/* ──────────────────────────────────────────
   React Hook
─────────────────────────────────────────── */
/* 구 테이블명 → marketing_data 마이그레이션 */
const OLD_TABLE_NAMES = new Set([
  'marketing_perf','meta_perf','perf_meta',
  'perf_google','perf_naver_pl','perf_naver_brand',
])

function migrateConfig(raw) {
  const merged = { ...DEFAULT_CONFIG, ...raw }
  if (!merged.subDataSources) return merged
  let changed = false
  const newDS = Object.fromEntries(
    Object.entries(merged.subDataSources).map(([k, v]) => {
      if (OLD_TABLE_NAMES.has(v?.table)) {
        changed = true
        return [k, { ...v, table: 'marketing_data' }]
      }
      return [k, v]
    })
  )
  if (changed) {
    merged.subDataSources = newDS
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)) } catch {}
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

  const persist = useCallback(next => {
    _setConfig(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  /* ── L1/L2 라벨 ── */
  const setSectionLabel = (id, label) =>
    persist({ ...config, sectionLabels: { ...config.sectionLabels, [id]: label } })

  const setSubLabel = (sectionId, subId, label) =>
    persist({ ...config, subLabels: { ...config.subLabels, [`${sectionId}.${subId}`]: label } })

  /* ── 빌트인 서브탭 숨기기 / 복원 ── */
  const hideBuiltinSub = (sectionId, subId) => {
    const cur = config.deletedBuiltinSubs[sectionId] || []
    if (cur.includes(subId)) return
    persist({
      ...config,
      deletedBuiltinSubs: { ...config.deletedBuiltinSubs, [sectionId]: [...cur, subId] },
    })
  }

  const showBuiltinSub = (sectionId, subId) => {
    const cur = config.deletedBuiltinSubs[sectionId] || []
    persist({
      ...config,
      deletedBuiltinSubs: { ...config.deletedBuiltinSubs, [sectionId]: cur.filter(id => id !== subId) },
    })
  }

  const isBuiltinSubHidden = (sectionId, subId) =>
    (config.deletedBuiltinSubs[sectionId] || []).includes(subId)

  /* ── L2 서브 데이터 소스 ── */
  const getSubDataSource = (sectionId, subId) =>
    config.subDataSources[`${sectionId}.${subId}`] || { table: 'marketing_data', fieldMap: {} }

  const setSubDataSource = (sectionId, subId, dataSource) =>
    persist({
      ...config,
      subDataSources: { ...config.subDataSources, [`${sectionId}.${subId}`]: dataSource },
    })

  /* ── L1 커스텀 섹션(메인탭) ── */
  const getCustomSections = () => config.customSections || []

  const addCustomSection = (label) => {
    const id = `cm_${Date.now()}`
    persist({
      ...config,
      customSections: [...(config.customSections || []), { id, label }],
    })
    return id
  }

  const removeCustomSection = (id) => {
    // cascade: 이 섹션에 속한 모든 데이터 삭제
    const newSectionLabels = { ...config.sectionLabels }
    delete newSectionLabels[id]
    const prefix = `${id}.`
    const filterOut = (obj) =>
      Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !k.startsWith(prefix)))
    const newCustomSubs = { ...config.customSubs }
    delete newCustomSubs[id]
    persist({
      ...config,
      customSections:  (config.customSections || []).filter(s => s.id !== id),
      sectionLabels:   newSectionLabels,
      subLabels:       filterOut(config.subLabels),
      customSubs:      newCustomSubs,
      l3subs:          filterOut(config.l3subs),
      l3tabs:          filterOut(config.l3tabs),
      dashboards:      filterOut(config.dashboards),
      subDataSources:  filterOut(config.subDataSources),
    })
  }

  /* ── L2 커스텀 서브탭 ── */
  const addCustomSub = (sectionId, label) => {
    const id  = `cx_${Date.now()}`
    const cur = config.customSubs[sectionId] || []
    persist({
      ...config,
      customSubs: { ...config.customSubs, [sectionId]: [...cur, { id, label }] },
    })
    return id
  }

  const removeCustomSub = (sectionId, subId) => {
    const cur    = config.customSubs[sectionId] || []
    const l3Key  = `${sectionId}.${subId}`
    const dash   = { ...config.dashboards }
    const l3t    = { ...config.l3tabs }
    const l3s    = { ...config.l3subs }

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

    const ds = { ...config.subDataSources }
    delete ds[l3Key]
    persist({
      ...config,
      customSubs:     { ...config.customSubs, [sectionId]: cur.filter(s => s.id !== subId) },
      dashboards:     dash,
      l3tabs:         l3t,
      l3subs:         l3s,
      subDataSources: ds,
    })
  }

  /* ── L3 사이드바 서서브 (새 레벨) ── */
  const getL3Subs = (sid, sub) =>
    config.l3subs[`${sid}.${sub}`] || []

  const addL3Sub = (sid, sub, label) => {
    const id  = `ls_${Date.now()}`
    const key = `${sid}.${sub}`
    const cur = config.l3subs[key] || []
    persist({
      ...config,
      l3subs: { ...config.l3subs, [key]: [...cur, { id, label }] },
    })
    return id
  }

  const removeL3Sub = (sid, sub, l3subId) => {
    const key     = `${sid}.${sub}`
    const cur     = config.l3subs[key] || []
    const tabsKey = `${key}.${l3subId}`
    const tabs    = config.l3tabs[tabsKey] || []
    const dash    = { ...config.dashboards }
    tabs.forEach(t => { delete dash[`${tabsKey}.${t.id}`] })
    const l3t = { ...config.l3tabs }
    delete l3t[tabsKey]
    persist({
      ...config,
      l3subs:     { ...config.l3subs, [key]: cur.filter(s => s.id !== l3subId) },
      l3tabs:     l3t,
      dashboards: dash,
    })
  }

  const renameL3Sub = (sid, sub, l3subId, label) => {
    const key = `${sid}.${sub}`
    const cur = config.l3subs[key] || []
    persist({
      ...config,
      l3subs: { ...config.l3subs, [key]: cur.map(s => s.id === l3subId ? { ...s, label } : s) },
    })
  }

  const reorderL3Subs = (sid, sub, fromIdx, toIdx) => {
    const key = `${sid}.${sub}`
    const cur = [...(config.l3subs[key] || [])]
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= cur.length || toIdx >= cur.length) return
    const [item] = cur.splice(fromIdx, 1)
    cur.splice(toIdx, 0, item)
    persist({ ...config, l3subs: { ...config.l3subs, [key]: cur } })
  }

  /* ── L4 탭 (구 L3 탭, l3sub 선택 지원) ── */
  /* tabsScope: l3sub 있으면 'sid.sub.l3sub', 없으면 'sid.sub' */
  const _tabsScope = (sid, sub, l3sub) => l3sub ? `${sid}.${sub}.${l3sub}` : `${sid}.${sub}`

  const getL3Tabs = (sid, sub, l3sub = null) =>
    config.l3tabs[_tabsScope(sid, sub, l3sub)] || []

  const addL3Tab = (sid, sub, label, l3sub = null) => {
    const id    = `t3_${Date.now()}`
    const scope = _tabsScope(sid, sub, l3sub)
    const cur   = config.l3tabs[scope] || []
    const dash  = makeDashboard('A')
    persist({
      ...config,
      l3tabs:     { ...config.l3tabs,     [scope]:           [...cur, { id, label }] },
      dashboards: { ...config.dashboards, [`${scope}.${id}`]: dash                   },
    })
    return id
  }

  const removeL3Tab = (sid, sub, tabId, l3sub = null) => {
    const scope = _tabsScope(sid, sub, l3sub)
    const cur   = config.l3tabs[scope] || []
    const dash  = { ...config.dashboards }
    delete dash[`${scope}.${tabId}`]
    persist({
      ...config,
      l3tabs:     { ...config.l3tabs, [scope]: cur.filter(t => t.id !== tabId) },
      dashboards: dash,
    })
  }

  const renameL3Tab = (sid, sub, tabId, label, l3sub = null) => {
    const scope = _tabsScope(sid, sub, l3sub)
    const cur   = config.l3tabs[scope] || []
    persist({
      ...config,
      l3tabs: {
        ...config.l3tabs,
        [scope]: cur.map(t => t.id === tabId ? { ...t, label } : t),
      },
    })
  }

  const reorderL3Tabs = (sid, sub, fromIdx, toIdx, l3sub = null) => {
    const scope = _tabsScope(sid, sub, l3sub)
    const cur   = [...(config.l3tabs[scope] || [])]
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= cur.length || toIdx >= cur.length) return
    const [item] = cur.splice(fromIdx, 1)
    cur.splice(toIdx, 0, item)
    persist({ ...config, l3tabs: { ...config.l3tabs, [scope]: cur } })
  }

  /* ── 대시보드 (l3sub + tabId 지원) ── */
  const getDashboard = (sid, sub, tabId = null, l3sub = null) => {
    const base = _tabsScope(sid, sub, l3sub)
    const key  = tabId ? `${base}.${tabId}` : base
    return config.dashboards[key] || null
  }

  const saveDashboard = (sid, sub, dashboard, tabId = null, l3sub = null) => {
    const base = _tabsScope(sid, sub, l3sub)
    const key  = tabId ? `${base}.${tabId}` : base
    persist({ ...config, dashboards: { ...config.dashboards, [key]: dashboard } })
  }

  /* ── getter ── */
  const getSectionLabel = id       => config.sectionLabels[id]              || null
  const getSubLabel     = (sid, s) => config.subLabels[`${sid}.${s}`]       || null
  const getCustomSubs   = sid      => config.customSubs[sid]                || []

  return {
    config,
    getSectionLabel, getSubLabel, getCustomSubs, getDashboard, saveDashboard,
    setSectionLabel, setSubLabel,
    getCustomSections, addCustomSection, removeCustomSection,
    addCustomSub, removeCustomSub,
    hideBuiltinSub, showBuiltinSub, isBuiltinSubHidden,
    getSubDataSource, setSubDataSource,
    getL3Subs, addL3Sub, removeL3Sub, renameL3Sub, reorderL3Subs,
    getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab, reorderL3Tabs,
  }
}
