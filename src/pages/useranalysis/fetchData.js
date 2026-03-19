import { supabase } from '../../lib/supabase'
import { getExcludedGuestIds } from './ExcludeUsers'

// 유저분석에 실제 필요한 컬럼만
const COLS = 'id,guest_id,user_id,branch_name,area,channel_group,reservation_date,check_in_date,nights,peoples,payment_amount,room_type2,brand_name,lead_time'

/* ═══════════════════════════════════════════════
   전략: 전체 데이터를 1번만 로딩 → 날짜 변경은 즉시
   - 날짜 범위 DB 필터 제거 (전체 fetch)
   - 날짜 필터링은 클라이언트에서 처리 → 0ms
   - 2-Layer 캐시: Memory + IndexedDB
   ═══════════════════════════════════════════════ */

const DATA_CACHE_TTL = 1_800_000 // 30분
const IDB_NAME = 'growth_dashboard_cache'
const IDB_STORE = 'product_data'
const IDB_VERSION = 1
const IDB_KEY = 'all_product_data'

/* ─── IndexedDB 헬퍼 ─── */
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  try {
    const db = await openIDB()
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

async function idbSet(key, value) {
  try {
    const db = await openIDB()
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch { /* ignore */ }
}

/* ─── 전체 데이터 캐시 (날짜 무관) ─── */
let _allData = null
let _allDataTs = 0
let _fetchPromise = null // 중복 fetch 방지

/** 전체 데이터 1번 로딩 (이후 캐시) */
async function ensureAllData() {
  // 메모리 캐시 히트
  if (_allData && (Date.now() - _allDataTs < DATA_CACHE_TTL)) return _allData

  // 중복 fetch 방지 (여러 컴포넌트가 동시에 호출해도 1번만)
  if (_fetchPromise) return _fetchPromise

  _fetchPromise = (async () => {
    try {
      // IndexedDB 캐시 체크
      const idbEntry = await idbGet(IDB_KEY)
      if (idbEntry && (Date.now() - idbEntry.ts < DATA_CACHE_TTL)) {
        _allData = idbEntry.rows
        _allDataTs = idbEntry.ts
        return _allData
      }

      // DB에서 전체 fetch (날짜 필터 없음!)
      const PAGE = 10000
      const CONCURRENT = 4

      const { count, error: countErr } = await supabase
        .from('product_revenue_raw')
        .select('*', { count: 'exact', head: true })
      if (countErr) throw countErr
      if (!count || count === 0) { _allData = []; _allDataTs = Date.now(); return _allData }

      const totalPages = Math.ceil(count / PAGE)
      const chunks = new Array(totalPages)

      for (let batch = 0; batch < totalPages; batch += CONCURRENT) {
        const promises = []
        for (let i = batch; i < Math.min(batch + CONCURRENT, totalPages); i++) {
          const from = i * PAGE
          promises.push(
            supabase.from('product_revenue_raw').select(COLS)
              .range(from, from + PAGE - 1)
              .then(({ data, error }) => { if (error) throw error; chunks[i] = data || [] })
          )
        }
        await Promise.all(promises)
      }

      // id 기준 중복 제거
      const seen = new Set()
      const deduped = []
      for (const row of chunks.flat()) {
        if (row.id && seen.has(row.id)) continue
        if (row.id) seen.add(row.id)
        deduped.push(row)
      }

      _allData = deduped
      _allDataTs = Date.now()

      // IndexedDB 백그라운드 저장
      idbSet(IDB_KEY, { rows: deduped, ts: Date.now() }).catch(() => {})

      return _allData
    } finally {
      _fetchPromise = null
    }
  })()

  return _fetchPromise
}

/**
 * product_revenue_raw 데이터 가져오기
 * - 전체 데이터 1번 로딩 후 캐시
 * - 날짜 필터링은 클라이언트에서 즉시 (0ms)
 * - 제외 유저 필터링 적용
 */
export async function fetchProductData(dateRange) {
  if (!supabase) return []

  const allData = await ensureAllData()

  // 클라이언트 날짜 필터 (즉시!)
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

/** 캐시 무효화 (CSV 재업로드 시) */
export function invalidateProductCache() {
  _allData = null
  _allDataTs = 0
  _fetchPromise = null
  openIDB().then(db => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).clear()
  }).catch(() => {})
}
