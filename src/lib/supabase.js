import { createClient } from '@supabase/supabase-js'
import { idbSet, idbGet, idbDelete, idbClear } from './idbCache'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

const isMissingEnv = !supabaseUrl || !supabaseAnon

if (isMissingEnv) {
  console.error('⚠️ Supabase 환경변수 누락: VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY 확인 필요')
}

export const supabase = isMissingEnv
  ? null
  : createClient(supabaseUrl, supabaseAnon)

/* ═══════════════════════════════════════════════
   fetchAll: 페이지네이션 + 병렬 fetch
   ═══════════════════════════════════════════════ */
const MAX_ROWS = 200_000
const PAGE = 10_000
const CONCURRENT = 8 // 4→8 병렬 (네트워크 I/O 최대 활용)

/* DB 컬럼명 → 코드 내부 표준명 매핑
   - normalizeRows에서 원본 컬럼 유지 + 표준 alias 추가
   ※ marketing_data DB 컬럼은 이미 소문자(spend, channel 등)이므로 별도 alias 불필요 */
const COL_ALIASES = {
  '상품상세페이지_조회_app_web': 'view_content',
}

const _normalizeCache = new WeakMap()

function normalizeRows(rows) {
  if (!rows?.length) return rows
  if (_normalizeCache.has(rows)) return _normalizeCache.get(rows)

  const aliases = Object.entries(COL_ALIASES)
  if (aliases.length === 0) {
    _normalizeCache.set(rows, rows)
    return rows
  }

  const result = rows.map(row => {
    const copy = { ...row }
    for (const [dbCol, stdCol] of aliases) {
      if (dbCol in copy && !(stdCol in copy)) {
        copy[stdCol] = copy[dbCol]
      }
    }
    return copy
  })

  _normalizeCache.set(rows, result)
  return result
}

export async function fetchAll(tableName, columns = '*') {
  if (!supabase) {
    console.warn('[fetchAll] supabase 클라이언트 미초기화')
    return []
  }

  // 총 건수 조회
  const { count, error: countErr } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })

  if (countErr) throw countErr
  if (!count || count === 0) return []

  const totalPages = Math.min(Math.ceil(count / PAGE), Math.ceil(MAX_ROWS / PAGE))
  const all = new Array(totalPages)

  // 병렬 배치 fetch (CONCURRENT 동시 요청)
  for (let batch = 0; batch < totalPages; batch += CONCURRENT) {
    const promises = []
    for (let i = batch; i < Math.min(batch + CONCURRENT, totalPages); i++) {
      const from = i * PAGE
      promises.push(
        supabase
          .from(tableName)
          .select(columns)
          .range(from, from + PAGE - 1)
          .then(({ data, error }) => {
            if (error) throw error
            all[i] = data || []
          })
      )
    }
    await Promise.all(promises)
  }

  const flat = all.flat()
  return normalizeRows(flat)
}

/* ═══════════════════════════════════════════════
   deduplicateRows: id/no 기준 중복 제거
   - 페이지네이션 경계 중복
   - CSV 이중 업로드 중복
   - 캐시/네트워크 무관하게 항상 적용
   ═══════════════════════════════════════════════ */
function deduplicateRows(rows) {
  if (!rows || rows.length === 0) return rows
  if (rows[0].id == null && rows[0].no == null) return rows

  const seen = new Set()
  const deduped = []
  const keyField = rows[0].id != null ? 'id' : 'no'
  for (const row of rows) {
    const key = row[keyField]
    if (key != null) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    deduped.push(row)
  }
  return deduped
}

/* ═══════════════════════════════════════════════
   fetchDateRange: 날짜 범위 메타 조회
   ═══════════════════════════════════════════════ */
export async function fetchDateRange(tableName, dateColumn) {
  if (!supabase || !dateColumn) return null
  try {
    const [minRes, maxRes, countRes] = await Promise.all([
      supabase.from(tableName).select(dateColumn).order(dateColumn, { ascending: true }).limit(1),
      supabase.from(tableName).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
      supabase.from(tableName).select('*', { count: 'exact', head: true }),
    ])

    if (minRes.error) throw minRes.error
    if (maxRes.error) throw maxRes.error
    if (countRes.error) throw countRes.error

    return {
      minDate: minRes.data?.[0]?.[dateColumn] || null,
      maxDate: maxRes.data?.[0]?.[dateColumn] || null,
      totalRows: countRes.count,
    }
  } catch (e) {
    console.error(`[fetchDateRange] ${tableName}:`, e)
    return null
  }
}

