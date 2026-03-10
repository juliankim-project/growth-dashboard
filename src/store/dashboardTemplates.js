/**
 * dashboardTemplates.js — 대시보드 위젯 템플릿 정의 + 생성 함수
 */
import { buildWidgetMetrics, buildWidgetGroupBy } from './columnUtils'

/* ═══════════════════════════════════════════
   사전 정의 템플릿
   ═══════════════════════════════════════════ */
export const DASHBOARD_TEMPLATES = [
  {
    id: 'core_kpi',
    name: '핵심 KPI 대시보드',
    desc: 'KPI 4개 + 라인 트렌드 + 바/파이 차트',
    icon: '📊',
    slotDefs: [
      { type: 'kpi',   widthPct: 25 },
      { type: 'kpi',   widthPct: 25 },
      { type: 'kpi',   widthPct: 25 },
      { type: 'kpi',   widthPct: 25 },
      { type: 'line',  widthPct: 100, heightPx: 320 },
      { type: 'bar',   widthPct: 50,  heightPx: 300 },
      { type: 'pie',   widthPct: 50,  heightPx: 300 },
    ],
  },
  {
    id: 'performance_report',
    name: '성과 분석 리포트',
    desc: 'KPI 3개 + 라인/파이 + 풀 테이블',
    icon: '📋',
    slotDefs: [
      { type: 'kpi',   widthPct: 33.33 },
      { type: 'kpi',   widthPct: 33.33 },
      { type: 'kpi',   widthPct: 33.33 },
      { type: 'line',  widthPct: 66.66, heightPx: 320 },
      { type: 'pie',   widthPct: 33.33, heightPx: 320 },
      { type: 'table', widthPct: 100,   heightPx: 360 },
    ],
  },
  {
    id: 'channel_compare',
    name: '채널 비교',
    desc: 'KPI 2개 + 바 차트 + 파이 2개 + 테이블',
    icon: '📈',
    slotDefs: [
      { type: 'kpi',   widthPct: 50 },
      { type: 'kpi',   widthPct: 50 },
      { type: 'bar',   widthPct: 100, heightPx: 300 },
      { type: 'pie',   widthPct: 50,  heightPx: 280 },
      { type: 'pie',   widthPct: 50,  heightPx: 280 },
      { type: 'table', widthPct: 100, heightPx: 360 },
    ],
  },
  {
    id: 'trend_monitoring',
    name: '트렌드 모니터링',
    desc: 'KPI 6개 + 라인 2개 + 바/파이/테이블',
    icon: '🔍',
    slotDefs: [
      { type: 'kpi',   widthPct: 16.66 },
      { type: 'kpi',   widthPct: 16.66 },
      { type: 'kpi',   widthPct: 16.66 },
      { type: 'kpi',   widthPct: 16.66 },
      { type: 'kpi',   widthPct: 16.66 },
      { type: 'kpi',   widthPct: 16.66 },
      { type: 'line',  widthPct: 50,    heightPx: 300 },
      { type: 'line',  widthPct: 50,    heightPx: 300 },
      { type: 'bar',   widthPct: 33.33, heightPx: 280 },
      { type: 'pie',   widthPct: 33.33, heightPx: 280 },
      { type: 'table', widthPct: 33.33, heightPx: 280 },
    ],
  },
  {
    id: 'performance_monitor',
    name: '성과 모니터링',
    desc: 'KPI 4개 + 알림 모니터 + 랭킹 + 라인',
    icon: '🚨',
    slotDefs: [
      { type: 'kpi',     widthPct: 25 },
      { type: 'kpi',     widthPct: 25 },
      { type: 'kpi',     widthPct: 25 },
      { type: 'kpi',     widthPct: 25 },
      { type: 'alert',   widthPct: 50,  heightPx: 300 },
      { type: 'ranking', widthPct: 50,  heightPx: 300 },
      { type: 'line',    widthPct: 100, heightPx: 320 },
    ],
  },
  {
    id: 'executive_summary',
    name: '경영 요약',
    desc: 'KPI 4개 + 비교 분석 + 파이 + 타임라인',
    icon: '⏱️',
    slotDefs: [
      { type: 'kpi',        widthPct: 25 },
      { type: 'kpi',        widthPct: 25 },
      { type: 'kpi',        widthPct: 25 },
      { type: 'kpi',        widthPct: 25 },
      { type: 'comparison', widthPct: 50,  heightPx: 320 },
      { type: 'pie',        widthPct: 50,  heightPx: 320 },
      { type: 'timeline',   widthPct: 100, heightPx: 300 },
    ],
  },
  /* ── OTA 채널별 OVERVIEW ── */
  {
    id: 'ota_overview',
    name: 'OTA OVERVIEW',
    desc: 'KPI 4개 + 기간비교 + 지역/지점 랭킹 + 트렌드 + 객실타입/테이블',
    icon: '🏨',
    defaultTable: 'product_revenue_raw',
    slotDefs: [
      /* Row 1 — KPI ×4 */
      { type: 'kpi', widthPct: 25, preset: { metric: 'payment_amount', label: '총 결제금액' } },
      { type: 'kpi', widthPct: 25, preset: { metric: 'cc_order_count', label: '결제건수' } },
      { type: 'kpi', widthPct: 25, preset: { metric: 'cc_adr', label: 'ADR' } },
      { type: 'kpi', widthPct: 25, preset: { metric: 'cc_los', label: 'LOS' } },
      /* Row 2 — 기간 비교 + 지역 파이 */
      { type: 'comparison', widthPct: 50, heightPx: 320,
        preset: { metrics: ['payment_amount', 'cc_order_count', 'cc_adr'], compareMode: 'period', title: '매출 기간 비교' } },
      { type: 'pie', widthPct: 50, heightPx: 320,
        preset: { metric: 'payment_amount', groupBy: 'area', title: '지역별 매출 비율' } },
      /* Row 3 — 지역 랭킹 + 지점 랭킹 */
      { type: 'ranking', widthPct: 50, heightPx: 340,
        preset: { metric: 'payment_amount', groupBy: 'area', topN: 10, sortDir: 'desc', title: '지역별 매출 랭킹' } },
      { type: 'ranking', widthPct: 50, heightPx: 340,
        preset: { metric: 'payment_amount', groupBy: 'branch_name', topN: 10, sortDir: 'desc', title: '지점별 매출 TOP10' } },
      /* Row 4 — 일별 트렌드 */
      { type: 'line', widthPct: 100, heightPx: 320,
        preset: { metrics: ['payment_amount', 'cc_order_count'], title: '일별 매출 트렌드' } },
      /* Row 5 — 객실타입 바 + 지점별 테이블 */
      { type: 'bar', widthPct: 50, heightPx: 300,
        preset: { metric: 'payment_amount', groupBy: 'room_type_name', title: '객실타입별 매출' } },
      { type: 'table', widthPct: 50, heightPx: 300,
        preset: { metrics: ['payment_amount', 'nights', 'cc_order_count', 'cc_adr'], groupBy: 'branch_name', title: '지점별 상세' } },
    ],
  },
]

