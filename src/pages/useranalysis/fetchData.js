import { supabase } from '../../lib/supabase'

const COLS = 'id,guest_id,user_id,branch_name,area,channel_group,channel_name,reservation_date,check_in_date,nights,peoples,payment_amount,original_price,room_type_name,room_type2,brand_name,lead_time'

/**
 * product_revenue_raw 데이터 fetch (중복 제거 포함)
 * - id 기준 dedup: CSV 재업로드 시 동일 예약이 중복 삽입될 수 있음
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

  return deduped
}
