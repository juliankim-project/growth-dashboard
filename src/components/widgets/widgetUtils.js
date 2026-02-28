import { METRICS } from '../../store/useConfig'

export const fmtW = n => {
  if (n == null || isNaN(n)) return '—'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000)      return (n / 10_000).toFixed(1) + '만'
  return Math.round(n).toLocaleString()
}
export const fmt  = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString()
export const fmtP = n => (n == null || isNaN(n)) ? '—' : n.toFixed(2) + '%'

export const sumField = (data, field) =>
  data.reduce((s, r) => s + (parseFloat(r[field]) || 0), 0)

/* 지표 ID → 값 계산 */
export function calcMetric(data, metricId) {
  const m = METRICS.find(x => x.id === metricId)
  if (!m) return 0
  if (m.derived) {
    if (metricId === 'roas') {
      const cost = sumField(data, 'Cost (Channel)')
      const rev  = sumField(data, '구매액 (App+Web)')
      return cost > 0 ? rev / cost : 0
    }
    if (metricId === 'ctr') {
      const impr  = sumField(data, 'Impressions (Channel)')
      const click = sumField(data, 'Clicks (Channel)')
      return impr > 0 ? (click / impr) * 100 : 0
    }
    return 0
  }
  return sumField(data, m.field)
}

/* 포맷 */
export function fmtMetric(metricId, value) {
  const m = METRICS.find(x => x.id === metricId)
  if (!m) return String(value)
  if (m.fmt === 'currency') return fmtW(value)
  if (m.fmt === 'roas')     return value.toFixed(2) + 'x'
  if (m.fmt === 'pct')      return value.toFixed(2) + '%'
  return fmt(value)
}

/* 그룹핑 */
export function groupData(data, groupByField, metrics) {
  const map = {}
  data.forEach(r => {
    const k = r[groupByField] || '(없음)'
    if (!map[k]) {
      map[k] = { name: k }
      metrics.forEach(mid => { map[k][mid] = 0 })
    }
    metrics.forEach(mid => {
      const m = METRICS.find(x => x.id === mid)
      if (m && !m.derived && m.field) {
        map[k][mid] += parseFloat(r[m.field]) || 0
      }
    })
  })
  // derived
  Object.values(map).forEach(row => {
    if (metrics.includes('roas')) row.roas = row.cost > 0 ? (row.revenue / row.cost) : 0
    if (metrics.includes('ctr'))  row.ctr  = row.impr  > 0 ? (row.clicks  / row.impr ) * 100 : 0
  })
  return Object.values(map)
}

/* 일별 집계 */
export function dailyData(data, metrics) {
  const map = {}
  data.forEach(r => {
    const d = r['Event Date']?.slice(0, 10)
    if (!d) return
    if (!map[d]) { map[d] = { label: d.slice(5) }; metrics.forEach(mid => { map[d][mid] = 0 }) }
    metrics.forEach(mid => {
      const m = METRICS.find(x => x.id === mid)
      if (m && !m.derived && m.field) map[d][mid] += parseFloat(r[m.field]) || 0
    })
  })
  return Object.values(map).sort((a, b) => a.label.localeCompare(b.label)).slice(-60)
}

export const CHART_COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899']