/* ═══════════════════════════════════════════════
   테이블 캐시: Memory + IndexedDB (2계층)

   1. 메모리 캐시 히트 → 즉시 반환 (0ms)
   2. IndexedDB 캐시 히트 → 즉시 반환 + 백그라운드 갱신
   3. 캐시 미스 → 네트워크 fetch + 양쪽 캐시 저장
   ═══════════════════════════════════════════════ */
const _tableCache = {} // { tableName: { data, ts, promise } }
const TABLE_CACHE_TTL = 1_800_000     // 메모리 캐시 30분
const IDB_CACHE_TTL   = 86_400_000    // IndexedDB 24시간

/* 캐시 버전: 변경 시 stale IndexedDB 데이터 자동 무효화 */
const CACHE_VERSION = 2  // v1→v2: dedup 로직 이동 후 stale 캐시 제거

/* 테이블별 필수 컬럼 (불필요한 컬럼 제외로 전송량 절약) */
const TABLE_ESSENTIAL_COLS = {
  product_revenue_raw: 'id,no,guest_id,user_id,status,area,brand_name,branch_name,room_type_name,room_type2,channel_group,channel_name,reservation_date,check_in_date,nights,peoples,payment_amount,original_price,lead_time',
}

/* 진행 상태 이벤트 (UI에서 구독 가능) */
const _listeners = new Set()
export function onFetchProgress(fn) { _listeners.add(fn); return () => _listeners.delete(fn) }
function emitProgress(tableName, stage, detail) {
  const ev = { tableName, stage, detail, ts: Date.now() }
  _listeners.forEach(fn => { try { fn(ev) } catch {} })
}

async function ensureTableData(tableName) {
  const entry = _tableCache[tableName]

  // 1) 메모리 캐시 히트 (버전 일치 + TTL 이내)
  if (entry?.data && entry?.ver === CACHE_VERSION && (Date.now() - entry.ts < TABLE_CACHE_TTL)) {
    const cols = TABLE_ESSENTIAL_COLS[tableName]
    if (cols && entry.data.length > 0) {
      const required = cols.split(',')
      const sample = entry.data[0]
      const missing = required.some(c => !(c in sample))
      if (missing) {
        _tableCache[tableName] = null
      } else {
        emitProgress(tableName, 'cache-hit', { source: 'memory' })
        return entry.data
      }
    } else {
      emitProgress(tableName, 'cache-hit', { source: 'memory' })
      return entry.data
    }
  }

  // 중복 fetch 방지
  if (entry?.promise) return entry.promise

  const promise = (async () => {
    try {
      // 2) IndexedDB 캐시 체크 (네트워크보다 훨씬 빠름)
      const idbEntry = await idbGet(tableName, IDB_CACHE_TTL)
      if (idbEntry?.data?.length > 0 && idbEntry?.ver === CACHE_VERSION) {
        // ★ 캐시 데이터에도 dedup 적용 (stale 캐시 중복 방지)
        const cleaned = deduplicateRows(idbEntry.data)
        emitProgress(tableName, 'cache-hit', { source: 'indexeddb', age: idbEntry.age })
        _tableCache[tableName] = { data: cleaned, ts: Date.now(), ver: CACHE_VERSION, promise: null }

        // 백그라운드 갱신 (1시간 이상 된 경우)
        if (idbEntry.age > 3_600_000) {
          setTimeout(() => refreshTableInBackground(tableName), 100)
        }

        return cleaned
      }

      // IndexedDB 캐시 버전 불일치 시 삭제
      if (idbEntry?.data && idbEntry?.ver !== CACHE_VERSION) {
        idbDelete(tableName).catch(() => {})
      }

      // 3) 네트워크 fetch
      emitProgress(tableName, 'fetching', { message: '서버에서 데이터 로딩 중...' })
      const cols = TABLE_ESSENTIAL_COLS[tableName] || '*'
      const rawRows = await fetchAll(tableName, cols)

      /* 🔍 marketing_data 디버그: 로딩 직후 상태 */
      if (tableName === 'marketing_data') {
        const sample = rawRows?.[0]
        console.log('[ensureTableData] marketing_data 네트워크 fetch:', {
          rowCount: rawRows?.length || 0,
          columns: sample ? Object.keys(sample).slice(0, 15) : [],
          hasId: sample?.id != null,
          sampleSpend: sample?.['Cost (Channel)'],
          sampleDate: sample?.['Event Date'],
        })
      }

      // ★ 네트워크 데이터에도 dedup 적용 (페이지네이션 경계 + CSV 중복)
      const rows = deduplicateRows(rawRows)

      if (tableName === 'marketing_data') {
        console.log('[ensureTableData] marketing_data dedup 후:', {
          before: rawRows?.length || 0,
          after: rows?.length || 0,
          removed: (rawRows?.length || 0) - (rows?.length || 0),
        })
      }

      // 양쪽 캐시에 저장 (버전 포함)
      _tableCache[tableName] = { data: rows, ts: Date.now(), ver: CACHE_VERSION, promise: null }
      idbSet(tableName, rows, CACHE_VERSION).catch(() => {}) // 비동기, 실패해도 무시
      emitProgress(tableName, 'loaded', { rowCount: rows.length })

      return rows
    } catch (e) {
      _tableCache[tableName] = { ...(_tableCache[tableName] || {}), promise: null }
      emitProgress(tableName, 'error', { message: e.message })
      throw e
    }
  })()

  _tableCache[tableName] = { ...(_tableCache[tableName] || {}), promise }
  return promise
}

