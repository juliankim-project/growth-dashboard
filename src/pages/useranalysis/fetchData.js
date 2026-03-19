import { supabase } from '../../lib/supabase'
import { getExcludedGuestIds } from './ExcludeUsers'

// 유저분석에 실제 필요한 컬럼만 (불필요 컬럼 제거 → 전송량 감소)
const COLS = 'id,guest_id,user_id,branch_name,area,channel_group,reservation_date,check_in_date,nights,peoples,payment_amount,room_type2,brand_name,lead_time'

/* ═══════════════════════════════════════════════
   2-Layer 캐시: IndexedDB(영구) + Memory(즉시)
   - 1차: 메모리 캐시 → 0ms (탭 전환, 필터 변경)
   - 2차: IndexedDB → ~50ms (페이지 새로고침)
   - 3차: DB fetch → 3-10초 (캐시 만료 시)
   TTL: 30분 (데이터가 자주 안 바뀌니까)
   ═══════════════════════════════════════════════ */

const DATA_CACHE_TTL = 1_800_000 // 30분
const IDB_NAME = 'growth_dashboard_cache'
const IDB_STORE = 'product_data'
const IDB_VERSION = 1

/* ─── IndexedDB 헬퍼 ─── */
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
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
      const store = tx.objectStore(IDB_STORE)
      const req = store.get(key)
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
      const store = tx.objectStore(IDB_STORE)
      store.put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch { /* ignore */ }
}

async function idbDelete(key) {
  try {
    const db = await openIDB()
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
  } catch { /* ignore */ }
}

/* ─── 메모리 캐시 (1차) ─── */
let _memCache = null
let _memCacheKey = ''
let _memCacheTs = 0

/**
 * product_revenue_raw 데이터 fetch
 * 1차: 메모리 캐시 (즉시)
 * 2차: IndexedDB (새로고침 후에도 유지, ~50ms)
 * 3차: Supabase 병렬 fetch (네트워크)
 */
export async function fetchProductData(dateRange) {
  if (!supabase) return []

  const cacheKey = `${dateRange?.start || ''}_${dateRange?.end || ''}`

  // ── 1차: 메모리 캐시 ──
  if (_memCache && _memCacheKey === cacheKey && (Date.now() - _memCacheTs < DATA_CACHE_TTL)) {
    return applyExclusion(_memCache)
  }

  // ── 2차: IndexedDB 캐시 ──
  const idbEntry = await idbGet(`data_${cacheKey}`)
  if (idbEntry && (Date.now() - idbEntry.ts < DATA_CACHE_TTL)) {
    // IndexedDB → 메모리로 승격
    _memCache = idbEntry.rows
    _memCacheKey = cacheKey
    _memCacheTs = idbEntry.ts
    return applyExclusion(idbEntry.rows)
  }

  // ── 3차: Supabase 네트워크 fetch ──
  const PAGE = 10000 // 페이지 크기 증가 (Max Rows 설정 올렸으니)
  const CONCURRENT = 4

  // 총 건수 조회
  let countQuery = supabase
    .from('product_revenue_raw')
    .select('*', { count: 'exact', head: true })
  if (dateRange?.start) countQuery = countQuery.gte('reservation_date', dateRange.start)
  if (dateRange?.end) countQuery = countQuery.lte('reservation_date', dateRange.end)

  const { count, error: countErr } = await countQuery
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

  // 메모리 캐시 저장
  _memCache = deduped
  _memCacheKey = cacheKey
  _memCacheTs = Date.now()

  // IndexedDB 비동기 저장 (백그라운드)
  idbSet(`data_${cacheKey}`, { rows: deduped, ts: Date.now() }).catch(() => {})

  return applyExclusion(deduped)
}

async function applyExclusion(data) {
  const excludedGuestIds = await getExcludedGuestIds()
  if (excludedGuestIds.length === 0) return data
  const excludedSet = new Set(excludedGuestIds.map(String))
  return data.filter(row => !row.guest_id || !excludedSet.has(String(row.guest_id)))
}

/** 캐시 무효화 (CSV 재업로드 시) */
export function invalidateProductCache() {
  _memCache = null
  _memCacheKey = ''
  _memCacheTs = 0
  // IndexedDB도 클리어
  openIDB().then(db => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).clear()
  }).catch(() => {})
}
