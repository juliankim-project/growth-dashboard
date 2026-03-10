/**
 * dashboardTemplates.js — 대시보드 위젯 템플릿 정의 + 생성 함수
 */
import { buildWidgetMetrics, buildWidgetGroupBy } from './columnUtils'

/* ═══════════════════════════════════════════
   6개 사전 정의 템플릿
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
      table: tableName,
      config,
    }
  })

  return { slots }
}
