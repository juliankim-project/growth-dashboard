import { supabase } from '../../lib/supabase'
import { getExcludedGuestIds } from './ExcludeUsers'

const COLS = 'id,guest_id,user_id,branch_name,area,channel_group,channel_name,reservation_date,check_in_date,nights,peoples,payment_amount,original_price,room_type_name,room_type2,brand_name,lead_time'

/**
 * product_revenue_raw 데이터 fetch (병렬 + 중복 제거 + 제외 유저 필터링)
 */
export async function fetchProductData(dateRange) {
  if (!supabase) return []

  const PAGE = 10000
  const CONCURRENT = 5

  // 1단계: 총 건수 조회
  let countQuery = supabase
    .from('product_revenue_raw')
    .select('*', { count: 'exact', head: true })
  if (dateRange?.start) countQuery = countQuery.gte('reservation_date', dateRange.start)
  if (dateRange?.end) countQuery = countQuery.lte('reservation_date', dateRange.end)

  const { count, error: countErr } = await countQuery
  if (countErr) throw countErr
  if (!count || count === 0) return []

  // 2단계: 병렬 fetch
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

  // 제외 유저 필터링 (DB 기반, guestId 기준)
  const excludedGuestIds = await getExcludedGuestIds()
  if (excludedGuestIds.length > 0) {
    const excludedSet = new Set(excludedGuestIds.map(String))
    return deduped.filter(row => {
      if (!row.guest_id) return true
      return !excludedSet.has(String(row.guest_id))
    })
  }

  return deduped
}
