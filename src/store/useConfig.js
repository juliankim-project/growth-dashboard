import { useState, useCallback } from 'react'

const STORAGE_KEY = 'growth_config_v4'   // v4: 빌트인 숨기기 + 서브 데이터소스

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
  subTypes: {},  // { 'section.sub': 'report' | 'simulation' | 'funnel' | 'cohort' }
  /* ── 앱 설정 ── */
  projectName: 'Growth HQ',
  logoUrl: null,      // base64 이미지 or null
  /* ── 아이콘 오버라이드 ── */
  sectionIcons: {},        // { 'sectionId': 'IconName' }
  subIcons: {},        // { 'sectionId.subId': 'IconName' }
  l3subIcons: {},        // { 'sectionId.subId.l3subId': 'IconName' }
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
      { id: 'a1', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'a2', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'a3', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'a4', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'a5', defaultType: 'timeseries', span: 'col-span-4', row: 1 },
      { id: 'a6', defaultType: 'bar', span: 'col-span-2', row: 2 },
      { id: 'a7', defaultType: 'table', span: 'col-span-2', row: 2 },
    ],
  },
  B: {
    id: 'B', name: 'Template B',
    desc: 'KPI 3개 · 도넛 · 시계열',
    preview: '▦▦▦◎ / ────────',
    slots: [
      { id: 'b1', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'b2', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'b3', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'b4', defaultType: 'donut', span: 'col-span-1', row: 0 },
      { id: 'b5', defaultType: 'timeseries', span: 'col-span-4', row: 1 },
      { id: 'b6', defaultType: 'bar', span: 'col-span-4', row: 2 },
    ],
  },
  C: {
    id: 'C', name: 'Template C',
    desc: 'KPI 4개 · 시계열 + 도넛 · 테이블',
    preview: '▦▦▦▦ / ──◎ / ▤▤▤',
    slots: [
      { id: 'c1', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'c2', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'c3', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'c4', defaultType: 'kpi', span: 'col-span-1', row: 0 },
      { id: 'c5', defaultType: 'timeseries', span: 'col-span-3', row: 1 },
      { id: 'c6', defaultType: 'donut', span: 'col-span-1', row: 1 },
      { id: 'c7', defaultType: 'table', span: 'col-span-4', row: 2 },
    ],
  },
  D: {
    id: 'D', name: 'Template D',
    desc: '미니멀 — KPI 6개 · 시계열',
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
      { id: 'd9', defaultType: 'timeseries', span: 'col-span-4', row: 2 },
    ],
  },
}

/* ──────────────────────────────────────────
   위젯 타입
─────────────────────────────────────────── */
export const WIDGET_TYPES = [
  { id: 'kpi', label: 'KPI 카드', icon: '💳' },
  { id: 'timeseries', label: '시계열 차트', icon: '📈' },
  { id: 'bar', label: '바 차트', icon: '📊' },
  { id: 'donut', label: '도넛 차트', icon: '🍩' },
  { id: 'table', label: '데이터 테이블', icon: '📋' },
]

