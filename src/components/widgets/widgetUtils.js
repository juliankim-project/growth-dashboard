/**
 * widgetUtils.js — 위젯 공통 유틸
 *
 * 모든 메트릭 정보는 `mList` (= buildTableMetrics() 결과)로 전달받음.
 * 레거시 METRICS 직접 참조 없음 — 단일 메트릭 소스(columnConfig → buildTableMetrics).
 */

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

/* ─── 메트릭 lookup ─── */
const _m = (metricId, mList) => mList?.find(x => x.id === metricId)

/* ─── 지표 ID → 값 계산 (SUM / COUNT / AVG / RATIO + 파생) ─── */
export function calcMetric(data, metricId, mList) {
  const m = _m(metricId, mList)
  if (!m) return 0
  if (!data || data.length === 0) return 0

  /* COUNT(*) */
  if (m._countType) return data.length

  /* 비율 계산컬럼 — SUM(분자) / SUM(분모) */
  if (m._ratioTerms) {
    const { num, den } = m._ratioTerms
    const denVal = sumField(data, den)
    return denVal > 0 ? sumField(data, num) / denVal : 0
  }

  /* 동적 테이블 메트릭 (계산 컬럼 포함) — agg 타입 반영 */
  if (m._computed || (m.field && m.field === m.id && !m.derived)) {
    const agg = m.agg || 'sum'
    if (agg === 'count') return data.length
    if (agg === 'avg') return data.length > 0 ? sumField(data, m.field) / data.length : 0
    return sumField(data, m.field)
  }

  /* 마케팅 파생지표 (ROAS, CTR 등) */
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
      case 'cvr_c':    return clicks > 0      ? (signup     / clicks) * 100 : 0
      case 'cvr_s':    return clicks > 0      ? (conv       / clicks) * 100 : 0
      default:         return 0
    }
  }

  return sumField(data, m.field)
}

/* 포맷 - KPI/테이블 표시용 */
export function fmtMetric(metricId, value, mList) {
  const m = _m(metricId, mList)
  if (!m) return String(value ?? '')
  if (m.fmt === 'currency') return fmtKRW(value)
  if (m.fmt === 'roas')     return Math.round(value * 100).toLocaleString() + '%'
  if (m.fmt === 'pct')      return value.toFixed(1) + '%'
  return fmtNum(value)
}

/* ─── 파생지표 계산 (그룹/일별 공통) ─── */
function calcDerived(row, metrics, mList) {
  /* 마케팅 파생지표 */
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
  if (metrics.includes('cvr_c'))    row.cvr_c    = cl > 0  ? (sg / cl) * 100 : 0
  if (metrics.includes('cvr_s'))    row.cvr_s    = cl > 0  ? (cv / cl) * 100 : 0

  /* 비율 계산컬럼 — 이미 분자/분모가 SUM 누적된 상태에서 나누기 */
  if (mList) {
    metrics.forEach(mid => {
      const m = mList.find(x => x.id === mid)
      if (m?._ratioTerms) {
        const { num, den } = m._ratioTerms
        const denVal = row[den] || 0
        row[mid] = denVal > 0 ? (row[num] || 0) / denVal : 0
      }
    })
  }
}

