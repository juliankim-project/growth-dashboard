import { METRICS, DERIVED_BASE_METRICS } from '../../store/useConfig'

/* 차트 축 전용 - 축약 표기 (소수점 없음) */
export const fmtW = n => {
  if (n == null || isNaN(n)) return '—'
  if (n >= 100_000_000) return Math.round(n / 100_000_000) + '억'
  if (n >= 10_000)      return Math.round(n / 10_000) + '만'
  return Math.round(n).toLocaleString()
}
/* KPI/테이블 전용 - 풀 숫자 */
export const fmtNum = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString()
export const fmtKRW = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString() + '원'
export const fmtP   = n => (n == null || isNaN(n)) ? '—' : n.toFixed(1) + '%'

export const sumField = (data, field) =>
  data.reduce((s, r) => s + (parseFloat(r[field]) || 0), 0)

/* ─── 메트릭 리스트 해석 (동적 테이블 메트릭 지원) ─── */
const _m = (metricId, mo) => (mo || METRICS).find(x => x.id === metricId)

/* 지표 ID → 값 계산 (SUM / COUNT / AVG 지원) */
export function calcMetric(data, metricId, metricsOverride) {
  const m = _m(metricId, metricsOverride)
  if (!m) return 0
  /* COUNT(*) 계산 컬럼 */
  if (m._countType) return data.length
  /* 동적 테이블 메트릭 (계산 컬럼 포함) — agg 타입 반영 */
  if (m._computed || (m.field && m.field === m.id && !m.derived)) {
    const agg = m.agg || 'sum'
    if (agg === 'count') return data.length
    if (agg === 'avg') return data.length > 0 ? sumField(data, m.field) / data.length : 0
    return sumField(data, m.field)
  }
  if (m.derived) {
    const cost        = sumField(data, 'spend')
    const rev         = sumField(data, 'revenue')
    const impr        = sumField(data, 'impressions')
    const clicks      = sumField(data, 'clicks')
    const viewContent = sumField(data, 'view_content')
    const signup      = sumField(data, 'signups')
    const conv        = sumField(data, 'purchases')
    switch (metricId) {
      case 'roas':     return cost > 0        ? rev         / cost   : 0
      case 'ctr':      return impr > 0        ? (clicks     / impr)  * 100 : 0
      case 'cpm':      return impr > 0        ? (cost       / impr)  * 1000 : 0
      case 'cpa_view': return viewContent > 0 ? cost        / viewContent : 0
      case 'cac':      return signup > 0      ? cost        / signup : 0
      case 'cps':      return conv > 0        ? cost        / conv   : 0
      default:         return 0
    }
  }
  return sumField(data, m.field)
}

/* 포맷 - KPI/테이블 표시용 */
export function fmtMetric(metricId, value, metricsOverride) {
  const m = _m(metricId, metricsOverride)
  if (!m) return String(value)
  if (m.fmt === 'currency') return fmtKRW(value)
  if (m.fmt === 'roas')     return Math.round(value * 100).toLocaleString() + '%'
  if (m.fmt === 'pct')      return value.toFixed(1) + '%'
  return fmtNum(value)
}

/* 파생지표 계산 (그룹/일별 공통) — row에 기반 지표가 누적된 상태에서 호출
   legacy ID(cost, impr...) + 동적 컬럼명(spend, impressions...) 모두 지원 */
function calcDerived(row, metrics) {
  const c  = row.cost   ?? row.spend       ?? 0
  const rv = row.revenue ?? 0
  const im = row.impr   ?? row.impressions ?? 0
  const cl = row.clicks  ?? 0
  const vc = row.view_content ?? 0
  const sg = row.signup ?? row.signups     ?? 0
  const cv = row.conv   ?? row.purchases   ?? 0
  if (metrics.includes('roas'))     row.roas     = c  > 0  ? rv / c        : 0
  if (metrics.includes('ctr'))      row.ctr      = im > 0  ? (cl / im) * 100  : 0
  if (metrics.includes('cpm'))      row.cpm      = im > 0  ? (c  / im) * 1000 : 0
  if (metrics.includes('cpa_view')) row.cpa_view = vc > 0  ? c  / vc      : 0
  if (metrics.includes('cac'))      row.cac      = sg > 0  ? c  / sg      : 0
  if (metrics.includes('cps'))      row.cps      = cv > 0  ? c  / cv      : 0
  if (metrics.includes('cvr_c'))    row.cvr_c    = cl > 0  ? (sg / cl) * 100 : 0  // 클릭 대비 회원가입율
  if (metrics.includes('cvr_s'))    row.cvr_s    = cl > 0  ? (cv / cl) * 100 : 0  // 클릭 대비 전환율
}