/* ──────────────────────────────────────────
   서브탭 타입 (L2 용도별 카테고리)
─────────────────────────────────────────── */
export const SUB_TYPES = {
  report: {
    id: 'report',
    label: '리포트',
    icon: '📊',
    desc: 'KPI, 차트, 테이블 기반 리포트',
    colorClasses: {
      badge:     'bg-indigo-500/15 text-indigo-400',
      badgeLight:'bg-indigo-50 text-indigo-600',
      dot:       'bg-indigo-400',
      btnActive: 'bg-indigo-600 text-white',
      btnIdle:   'bg-[#1A1D27] text-slate-400 hover:bg-indigo-500/10',
      btnIdleLight: 'bg-slate-50 text-slate-500 hover:bg-indigo-50',
    },
    widgetTypes: ['kpi', 'timeseries', 'bar', 'donut', 'table'],
  },
  simulation: {
    id: 'simulation',
    label: '시뮬레이션',
    icon: '🎯',
    desc: '목표 설정, 예산 배분, 시나리오 비교',
    colorClasses: {
      badge:     'bg-amber-500/15 text-amber-400',
      badgeLight:'bg-amber-50 text-amber-600',
      dot:       'bg-amber-400',
      btnActive: 'bg-amber-600 text-white',
      btnIdle:   'bg-[#1A1D27] text-slate-400 hover:bg-amber-500/10',
      btnIdleLight: 'bg-slate-50 text-slate-500 hover:bg-amber-50',
    },
    widgetTypes: ['kpi', 'timeseries', 'bar', 'table'],
  },
  funnel: {
    id: 'funnel',
    label: '퍼널',
    icon: '🔻',
    desc: '단계별 전환율 퍼널 시각화',
    colorClasses: {
      badge:     'bg-emerald-500/15 text-emerald-400',
      badgeLight:'bg-emerald-50 text-emerald-600',
      dot:       'bg-emerald-400',
      btnActive: 'bg-emerald-600 text-white',
      btnIdle:   'bg-[#1A1D27] text-slate-400 hover:bg-emerald-500/10',
      btnIdleLight: 'bg-slate-50 text-slate-500 hover:bg-emerald-50',
    },
    widgetTypes: ['kpi', 'bar', 'table'],
  },
  cohort: {
    id: 'cohort',
    label: '코호트',
    icon: '🔷',
    desc: '코호트/리텐션 분석',
    colorClasses: {
      badge:     'bg-violet-500/15 text-violet-400',
      badgeLight:'bg-violet-50 text-violet-600',
      dot:       'bg-violet-400',
      btnActive: 'bg-violet-600 text-white',
      btnIdle:   'bg-[#1A1D27] text-slate-400 hover:bg-violet-500/10',
      btnIdleLight: 'bg-slate-50 text-slate-500 hover:bg-violet-50',
    },
    widgetTypes: ['kpi', 'timeseries', 'table'],
  },
  kanban: {
    id: 'kanban',
    label: '칸반',
    icon: '📋',
    desc: '캠페인/태스크 칸반 보드',
    colorClasses: {
      badge:     'bg-rose-500/15 text-rose-400',
      badgeLight:'bg-rose-50 text-rose-600',
      dot:       'bg-rose-400',
      btnActive: 'bg-rose-600 text-white',
      btnIdle:   'bg-[#1A1D27] text-slate-400 hover:bg-rose-500/10',
      btnIdleLight: 'bg-slate-50 text-slate-500 hover:bg-rose-50',
    },
    widgetTypes: [],
  },
}

export const DEFAULT_SUB_TYPE = 'report'

/* ──────────────────────────────────────────
   지표 목록
   group: 'metric' = 원시 지표 / 'rate' = 단가·비율 파생지표
─────────────────────────────────────────── */
export const METRICS = [
  /* ── 지표 (원시) ── */
  { id: 'cost', label: '광고비', field: 'spend', fmt: 'currency', group: 'metric' },
  { id: 'impr', label: '노출', field: 'impressions', fmt: 'number', group: 'metric' },
  { id: 'clicks', label: '클릭', field: 'clicks', fmt: 'number', group: 'metric' },
  { id: 'view_content', label: '상세페이지 조회', field: 'view_content', fmt: 'number', group: 'metric' },
  { id: 'signup', label: '회원가입', field: 'signups', fmt: 'number', group: 'metric' },
  { id: 'conv', label: '구매', field: 'purchases', fmt: 'number', group: 'metric' },
  { id: 'revenue', label: '매출', field: 'revenue', fmt: 'currency', group: 'metric' },
  { id: 'installs', label: '인스톨', field: 'installs', fmt: 'number', group: 'metric' },
  /* ── 단가 / 비율 (파생) ── */
  { id: 'cpm', label: 'CPM', field: null, fmt: 'currency', group: 'rate', derived: true },
  { id: 'cpc', label: 'CPC', field: 'cpc', fmt: 'currency', group: 'rate' },
  { id: 'ctr', label: 'CTR', field: null, fmt: 'pct', group: 'rate', derived: true },
  { id: 'cpa_view', label: 'CPA(조회)', field: null, fmt: 'currency', group: 'rate', derived: true },
  { id: 'cac', label: 'CAC', field: null, fmt: 'currency', group: 'rate', derived: true },
  { id: 'cps', label: 'CPS', field: null, fmt: 'currency', group: 'rate', derived: true },
  { id: 'roas', label: 'ROAS', field: null, fmt: 'roas', group: 'rate', derived: true },
]

