import { fetchByDateRange } from '../../lib/supabase'
import { getExcludedGuestIds } from './ExcludeUsers'

/* ═══════════════════════════════════════════════
   전략: supabase.js 의 2-Layer 캐시 (Memory + IndexedDB) 활용

   기존 문제점:
   - fetchData.js가 자체 IndexedDB 캐시를 가지고 있어서
     앱 시작 시 prefetch된 데이터를 활용하지 못했음
   - 별도의 CONCURRENT=4 사용 (supabase.js는 8)

   변경 후:
   - supabase.js의 ensureTableData() 활용 (fetchByDateRange 경유)
   - 앱 시작 시 prefetch된 product_revenue_raw 캐시 즉시 히트
   - 메모리 캐시 히트 시 0ms, IndexedDB 히트 시 ~50ms
   - 날짜 필터링은 클라이언트에서 즉시 처리
   ═══════════════════════════════════════════════ */

/**
 * product_revenue_raw 데이터 가져오기
 * - supabase.js의 2-Layer 캐시 활용 (Memory → IndexedDB → Network)
 * - 날짜 필터링은 클라이언트에서 즉시 (0ms)
 * - 제외 유저 필터링 적용
 */
export async function fetchProductData(dateRange) {
  // supabase.js의 캐시 시스템 활용
  // - 앱 시작 시 prefetchTables()가 이미 product_revenue_raw를 로딩함
  // - 메모리 캐시 히트 → 0ms
  // - IndexedDB 캐시 히트 → ~50ms
  // - 캐시 미스 → 네트워크 fetch (8 concurrent)
  const allData = await fetchByDateRange(
    'product_revenue_raw',
    dateRange?.start || dateRange?.end ? 'reservation_date' : null,
    dateRange?.start || null,
    dateRange?.end || null,
  )

  if (!allData || allData.length === 0) return []

  // 제외 유저 필터링
  const excludedGuestIds = await getExcludedGuestIds()
  if (excludedGuestIds.length > 0) {
    const excludedSet = new Set(excludedGuestIds.map(String))
    return allData.filter(row => !row.guest_id || !excludedSet.has(String(row.guest_id)))
  }

  return allData
}

/** 캐시 무효화 (CSV 재업로드 시) — supabase.js에 위임 */
import { invalidateTableCache } from '../../lib/supabase'
export function invalidateProductCache() {
  invalidateTableCache('product_revenue_raw')
}
