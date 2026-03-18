import { supabase } from '../../lib/supabase'
import { getExcludedGuestIds } from './ExcludeUsers'

// 유저분석에 실제 필요한 컬럼만 (불필요 컬럼 제거 → 전송량 감소)
const COLS = 'id,guest_id,user_id,branch_name,area,channel_group,reservation_date,check_in_date,nights,peoples,payment_amount,room_type2,brand_name,lead_time'

/** 인메모리 캐시 — 같은 날짜 범위면 DB 재요청 안 함 */
let _dataCache = null
let _dataCacheKey = ''
let _dataCacheTs = 0
const DATA_CACHE_TTL = 300_000 // 5분

/**
 * product_revenue_raw 데이터 fetch (병렬 + 캐시 + 제외 유저)
 */
export async function fetchProductData(dateRange) {
  if (!supabase) return []

  const cacheKey = `${dateRange?.start || ''}_${dateRange?.end || ''}`

  // 캐시 히트 → 즉시 반환 (제외 유저만 재적용)
  if (_dataCache && _dataCacheKey === cacheKey && (Date.now() - _dataCacheTs < DATA_CACHE_TTL)) {
    return applyExclusion(_dataCache)
  }

  const PAGE = 10000
  const CONCURRENT = 6

  // 총 건수 + 제외 유저 동시 조회
  let countQuery = supabase
    .from('product_revenue_raw')
    .select('*', { count: 'exact', head: true })
  if (dateRange?.start) countQuery = countQuery.gte('reservation_date', dateRange.start)
  if (dateRange?.end) countQuery = countQuery.lte('reservation_date', dateRange.end)

  const [{ count, error: countErr }, excludedGuestIds] = await Promise.all([
    countQuery,
    getExcludedGuestIds(),
  ])

  if (countErr) throw countErr
  if (!count || count === 0) return []

  // 병렬 fetch
  const totalPages = Math.ceil(count / PAGE)
  const chunks = new Array(totalPages)

  for (let batch = 0; batch < totalPages; batch += CONCURRENT) {
    const promises = []
    for (let i = batch; i < Math.min(batch + CONCURRENT, totalPages); i++) {
      const from = i * PAGE
      let q = supabase.from('product_revenue_raw').select(COLS)
      if (dateRange?.start) q = q.gte('reservation_date', dateRange.start)
      if (dateRange?.end) q = q.lte('reservation_date', dateRange.end)
      promises.push(
        q.range(from, from + PAGE - 1).then(({ data, error }) => {
          if (error) throw error
          chunks[i] = data || []
        })
      )
    }
    await Promise.all(promises)
  }

  const all = chunks.flat()

  // id 기준 중복 제거
  const seen = new Set()
  const deduped = []
  for (const row of all) {
    if (row.id && seen.has(row.id)) continue
    if (row.id) seen.add(row.id)
    deduped.push(row)
  }

  // 캐시 저장 (제외 유저 적용 전 원본)
  _dataCache = deduped
  _dataCacheKey = cacheKey
  _dataCacheTs = Date.now()

  // 제외 유저 필터링
  if (excludedGuestIds.length > 0) {
    const excludedSet = new Set(excludedGuestIds.map(String))
    return deduped.filter(row => !row.guest_id || !excludedSet.has(String(row.guest_id)))
  }

  return deduped
}

async function applyExclusion(data) {
  const excludedGuestIds = await getExcludedGuestIds()
  if (excludedGuestIds.length === 0) return data
  const excludedSet = new Set(excludedGuestIds.map(String))
  return data.filter(row => !row.guest_id || !excludedSet.has(String(row.guest_id)))
}

/** 캐시 무효화 (CSV 재업로드 시) */
export function invalidateProductCache() {
  _dataCache = null
  _dataCacheKey = ''
  _dataCacheTs = 0
}
