import { fetchByDateRange, invalidateTableCache } from '../../lib/supabase'
import { getExcludedGuestIds } from './ExcludeUsers'

/* ═══════════════════════════════════════════════
   전략: supabase.js 의 2-Layer 캐시 (Memory + IndexedDB) 활용

   - 전체 데이터를 ensureTableData → fetchByDateRange(null) 경유로 로드
   - id 기준 중복 제거 (페이지네이션 경계 중복 방지)
   - 날짜 필터링은 여기서 직접 처리
   ═══════════════════════════════════════════════ */

/**
 * product_revenue_raw 데이터 가져오기
 * - supabase.js의 2-Layer 캐시 활용 (Memory → IndexedDB → Network)
 * - id 기준 중복 제거
 * - 날짜 필터링은 클라이언트에서 즉시 (0ms)
 * - 제외 유저 필터링 적용
 */
export async function fetchProductData(dateRange) {
  // 전체 데이터 로드 (캐시 히트 시 즉시)
  const allData = await fetchByDateRange('product_revenue_raw', null, null, null)

  if (!allData || allData.length === 0) return []

  // id 기준 중복 제거 (페이지네이션 경계에서 중복 row 가능)
  const seen = new Set()
  const deduped = []
  for (const row of allData) {
    const key = row.id ?? row.no // id 또는 no 컬럼 사용
    if (key != null) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    deduped.push(row)
  }

  // 클라이언트 날짜 필터 — check_in_date 기준 (2월 매출 = 2월 체크인 기준)
  // reservation_date 기준이면 "예약한 날짜"만 잡히므로 실제 매출과 괴리 발생
  let filtered = deduped
  if (dateRange?.start || dateRange?.end) {
    const start = dateRange.start || ''
    const end = dateRange.end || '9999-12-31'
    filtered = deduped.filter(r => {
      const d = r.check_in_date?.slice(0, 10) || r.reservation_date?.slice(0, 10) || ''
      return d >= start && d <= end
    })
  }

  // 제외 유저 필터링
  const excludedGuestIds = await getExcludedGuestIds()
  if (excludedGuestIds.length > 0) {
    const excludedSet = new Set(excludedGuestIds.map(String))
    filtered = filtered.filter(row => !row.guest_id || !excludedSet.has(String(row.guest_id)))
  }

  return filtered
}

/** 캐시 무효화 (CSV 재업로드 시) — supabase.js에 위임 */
export function invalidateProductCache() {
  invalidateTableCache('product_revenue_raw')
}