/* ─── 그룹핑 (SUM / COUNT / AVG / RATIO 지원) ─── */
export function groupData(data, groupByField, metrics, mList) {
  if (!mList || mList.length === 0) return []

  /* 파생지표/비율지표가 있으면 기반 지표도 함께 누적 */
  const hasDerived = metrics.some(mid => {
    const m = mList.find(x => x.id === mid)
    return m?.derived
  })
  const hasRatio = metrics.some(mid => {
    const m = mList.find(x => x.id === mid)
    return m?._ratioTerms
  })

  /* 누적할 메트릭 확장: 파생이면 모든 기반 포함, 비율이면 분자/분모 포함 */
  let allAccum = [...metrics]
  if (hasDerived) {
    allAccum = [...new Set([...allAccum, ...mList.filter(m => !m.derived && m.field).map(m => m.id)])]
  }
  if (hasRatio) {
    metrics.forEach(mid => {
      const m = mList.find(x => x.id === mid)
      if (m?._ratioTerms) {
        const { num, den } = m._ratioTerms
        /* 분자/분모가 mList에 있으면 그 ID로, 없으면 raw 컬럼으로 직접 접근 */
        const numM = mList.find(x => x.field === num || x.id === num)
        const denM = mList.find(x => x.field === den || x.id === den)
        if (numM && !allAccum.includes(numM.id)) allAccum.push(numM.id)
        if (denM && !allAccum.includes(denM.id)) allAccum.push(denM.id)
      }
    })
  }

  /* 메트릭별 agg 타입 캐시 */
  const mCache = {}
  allAccum.forEach(mid => { mCache[mid] = mList.find(x => x.id === mid) })

  const map = {}
  data.forEach(r => {
    const k = r[groupByField] || '(없음)'
    if (!map[k]) { map[k] = { name: k } }
    allAccum.forEach(mid => {
      const m = mCache[mid]
      if (!m || m.derived || !m.field) return
      if (m._ratioTerms) return  // 비율 지표는 직접 누적하지 않음 (분자/분모로 처리)
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

  /* 파생 + 비율 확정 */
  if (hasDerived || hasRatio) Object.values(map).forEach(row => calcDerived(row, metrics, mList))
  return Object.values(map)
}

/* ─── 일별 집계 (SUM / COUNT / AVG / RATIO 지원) ─── */
export function dailyData(data, metrics, mList, dateColumn) {
  if (!mList || mList.length === 0) return []

  /* 파생/비율 감지 */
  const hasDerived = metrics.some(mid => {
    const m = mList.find(x => x.id === mid)
    return m?.derived
  })
  const hasRatio = metrics.some(mid => {
    const m = mList.find(x => x.id === mid)
    return m?._ratioTerms
  })

  let allAccum = [...metrics]
  if (hasDerived) {
    allAccum = [...new Set([...allAccum, ...mList.filter(m => !m.derived && m.field).map(m => m.id)])]
  }
  if (hasRatio) {
    metrics.forEach(mid => {
      const m = mList.find(x => x.id === mid)
      if (m?._ratioTerms) {
        const { num, den } = m._ratioTerms
        const numM = mList.find(x => x.field === num || x.id === num)
        const denM = mList.find(x => x.field === den || x.id === den)
        if (numM && !allAccum.includes(numM.id)) allAccum.push(numM.id)
        if (denM && !allAccum.includes(denM.id)) allAccum.push(denM.id)
      }
    })
  }

  const mCache = {}
  allAccum.forEach(mid => { mCache[mid] = mList.find(x => x.id === mid) })

  /* 날짜 컬럼: 명시적 dateColumn 우선, 없으면 자동 감지 */
  const dateFields = dateColumn
    ? [dateColumn]
    : ['date', 'Event Date', 'reservation_date', 'check_in_date']

  const map = {}
  data.forEach(r => {
    let d = null
    for (const f of dateFields) { if (r[f]) { d = String(r[f]).slice(0, 10); break } }
    if (!d) return
    if (!map[d]) { map[d] = { label: d.slice(5) } }
    allAccum.forEach(mid => {
      const m = mCache[mid]
      if (!m || m.derived || !m.field) return
      if (m._ratioTerms) return  // 비율 지표는 분자/분모로 처리
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

  allAccum.forEach(mid => {
    const m = mCache[mid]
    if (m && (m.agg === 'avg') && !m._countType && !m.derived) {
      Object.values(map).forEach(row => {
        row[mid] = row[mid + '__c'] > 0 ? row[mid + '__s'] / row[mid + '__c'] : 0
        delete row[mid + '__s']; delete row[mid + '__c']
      })
    }
  })

  if (hasDerived || hasRatio) Object.values(map).forEach(row => calcDerived(row, metrics, mList))
  return Object.values(map).sort((a, b) => a.label.localeCompare(b.label))
}

export const CHART_COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899']