/* ═══════════════════════════════════════════
   generateDashboard — 템플릿 + 테이블 기반 대시보드 생성
   preset이 있는 슬롯은 해당 config 그대로 사용,
   없으면 기존처럼 자동 할당
   ═══════════════════════════════════════════ */
export function generateDashboard(template, tableName, columnConfig) {
  /* 템플릿에 defaultTable이 있으면 우선 사용 */
  const tbl = template.defaultTable || tableName
  const metrics = buildWidgetMetrics(tbl, columnConfig)
  const groupBys = buildWidgetGroupBy(tbl, columnConfig)

  if (metrics.length === 0) return { slots: [] }

  const firstGb = groupBys[0]?.id || null
  let metricIdx = 0

  const nextMetric = () => {
    const m = metrics[metricIdx % metrics.length]
    metricIdx++
    return m.id
  }

  const now = Date.now()

  const slots = template.slotDefs.map((def, idx) => {
    /* ── preset이 있으면 그대로 사용 ── */
    if (def.preset) {
      return {
        id: `w_${now}_${idx}`,
        widthPct: def.widthPct,
        ...(def.heightPx ? { heightPx: def.heightPx } : {}),
        type: def.type,
        table: tbl,
        config: { ...def.preset },
      }
    }

    /* ── preset 없으면 기존 자동 할당 ── */
    let config = {}

    switch (def.type) {
      case 'kpi':
        config = { metric: nextMetric(), label: '' }
        break
      case 'line': {
        const count = Math.min(3, metrics.length)
        const mIds = Array.from({ length: count }, () => nextMetric())
        config = { metrics: mIds, title: '일별 트렌드' }
        break
      }
      case 'bar':
        config = { metric: nextMetric(), groupBy: firstGb, title: '채널별 성과' }
        break
      case 'pie':
        config = { metric: nextMetric(), groupBy: firstGb, title: '구성 비율' }
        break
      case 'table': {
        const count = Math.min(4, metrics.length)
        const mIds = Array.from({ length: count }, () => nextMetric())
        config = { metrics: mIds, groupBy: firstGb, title: '성과 테이블' }
        break
      }
      case 'funnel':
        config = {
          stages: metrics.slice(0, Math.min(4, metrics.length)).map((m, i) => ({
            id: `s${i + 1}`, label: m.label, metric: m.id,
          })),
          title: '전환 퍼널',
        }
        break
      case 'comparison': {
        const count = Math.min(3, metrics.length)
        const mIds = Array.from({ length: count }, () => nextMetric())
        config = { metrics: mIds, compareMode: 'period', title: '기간 비교' }
        break
      }
      case 'ranking':
        config = { metric: nextMetric(), groupBy: firstGb, topN: 10, sortDir: 'desc', title: '랭킹' }
        break
      case 'alert': {
        const count = Math.min(4, metrics.length)
        const mIds = Array.from({ length: count }, () => nextMetric())
        const thresholds = {}
        mIds.forEach(id => { thresholds[id] = { good: 0, warning: 0 } })
        config = { metrics: mIds, thresholds, title: '알림 모니터' }
        break
      }
      case 'timeline': {
        const count = Math.min(4, metrics.length)
        const mIds = Array.from({ length: count }, () => nextMetric())
        config = { metrics: mIds, title: '트렌드 요약' }
        break
      }
      default:
        config = {}
    }

    return {
      id: `w_${now}_${idx}`,
      widthPct: def.widthPct,
      ...(def.heightPx ? { heightPx: def.heightPx } : {}),
      type: def.type,
      table: tbl,
      config,
    }
  })

  return { slots }
}

/* ═══════════════════════════════════════════
   dashboardToTemplate — 현재 대시보드 → 커스텀 템플릿 변환
   layout 제거, config → preset 매핑
   ═══════════════════════════════════════════ */
export function dashboardToTemplate(dashboard, name, icon = '📌') {
  const slots = dashboard?.slots || []
  const tables = [...new Set(slots.map(s => s.table).filter(Boolean))]

  const slotDefs = slots.map(s => ({
    type: s.type,
    widthPct: s.widthPct,
    ...(s.heightPx ? { heightPx: s.heightPx } : {}),
    preset: { ...s.config },
  }))

  return {
    id: `ct_${Date.now()}`,
    name,
    icon,
    defaultTable: tables[0] || null,
    slotDefs,
  }
}
