import { supabase } from '../../lib/supabase'
import { getExcludedGuestIds } from './ExcludeUsers'

const COLS = 'id,guest_id,user_id,branch_name,area,channel_group,channel_name,reservation_date,check_in_date,nights,peoples,payment_amount,original_price,room_type_name,room_type2,brand_name,lead_time'

/**
 * product_revenue_raw 데이터 fetch (중복 제거 + 제외 유저 필터링)
 * - id 기준 dedup: CSV 재업로드 시 동일 예약이 중복 삽입될 수 있음
 * - 제외 유저: DB의 excluded_users 테이블 기준 (모든 사용자 공유)
 */
export async function fetchProductData(dateRange) {
  if (!supabase) return []
  const PAGE = 5000
  let from = 0
  const all = []

  while (true) {
    let q = supabase.from('product_revenue_raw').select(COLS)
    if (dateRange?.start) q = q.gte('reservation_date', dateRange.start)
    if (dateRange?.end)   q = q.lte('reservation_date', dateRange.end)
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

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
