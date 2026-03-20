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
  // ★ dedup은 supabase.js ensureTableData에서 처리됨 (캐시·네트워크 모두 적용)
  const allData = await fetchByDateRange('product_revenue_raw', null, null, null)

  if (!allData || allData.length === 0) return []

  // 클라이언트 날짜 필터 — reservation_date(예약일) 기준
  let filtered = allData
  if (dateRange?.start || dateRange?.end) {
    const start = dateRange.start || ''
    const end = dateRange.end || '9999-12-31'
    filtered = allData.filter(r => {
      const d = r.reservation_date?.slice(0, 10) || ''
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