/* 파생지표 계산에 필요한 기반 지표 ID */
export const DERIVED_BASE_METRICS = ['cost', 'impr', 'clicks', 'view_content', 'signup', 'conv', 'revenue']

/* GROUP_BY: DB 컬럼명 snake_case 사용 */
export const GROUP_BY = [
  { id: 'channel', label: '채널' },
  { id: 'campaign', label: '캠페인' },
  { id: 'ad_group', label: '광고그룹' },
  { id: 'ad_creative', label: '크리에이티브' },
]

/* ──────────────────────────────────────────
   기본 위젯 config
─────────────────────────────────────────── */
export const DEFAULT_WIDGET_CONFIG = {
  kpi: { metric: 'cost', label: '' },
  timeseries: { metrics: ['cost', 'revenue'], title: '일별 트렌드' },
  bar: { metric: 'cost', groupBy: 'channel', title: '채널별 성과' },
  donut: { metric: 'cost', groupBy: 'channel', title: '구성 비율' },
  table: { metrics: ['cost', 'installs', 'conv', 'revenue'], groupBy: 'channel', title: '성과 테이블' },
}

/* ──────────────────────────────────────────
   타입별 템플릿 정의
─────────────────────────────────────────── */
export const TYPE_TEMPLATES = {
  report: Object.values(TEMPLATES).map(t => ({ id: t.id, name: t.name, desc: t.desc, preview: t.preview })),
  simulation: [
    { id: 'SIM_BUDGET', name: '예산 배분', desc: '채널별 예산 최적화 시뮬레이션', preview: '📊 예산 → 성과 예측' },
    { id: 'SIM_TARGET', name: '목표 역산', desc: '목표 매출/전환에서 필요 예산 역산', preview: '🎯 목표 → 필요 예산' },
  ],
  funnel: [
    { id: 'FNL_MARKETING', name: '마케팅 퍼널', desc: '노출 → 클릭 → 조회 → 가입 → 구매', preview: '🔻 노출 ▸ 클릭 ▸ 가입 ▸ 구매' },
    { id: 'FNL_CUSTOM', name: '커스텀 퍼널', desc: '직접 단계를 정의합니다', preview: '✏️ 단계 직접 설정' },
  ],
  cohort: [
    { id: 'COH_WEEKLY', name: '주간 코호트', desc: '주 단위 가입 → 리텐션 분석', preview: '📅 주간 가입 코호트' },
    { id: 'COH_MONTHLY', name: '월간 코호트', desc: '월 단위 가입 → 리텐션 분석', preview: '📅 월간 가입 코호트' },
  ],
  kanban: [
    { id: 'KAN_CAMPAIGN', name: '캠페인 관리', desc: '기획 → 진행중 → 분석 → 완료', preview: '📋 기획 | 진행중 | 분석 | 완료' },
    { id: 'KAN_SIMPLE', name: '심플 보드', desc: 'To Do → Doing → Done', preview: '📋 To Do | Doing | Done' },
  ],
}