/* 백그라운드 갱신: UI 블로킹 없이 최신 데이터로 교체 */
async function refreshTableInBackground(tableName) {
  try {
    const cols = TABLE_ESSENTIAL_COLS[tableName] || '*'
    const rawRows = await fetchAll(tableName, cols)
    const rows = deduplicateRows(rawRows)
    _tableCache[tableName] = { data: rows, ts: Date.now(), ver: CACHE_VERSION, promise: null }
    await idbSet(tableName, rows, CACHE_VERSION)
    emitProgress(tableName, 'bg-refresh', { rowCount: rows.length })
  } catch (e) {
    console.warn(`[bg-refresh] ${tableName} 실패:`, e.message)
  }
}

/* ═══════════════════════════════════════════════
   fetchByDateRange: 전체 캐시 → 클라이언트 필터
   ═══════════════════════════════════════════════ */
export async function fetchByDateRange(tableName, dateColumn, startDate, endDate, columns = '*') {
  if (!supabase) return []

  const allData = await ensureTableData(tableName)

  if (!dateColumn || !startDate || !endDate) return allData

  return allData.filter(row => {
    const d = String(row[dateColumn] || '').slice(0, 10)
    return d && d >= startDate && d <= endDate
  })
}

/* ═══════════════════════════════════════════════
   캐시 관리
   ═══════════════════════════════════════════════ */
/** 특정 테이블 캐시 무효화 (메모리 + IndexedDB) */
export function invalidateTableCache(tableName) {
  if (tableName) {
    delete _tableCache[tableName]
    idbDelete(tableName).catch(() => {})
  } else {
    Object.keys(_tableCache).forEach(k => delete _tableCache[k])
    idbClear().catch(() => {})
  }
}

/* ═══════════════════════════════════════════════
   프리페치: 앱 시작시 주요 테이블 미리 로딩

   사용법: 앱 최초 렌더 시 prefetchTables() 호출
   → 대시보드 진입 전에 데이터가 이미 캐시에 있음
   ═══════════════════════════════════════════════ */
const PREFETCH_TABLES = ['product_revenue_raw', 'marketing_data']

export function prefetchTables() {
  if (!supabase) return

  // 비동기로 각 테이블 프리페치 (에러 무시)
  PREFETCH_TABLES.forEach(t => {
    ensureTableData(t).catch(() => {})
  })
}
