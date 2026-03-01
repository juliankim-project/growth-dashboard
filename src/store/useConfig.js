import { useState, useCallback } from 'react'

const STORAGE_KEY = 'growth_config_v3'   // v3: L3 tab 지원

/* ──────────────────────────────────────────
   기본 설정
─────────────────────────────────────────── */
export const DEFAULT_CONFIG = {
  sectionLabels: {},   // { 'marketing': '퍼포먼스' }
  subLabels:     {},   // { 'marketing.performance': '매체별 분석' }
  customSubs:    {},   // { 'marketing': [{id, label}] }
  dashboards:    {},   // { 'section.sub.tabId': { template, widgets } }
  l3tabs:        {},   // { 'section.sub': [{id, label}] }
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
─────────────────────────────────────────── */
export const METRICS = [
  { id:'cost',     label:'광고비',   field:'Cost (Channel)',        fmt:'currency' },
  { id:'revenue',  label:'매출',     field:'구매액 (App+Web)',       fmt:'currency' },
  { id:'roas',     label:'ROAS',     field:null,                   fmt:'roas',    derived:true },
  { id:'installs', label:'인스톨',   field:'Installs (App)',        fmt:'number' },
  { id:'conv',     label:'구매',     field:'구매 완료 (App+Web)',    fmt:'number' },
  { id:'signup',   label:'회원가입', field:'회원가입 (App+Web)',     fmt:'number' },
  { id:'impr',     label:'노출',     field:'Impressions (Channel)', fmt:'number' },
  { id:'clicks',   label:'클릭',     field:'Clicks (Channel)',      fmt:'number' },
  { id:'ctr',      label:'CTR',      field:null,                   fmt:'pct',     derived:true },
  { id:'cpc',      label:'CPC',      field:'CPC (Channel)',         fmt:'currency' },
]

/* GROUP_BY: channel은 DB 컬럼명 그대로 소문자 사용 */
export const GROUP_BY = [
  { id:'channel',     label:'채널'        },
  { id:'Campaign',    label:'캠페인'      },
  { id:'Ad Group',    label:'광고그룹'    },
  { id:'Ad Creative', label:'크리에이티브' },
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
   대시보드 초기값 생성 (템플릿 기반)
─────────────────────────────────────────── */
export function makeDashboard(templateId = 'A') {
  const tpl = TEMPLATES[templateId]
  const widgets = {}
  const KPI_METRICS = ['cost','revenue','roas','installs','conv','signup','impr','clicks']
  let kpiIdx = 0
  tpl.slots.forEach(slot => {
    const type = slot.defaultType
    const cfg  = { ...DEFAULT_WIDGET_CONFIG[type] }
    if (type === 'kpi') {
      cfg.metric = KPI_METRICS[kpiIdx % KPI_METRICS.length]
      cfg.label  = METRICS.find(m => m.id === cfg.metric)?.label || ''
      kpiIdx++
    }
    widgets[slot.id] = { type, config: cfg }
  })
  return { template: templateId, widgets, dataSource: { table: 'marketing_perf' } }
}

/* ──────────────────────────────────────────
   React Hook
─────────────────────────────────────────── */
export function useConfig() {
  const [config, _setConfig] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      return { ...DEFAULT_CONFIG, ...raw }
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
    const cur  = config.customSubs[sectionId] || []
    // L3 탭 및 대시보드도 정리
    const l3Key = `${sectionId}.${subId}`
    const l3tabs = config.l3tabs[l3Key] || []
    const dash = { ...config.dashboards }
    l3tabs.forEach(t => { delete dash[`${l3Key}.${t.id}`] })
    const l3 = { ...config.l3tabs }
    delete l3[l3Key]
    persist({
      ...config,
      customSubs: { ...config.customSubs, [sectionId]: cur.filter(s => s.id !== subId) },
      dashboards: dash,
      l3tabs: l3,
    })
  }

  /* ── L3 탭 ── */
  const getL3Tabs = (sid, sub) =>
    config.l3tabs[`${sid}.${sub}`] || []

  const addL3Tab = (sid, sub, label) => {
    const id    = `t3_${Date.now()}`
    const l3Key = `${sid}.${sub}`
    const cur   = config.l3tabs[l3Key] || []
    const dash  = makeDashboard('A')
    persist({
      ...config,
      l3tabs:     { ...config.l3tabs,     [l3Key]:           [...cur, { id, label }] },
      dashboards: { ...config.dashboards, [`${l3Key}.${id}`]: dash                  },
    })
    return id
  }

  const removeL3Tab = (sid, sub, tabId) => {
    const l3Key = `${sid}.${sub}`
    const cur   = config.l3tabs[l3Key] || []
    const dash  = { ...config.dashboards }
    delete dash[`${l3Key}.${tabId}`]
    persist({
      ...config,
      l3tabs:     { ...config.l3tabs, [l3Key]: cur.filter(t => t.id !== tabId) },
      dashboards: dash,
    })
  }

  const renameL3Tab = (sid, sub, tabId, label) => {
    const l3Key = `${sid}.${sub}`
    const cur   = config.l3tabs[l3Key] || []
    persist({
      ...config,
      l3tabs: {
        ...config.l3tabs,
        [l3Key]: cur.map(t => t.id === tabId ? { ...t, label } : t),
      },
    })
  }

  /* ── 대시보드 (L3 tabId 지원) ── */
  const getDashboard = (sid, sub, tabId = null) => {
    const key = tabId ? `${sid}.${sub}.${tabId}` : `${sid}.${sub}`
    return config.dashboards[key] || null
  }

  const saveDashboard = (sid, sub, dashboard, tabId = null) => {
    const key = tabId ? `${sid}.${sub}.${tabId}` : `${sid}.${sub}`
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
    addCustomSub, removeCustomSub,
    getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab,
  }
}