/* 그룹핑 (SUM / COUNT / AVG 지원) */
export function groupData(data, groupByField, metrics, metricsOverride) {
  const mList = metricsOverride || METRICS
  /* 파생지표가 있으면 기반 지표도 함께 누적 (legacy + 동적 모두 지원) */
  const hasDerived = metrics.some(mid => {
    const m = mList.find(x => x.id === mid)
    return m?.derived
  })
  const allAccum = hasDerived
    ? [...new Set([...metrics, ...mList.filter(m => !m.derived && m.field).map(m => m.id)])]
    : metrics

  /* 메트릭별 agg 타입 캐시 (매 행 lookup 방지) */
  const mCache = {}
  allAccum.forEach(mid => { mCache[mid] = mList.find(x => x.id === mid) })

  const map = {}
  data.forEach(r => {
    const k = r[groupByField] || '(없음)'
    if (!map[k]) { map[k] = { name: k } }
    allAccum.forEach(mid => {
      const m = mCache[mid]
      if (!m || m.derived || !m.field) return
      const agg = m._countType ? 'count' : (m.agg || 'sum')
      if (agg === 'count') {
        map[k][mid] = (map[k][mid] || 0) + 1
      } else if (agg === 'avg') {
        map[k][mid + '__s'] = (map[k][mid + '__s'] || 0) + (parseFloat(r[m.field]) || 0)
        map[k][mid + '__c'] = (map[k][mid + '__c'] || 0) + 1
      } else {
        map[k][mid] = (map[k][mid] || 0) + (parseFloat(r[m.field]) || 0)
      }
    })
  })
  /* AVG 확정 + 임시키 정리 */
  allAccum.forEach(mid => {
    const m = mCache[mid]
    if (m && (m.agg === 'avg') && !m._countType && !m.derived) {
      Object.values(map).forEach(row => {
        row[mid] = row[mid + '__c'] > 0 ? row[mid + '__s'] / row[mid + '__c'] : 0
        delete row[mid + '__s']; delete row[mid + '__c']
      })
    }
  })
  if (hasDerived) Object.values(map).forEach(row => calcDerived(row, metrics))
  return Object.values(map)
}

/* 일별 집계 (SUM / COUNT / AVG 지원) */
export function dailyData(data, metrics, metricsOverride) {
  const mList = metricsOverride || METRICS
  /* 파생지표가 있으면 기반 지표도 함께 누적 */
  const hasDerived = metrics.some(mid => {
    const m = mList.find(x => x.id === mid)
    return m?.derived
  })
  const allAccum = hasDerived
    ? [...new Set([...metrics, ...mList.filter(m => !m.derived && m.field).map(m => m.id)])]
    : metrics

  /* 메트릭별 agg 타입 캐시 */
  const mCache = {}
  allAccum.forEach(mid => { mCache[mid] = mList.find(x => x.id === mid) })

  /* 날짜 컬럼 자동 감지 */
  const dateFields = ['date', 'Event Date', 'reservation_date', 'check_in_date']

  const map = {}
  data.forEach(r => {
    let d = null
    for (const f of dateFields) { if (r[f]) { d = String(r[f]).slice(0, 10); break } }
    if (!d) return
    if (!map[d]) { map[d] = { label: d.slice(5) } }
    allAccum.forEach(mid => {
      const m = mCache[mid]
      if (!m || m.derived || !m.field) return
      const agg = m._countType ? 'count' : (m.agg || 'sum')
      if (agg === 'count') {
        map[d][mid] = (map[d][mid] || 0) + 1
      } else if (agg === 'avg') {
        map[d][mid + '__s'] = (map[d][mid + '__s'] || 0) + (parseFloat(r[m.field]) || 0)
        map[d][mid + '__c'] = (map[d][mid + '__c'] || 0) + 1
      } else {
        map[d][mid] = (map[d][mid] || 0) + (parseFloat(r[m.field]) || 0)
      }
    })
  })
  /* AVG 확정 + 임시키 정리 */
  allAccum.forEach(mid => {
    const m = mCache[mid]
    if (m && (m.agg === 'avg') && !m._countType && !m.derived) {
      Object.values(map).forEach(row => {
        row[mid] = row[mid + '__c'] > 0 ? row[mid + '__s'] / row[mid + '__c'] : 0
        delete row[mid + '__s']; delete row[mid + '__c']
      })
    }
  })
  if (hasDerived) Object.values(map).forEach(row => calcDerived(row, metrics))
  return Object.values(map).sort((a, b) => a.label.localeCompare(b.label))
}

export const CHART_COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899']
