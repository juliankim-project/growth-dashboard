/**
 * widgetUtils.js — 위젯 공통 유틸
 *
 * 모든 메트릭 정보는 `mList` (= buildTableMetrics() 결과)로 전달받음.
 * 레거시 METRICS 직접 참조 없음 — 단일 메트릭 소스(columnConfig → buildTableMetrics).
 */
import { getPreviousPeriod } from '../../store/useDateRange'

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

  /* COUNT(DISTINCT col) */
  if (m._countDistinct && m._distinctCol) {
    const set = new Set(data.map(r => r[m._distinctCol]).filter(v => v != null && v !== ''))
    return set.size
  }

  /* COUNT(*) — _weight 가중치 지원 (daily_summary 등 집계 뷰) */
  if (m._countType) return data.reduce((s, r) => s + (r._weight || 1), 0)

  /* 비율 계산컬럼 — SUM(분자) / SUM(분모) 또는 COUNT(DISTINCT) 지원 */
  if (m._ratioTerms) {
    const { num, den } = m._ratioTerms
    const denM = mList?.find(x => x.id === den)
    const numM = mList?.find(x => x.id === num)
    /* 분모/분자가 count_distinct면 Set 기반 유니크 카운트, 아니면 SUM */
    const denVal = (denM?._countDistinct && denM._distinctCol)
      ? new Set(data.map(r => r[denM._distinctCol]).filter(v => v != null && v !== '')).size
      : sumField(data, den)
    const numVal = (numM?._countDistinct && numM._distinctCol)
      ? new Set(data.map(r => r[numM._distinctCol]).filter(v => v != null && v !== '')).size
      : sumField(data, num)
    return denVal > 0 ? numVal / denVal : 0
  }

  /* 동적 테이블 메트릭 (계산 컬럼 포함) — agg 타입 반영 */
  if (m._computed || (m.field && m.field === m.id && !m.derived)) {
    const agg = m.agg || 'sum'
    if (agg === 'count') return data.reduce((s, r) => s + (r._weight || 1), 0)
    if (agg === 'count_distinct' && m._distinctCol) {
      const set = new Set(data.map(r => r[m._distinctCol]).filter(v => v != null && v !== ''))
      return set.size
    }
    const totalWeight = data.reduce((s, r) => s + (r._weight || 1), 0)
    if (agg === 'avg') return totalWeight > 0 ? sumField(data, m.field) / totalWeight : 0
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
      case 'cpc':      return clicks > 0      ? cost        / clicks : 0
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
  if (m.agg === 'avg')      return (value == null || isNaN(value)) ? '—' : value.toFixed(2)
  /* 비율 계산컬럼 (LOS, 객단가 등) — 소수 표시 */
  if (m._ratioTerms)        return (value == null || isNaN(value)) ? '—' : value.toFixed(2)
  return fmtNum(value)
}