/* ──────────────────────────────────────────
   대시보드 초기값 생성 (타입별)
─────────────────────────────────────────── */
export function makeDashboard(subType = 'report', templateId = null) {
  if (subType === 'report' || !subType) return { slots: [] }

  if (subType === 'simulation') {
    const mode = templateId === 'SIM_TARGET' ? 'target' : 'budget'
    return { type: 'simulation', mode, channels: [], totalBudget: 0, targetMetric: 'revenue', targetValue: 0, scenarios: [] }
  }
  if (subType === 'funnel') {
    if (templateId === 'FNL_CUSTOM') {
      return { type: 'funnel', stages: [
        { id: 's1', label: '단계 1', metric: 'impr' },
        { id: 's2', label: '단계 2', metric: 'clicks' },
      ]}
    }
    return { type: 'funnel', stages: [
      { id: 's1', label: '노출', metric: 'impr' },
      { id: 's2', label: '클릭', metric: 'clicks' },
      { id: 's3', label: '상세조회', metric: 'view_content' },
      { id: 's4', label: '가입', metric: 'signup' },
      { id: 's5', label: '구매', metric: 'conv' },
    ]}
  }
  if (subType === 'cohort') {
    const granularity = templateId === 'COH_MONTHLY' ? 'month' : 'week'
    return { type: 'cohort', granularity, cohortEvent: 'signup', retentionEvent: 'conv', periods: granularity === 'month' ? 6 : 8 }
  }
  if (subType === 'kanban') {
    if (templateId === 'KAN_CAMPAIGN') {
      return { type: 'kanban', columns: [
        { id: 'c1', title: '기획', cards: [] },
        { id: 'c2', title: '진행중', cards: [] },
        { id: 'c3', title: '분석', cards: [] },
        { id: 'c4', title: '완료', cards: [] },
      ]}
    }
    return { type: 'kanban', columns: [
      { id: 'c1', title: 'To Do', cards: [] },
      { id: 'c2', title: 'In Progress', cards: [] },
      { id: 'c3', title: 'Done', cards: [] },
    ]}
  }
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

function migrateConfig(raw) {
  const merged = { ...DEFAULT_CONFIG, ...raw }
  if (!merged.subTypes) merged.subTypes = {}
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

  /** persist: updater 함수를 받아 최신 state 기반으로 업데이트 (stale closure 방지) */
  const persist = useCallback(updater => {
    _setConfig(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { }
      return next
    })
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

  /* ── L2 서브 타입 ── */
  const getSubType = (sectionId, subId) =>
    config.subTypes?.[`${sectionId}.${subId}`] || DEFAULT_SUB_TYPE

  const setSubType = (sectionId, subId, subType) =>
    persist(prev => ({
      ...prev,
      subTypes: { ...(prev.subTypes || {}), [`${sectionId}.${subId}`]: subType },
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
        subTypes: filterOut(prev.subTypes),
      }
    })
  }

  /* ── L2 커스텀 서브탭 ── */
  const addCustomSub = (sectionId, label, subType = 'report') => {
    const id = `cx_${Date.now()}`
    persist(prev => {
      const cur = prev.customSubs[sectionId] || []
      return {
        ...prev,
        customSubs: { ...prev.customSubs, [sectionId]: [...cur, { id, label }] },
        subTypes: { ...(prev.subTypes || {}), [`${sectionId}.${id}`]: subType },
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
      const st = { ...(prev.subTypes || {}) }
      delete st[l3Key]
      return {
        ...prev,
        customSubs: { ...prev.customSubs, [sectionId]: cur.filter(s => s.id !== subId) },
        dashboards: dash,
        l3tabs: l3t,
        l3subs: l3s,
        subDataSources: ds,
        subTypes: st,
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

  const addL3Tab = (sid, sub, label, l3sub = null, subType = 'report', templateId = null) => {
    const id = `t3_${Date.now()}`
    const scope = _tabsScope(sid, sub, l3sub)
    const dash = makeDashboard(subType, templateId)
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

  return {
    config,
    getSectionLabel, getSubLabel, getCustomSubs, getDashboard, saveDashboard,
    setSectionLabel, setSubLabel,
    setProjectName, setLogoUrl,
    setSectionIcon, setSubIcon, setL3SubIcon,
    getCustomSections, addCustomSection, removeCustomSection,
    addCustomSub, removeCustomSub,
    hideBuiltinSub, showBuiltinSub, isBuiltinSubHidden,
    getSubType, setSubType,
    getSubDataSource, setSubDataSource,
    getL3Subs, addL3Sub, removeL3Sub, renameL3Sub, reorderL3Subs,
    getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab, reorderL3Tabs,
  }
}
