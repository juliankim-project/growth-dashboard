/**
 * dashboardTemplates.js — 대시보드 위젯 템플릿 정의 + 생성 함수
 */
import { buildWidgetMetrics, buildWidgetGroupBy } from './columnUtils'

/* ═══════════════════════════════════════════
   4개 사전 정의 템플릿
   ═══════════════════════════════════════════ */
export const DASHBOARD_TEMPLATES = [
  {
    id: 'core_kpi',
    name: '핵심 KPI 대시보드',
    desc: 'KPI 4개 + 시계열 트렌드 + 바/도넛 차트',
    icon: '📊',
    slotDefs: [
      { type: 'kpi',        widthPct: 25 },
      { type: 'kpi',        widthPct: 25 },
      { type: 'kpi',        widthPct: 25 },
      { type: 'kpi',        widthPct: 25 },
      { type: 'timeseries', widthPct: 100, heightPx: 320 },
      { type: 'bar',        widthPct: 50,  heightPx: 300 },
      { type: 'donut',      widthPct: 50,  heightPx: 300 },
    ],
  },
  {
    id: 'performance_report',
    name: '성과 분석 리포트',
    desc: 'KPI 3개 + 시계열/도넛 + 풀 테이블',
    icon: '📋',
    slotDefs: [
      { type: 'kpi',        widthPct: 33.33 },
      { type: 'kpi',        widthPct: 33.33 },
      { type: 'kpi',        widthPct: 33.33 },
      { type: 'timeseries', widthPct: 66.66, heightPx: 320 },
      { type: 'donut',      widthPct: 33.33, heightPx: 320 },
      { type: 'table',      widthPct: 100,   heightPx: 360 },
    ],
  },
  {
    id: 'channel_compare',
    name: '채널 비교',
    desc: 'KPI 2개 + 바 차트 + 도넛 2개 + 테이블',
    icon: '📈',
    slotDefs: [
      { type: 'kpi',   widthPct: 50 },
      { type: 'kpi',   widthPct: 50 },
      { type: 'bar',   widthPct: 100, heightPx: 300 },
      { type: 'donut', widthPct: 50,  heightPx: 280 },
      { type: 'donut', widthPct: 50,  heightPx: 280 },
      { type: 'table', widthPct: 100, heightPx: 360 },
    ],
  },
  {
    id: 'trend_monitoring',
    name: '트렌드 모니터링',
    desc: 'KPI 6개 + 시계열 2개 + 바/도넛/테이블',
    icon: '🔍',
    slotDefs: [
      { type: 'kpi',        widthPct: 16.66 },
      { type: 'kpi',        widthPct: 16.66 },
      { type: 'kpi',        widthPct: 16.66 },
      { type: 'kpi',        widthPct: 16.66 },
      { type: 'kpi',        widthPct: 16.66 },
      { type: 'kpi',        widthPct: 16.66 },
      { type: 'timeseries', widthPct: 50,    heightPx: 300 },
      { type: 'timeseries', widthPct: 50,    heightPx: 300 },
      { type: 'bar',        widthPct: 33.33, heightPx: 280 },
      { type: 'donut',      widthPct: 33.33, heightPx: 280 },
      { type: 'table',      widthPct: 33.33, heightPx: 280 },
    ],
  },
]

/* ═══════════════════════════════════════════
   generateDashboard — 템플릿 + 테이블 기반 대시보드 생성
   ═══════════════════════════════════════════ */
export function generateDashboard(template, tableName, columnConfig) {
  const metrics = buildWidgetMetrics(tableName, columnConfig)
  const groupBys = buildWidgetGroupBy(tableName, columnConfig)

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
    let config = {}

    switch (def.type) {
      case 'kpi':
        config = { metric: nextMetric(), label: '', _table: tableName }
        break
      case 'timeseries': {
        const count = Math.min(3, metrics.length)
        const mIds = Array.from({ length: count }, () => nextMetric())
        config = { metrics: mIds, title: '일별 트렌드', _table: tableName }
        break
      }
      case 'bar':
        config = { metric: nextMetric(), groupBy: firstGb, title: '채널별 성과', _table: tableName }
        break
      case 'donut':
        config = { metric: nextMetric(), groupBy: firstGb, title: '구성 비율', _table: tableName }
        break
      case 'table': {
        const count = Math.min(4, metrics.length)
        const mIds = Array.from({ length: count }, () => nextMetric())
        config = { metrics: mIds, groupBy: firstGb, title: '성과 테이블', _table: tableName }
        break
      }
      default:
        config = { _table: tableName }
    }

    return {
      id: `w_${now}_${idx}`,
      widthPct: def.widthPct,
      ...(def.heightPx ? { heightPx: def.heightPx } : {}),
      type: def.type,
      config,
    }
  })

  return { slots }
}