/** 차트 축/툴팁 전용 — 메트릭 fmt 기반 풀 포맷 (축약 없음) */
export function fmtAxis(value, metricId, mList) {
  if (value == null || isNaN(value)) return '—'
  const m = mList?.find(x => x.id === metricId)
  if (!m) return Math.round(value).toLocaleString()
  if (m.fmt === 'currency') return Math.round(value).toLocaleString() + '원'
  if (m.fmt === 'roas')     return Math.round(value * 100).toLocaleString() + '%'
  if (m.fmt === 'pct')      return value.toFixed(1) + '%'
  if (m.agg === 'avg')      return value.toFixed(2)
  if (m._ratioTerms)        return value.toFixed(2)
  return Math.round(value).toLocaleString()
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
  if (metrics.includes('cpc'))      row.cpc      = cl > 0  ? c  / cl      : 0
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
      /* COUNT(DISTINCT col) — Set 기반 유니크 카운트 */
      if (m._countDistinct && m._distinctCol) {
        if (!map[k][mid + '__set']) map[k][mid + '__set'] = new Set()
        const v = r[m._distinctCol]
        if (v != null && v !== '') map[k][mid + '__set'].add(v)
        return
      }
      const w = r._weight || 1
      const agg = m._countType ? 'count' : (m.agg || 'sum')
      if (agg === 'count') {
        map[k][mid] = (map[k][mid] || 0) + w
      } else if (agg === 'avg') {
        map[k][mid + '__s'] = (map[k][mid + '__s'] || 0) + (parseFloat(r[m.field]) || 0)
        map[k][mid + '__c'] = (map[k][mid + '__c'] || 0) + w
      } else {
        map[k][mid] = (map[k][mid] || 0) + (parseFloat(r[m.field]) || 0)
      }
    })
  })

  /* COUNT(DISTINCT) 확정 + Set 정리 */
  allAccum.forEach(mid => {
    const m = mCache[mid]
    if (m?._countDistinct && m._distinctCol) {
      Object.values(map).forEach(row => {
        row[mid] = row[mid + '__set']?.size || 0
        delete row[mid + '__set']
      })
    }
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
/**
 * 시간 기반 그룹핑 (일/주/월)
 * @param {'day'|'week'|'month'} timeGroup - 그룹핑 단위
 */
export function dailyData(data, metrics, mList, dateColumn, timeGroup = 'day') {
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

  /* 날짜 → 그룹키 변환 */
  const toGroupKey = (dateStr) => {
    if (timeGroup === 'month') return dateStr.slice(0, 7) // YYYY-MM
    if (timeGroup === 'week') {
      const dt = new Date(dateStr + 'T00:00:00')
      const day = dt.getDay() || 7 // 월=1 ... 일=7
      const mon = new Date(dt)
      mon.setDate(dt.getDate() - (day - 1)) // 해당 주 월요일
      return mon.toISOString().slice(0, 10) // YYYY-MM-DD (월요일)
    }
    return dateStr // day
  }
  const toLabel = (key) => {
    if (timeGroup === 'month') return key.slice(2) // YY-MM
    if (timeGroup === 'week') return key.slice(5) + '~' // MM-DD~
    return key.slice(5) // MM-DD
  }

  const map = {}
  data.forEach(r => {
    let d = null
    for (const f of dateFields) { if (r[f]) { d = String(r[f]).slice(0, 10); break } }
    if (!d) return
    const gk = toGroupKey(d)
    if (!map[gk]) { map[gk] = { label: toLabel(gk), _key: gk } }
    allAccum.forEach(mid => {
      const m = mCache[mid]
      if (!m || m.derived || !m.field) return
      if (m._ratioTerms) return
      if (m._countDistinct && m._distinctCol) {
        if (!map[gk][mid + '__set']) map[gk][mid + '__set'] = new Set()
        const v = r[m._distinctCol]
        if (v != null && v !== '') map[gk][mid + '__set'].add(v)
        return
      }
      const w = r._weight || 1
      const agg = m._countType ? 'count' : (m.agg || 'sum')
      if (agg === 'count') {
        map[gk][mid] = (map[gk][mid] || 0) + w
      } else if (agg === 'avg') {
        map[gk][mid + '__s'] = (map[gk][mid + '__s'] || 0) + (parseFloat(r[m.field]) || 0)
        map[gk][mid + '__c'] = (map[gk][mid + '__c'] || 0) + w
      } else {
        map[gk][mid] = (map[gk][mid] || 0) + (parseFloat(r[m.field]) || 0)
      }
    })
  })

  /* COUNT(DISTINCT) 확정 + Set 정리 */
  allAccum.forEach(mid => {
    const m = mCache[mid]
    if (m?._countDistinct && m._distinctCol) {
      Object.values(map).forEach(row => {
        row[mid] = row[mid + '__set']?.size || 0
        delete row[mid + '__set']
      })
    }
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
  return Object.values(map).sort((a, b) => (a._key || a.label).localeCompare(b._key || b.label))
}

export const CHART_COLORS = ['#0C66E4','#1F845A','#E56910','#CA3521','#6E5DC6','#0055CC','#E774BB']

/* ─── 기간 분할 (ComparisonWidget용) ─── */
export function splitByPeriod(data, dateRange, dateColumn) {
  if (!data || data.length === 0 || !dateRange) return { current: data || [], previous: [] }

  const dateFields = dateColumn
    ? [dateColumn]
    : ['date', 'Event Date', 'reservation_date', 'check_in_date']

  const getDate = (row) => {
    for (const f of dateFields) { if (row[f]) return String(row[f]).slice(0, 10) }
    return null
  }

  /* 문자열 비교 (YYYY-MM-DD) — Date 객체 비교 시 타임존/시간 이슈 방지 */
  const startStr = dateRange.start
  const endStr   = dateRange.end

  /* 이전 기간: 월/주 프리셋은 달/주 단위, 일/커스텀은 동일 일수 */
  const prev = getPreviousPeriod(dateRange)
  const prevStartStr = prev.start
  const prevEndStr   = prev.end

  const current = []
  const previous = []

  data.forEach(row => {
    const d = getDate(row)
    if (!d) return
    if (d >= startStr && d <= endStr) current.push(row)
    else if (prevStartStr && prevEndStr && d >= prevStartStr && d <= prevEndStr) previous.push(row)
  })

  return { current, previous }
}

/* ─── 임계값 상태 판정 (AlertWidget용) ─── */
export function getThresholdStatus(value, threshold) {
  if (!threshold) return 'neutral'
  const { good, warning, inverse } = threshold
  if (good == null && warning == null) return 'neutral'
  if (inverse) {
    if (value <= good) return 'good'
    if (value <= warning) return 'warning'
    return 'danger'
  }
  if (value >= good) return 'good'
  if (value >= warning) return 'warning'
  return 'danger'
}
