import { useState, useCallback } from 'react'

const STORAGE_KEY = 'growth_config_v2'

/* ──────────────────────────────────────────
   기본 설정 (변경 전 초기값)
─────────────────────────────────────────── */
export const DEFAULT_CONFIG = {
  sectionLabels: {},   // { 'marketing': '퍼포먼스' }
  subLabels:     {},   // { 'marketing.performance': '매체별 분석' }
  customSubs:    {},   // { 'marketing': [{id, label}] }
  dashboards:    {},   // { 'marketing.my_tab': { template, widgets } }
}

/* ──────────────────────────────────────────
   템플릿 정의
─────────────────────────────────────────── */
export const TEMPLATES = {
  A: {
    id: 'A',
    name: 'Template A',
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
    id: 'B',
    name: 'Template B',
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
    id: 'C',
    name: 'Template C',
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
    id: 'D',
    name: 'Template D',
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
   위젯 타입 정의
─────────────────────────────────────────── */
export const WIDGET_TYPES = [
  { id:'kpi',        label:'KPI 카드',    icon:'💳' },
  { id:'timeseries', label:'시계열 차트', icon:'📈' },
  { id:'bar',        label:'바 차트',     icon:'📊' },
  { id:'donut',      label:'도넛 차트',   icon:'🍩' },
  { id:'table',      label:'데이터 테이블', icon:'📋' },
]

/* ──────────────────────────────────────────
   지표 목록
─────────────────────────────────────────── */
export const METRICS = [
  { id:'cost',     label:'광고비',    field:'Cost (Channel)',       fmt:'currency' },
  { id:'revenue',  label:'매출',      field:'구매액 (App+Web)',      fmt:'currency' },
  { id:'roas',     label:'ROAS',      field:null,                  fmt:'roas',    derived:true },
  { id:'installs', label:'인스톨',    field:'Installs (App)',       fmt:'number' },
  { id:'conv',     label:'구매',      field:'구매 완료 (App+Web)',   fmt:'number' },
  { id:'signup',   label:'회원가입',  field:'회원가입 (App+Web)',    fmt:'number' },
  { id:'impr',     label:'노출',      field:'Impressions (Channel)', fmt:'number' },
  { id:'clicks',   label:'클릭',      field:'Clicks (Channel)',     fmt:'number' },
  { id:'ctr',      label:'CTR',       field:null,                  fmt:'pct',     derived:true },
  { id:'cpc',      label:'CPC',       field:'CPC (Channel)',        fmt:'currency' },
]

export const GROUP_BY = [
  { id:'Channel',    label:'채널' },
  { id:'Campaign',   label:'캠페인' },
  { id:'Ad Group',   label:'광고그룹' },
  { id:'Ad Creative',label:'크리에이티브' },
]

/* ──────────────────────────────────────────
   기본 위젯 config
─────────────────────────────────────────── */
export const DEFAULT_WIDGET_CONFIG = {
  kpi:        { metric:'cost',    label:'' },
  timeseries: { metrics:['cost','revenue'], title:'일별 트렌드' },
  bar:        { metric:'cost',    groupBy:'Channel', title:'채널별 성과' },
  donut:      { metric:'cost',    groupBy:'Channel', title:'구성 비율' },
  table:      { metrics:['cost','installs','conv','revenue'], groupBy:'Channel', title:'성과 테이블' },
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
    let cfg = { ...DEFAULT_WIDGET_CONFIG[type] }
    if (type === 'kpi') {
      cfg.metric = KPI_METRICS[kpiIdx % KPI_METRICS.length]
      cfg.label  = METRICS.find(m => m.id === cfg.metric)?.label || ''
      kpiIdx++
    }
    widgets[slot.id] = { type, config: cfg }
  })
  return { template: templateId, widgets }
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

  /* 섹션 라벨 변경 */
  const setSectionLabel = (id, label) =>
    persist({ ...config, sectionLabels: { ...config.sectionLabels, [id]: label } })

  /* 서브 라벨 변경 */
  const setSubLabel = (sectionId, subId, label) =>
    persist({ ...config, subLabels: { ...config.subLabels, [`${sectionId}.${subId}`]: label } })

  /* 커스텀 서브탭 추가 */
  const addCustomSub = (sectionId, label) => {
    const id  = `cx_${Date.now()}`
    const cur = config.customSubs[sectionId] || []
    const dashboard = makeDashboard('A')
    persist({
      ...config,
      customSubs: { ...config.customSubs, [sectionId]: [...cur, { id, label }] },
      dashboards: { ...config.dashboards, [`${sectionId}.${id}`]: dashboard },
    })
    return id
  }

  /* 커스텀 서브탭 삭제 */
  const removeCustomSub = (sectionId, subId) => {
    const cur  = config.customSubs[sectionId] || []
    const dash = { ...config.dashboards }
    delete dash[`${sectionId}.${subId}`]
    persist({
      ...config,
      customSubs: { ...config.customSubs, [sectionId]: cur.filter(s => s.id !== subId) },
      dashboards: dash,
    })
  }

  /* 대시보드 저장 */
  const saveDashboard = (sectionId, subId, dashboard) =>
    persist({ ...config, dashboards: { ...config.dashboards, [`${sectionId}.${subId}`]: dashboard } })

  /* 라벨 getter */
  const getSectionLabel = id => config.sectionLabels[id] || null
  const getSubLabel     = (sid, sub) => config.subLabels[`${sid}.${sub}`] || null
  const getCustomSubs   = sid => config.customSubs[sid] || []
  const getDashboard    = (sid, sub) => config.dashboards[`${sid}.${sub}`] || null

  return {
    config,
    getSectionLabel, getSubLabel, getCustomSubs, getDashboard,
    setSectionLabel, setSubLabel,
    addCustomSub, removeCustomSub,
    saveDashboard,
  }
}
