import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

const isMissingEnv = !supabaseUrl || !supabaseAnon

if (isMissingEnv) {
  console.error('⚠️ Supabase 환경변수 누락: VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY 확인 필요')
}

// 환경변수 없어도 앱이 죽지 않도록 fallback
export const supabase = isMissingEnv
  ? null
  : createClient(supabaseUrl, supabaseAnon)

/**
 * 페이지네이션으로 전체 데이터 fetch
 * - columns: Supabase select 문자열 (기본 '*')
 * - push 기반 누적으로 O(n) 메모리 사용
 */
const MAX_ROWS = 200_000 // 테이블 전체 커버 (114k+ 행)

/* DB 컬럼명 → 코드 내부 표준명 매핑 (한글/특수문자 컬럼 정규화) */
const COL_ALIASES = {
  '상품상세페이지_조회_app_web': 'view_content',
}

function normalizeRows(rows) {
  if (!rows?.length) return rows
  const aliases = Object.entries(COL_ALIASES)
  if (aliases.length === 0) return rows
  return rows.map(row => {
    const copy = { ...row }
    for (const [dbCol, stdCol] of aliases) {
      if (dbCol in copy && !(stdCol in copy)) {
        copy[stdCol] = copy[dbCol]
      }
    }
    return copy
  })
}

export async function fetchAll(tableName, columns = '*') {
  if (!supabase) {
    console.warn('[fetchAll] supabase 클라이언트가 초기화되지 않았습니다. 환경변수를 확인하세요.')
    return []
  }

  const PAGE = 10000
  const CONCURRENT = 4

  // 총 건수 조회
  const { count, error: countErr } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })

  if (countErr) throw countErr
  if (!count || count === 0) return []

  const totalPages = Math.min(Math.ceil(count / PAGE), Math.ceil(MAX_ROWS / PAGE))
  const all = new Array(totalPages)

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

  return normalizeRows(all.flat())
}

/**
 * 서버사이드 날짜 필터링 fetch
 * - dateColumn, startDate, endDate가 모두 있으면 WHERE 절 추가
 * - 없으면 fetchAll 폴백
 */
/**
 * 테이블의 날짜 컬럼 기준 최소/최대 날짜 + 총 행 수 조회
 */
export async function fetchDateRange(tableName, dateColumn) {
  if (!supabase || !dateColumn) return null
  try {
    // 최소 날짜
    const { data: minData, error: minErr } = await supabase
      .from(tableName)
      .select(dateColumn)
      .order(dateColumn, { ascending: true })
      .limit(1)
    if (minErr) throw minErr

    // 최대 날짜
    const { data: maxData, error: maxErr } = await supabase
      .from(tableName)
      .select(dateColumn)
      .order(dateColumn, { ascending: false })
      .limit(1)
    if (maxErr) throw maxErr

    // 총 행 수
    const { count, error: countErr } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true })
    if (countErr) throw countErr

    const minDate = minData?.[0]?.[dateColumn] || null
    const maxDate = maxData?.[0]?.[dateColumn] || null

    return { minDate, maxDate, totalRows: count }
  } catch (e) {
    console.error(`[fetchDateRange] ${tableName}:`, e)
    return null
  }
}

/* ═══════════════════════════════════════════════
   테이블별 전체 캐시: 1번 로딩 → 날짜 변경 즉시
   - 전체 데이터를 테이블별로 캐시
   - 날짜 필터링은 클라이언트에서 처리 (0ms)
   ═══════════════════════════════════════════════ */
const _tableCache = {} // { tableName: { data, ts, promise } }
const TABLE_CACHE_TTL = 1_800_000 // 30분

/* ── 테이블별 필수 컬럼 (타임아웃 방지: * 대신 필수만) ── */
const TABLE_ESSENTIAL_COLS = {
  product_revenue_raw: 'id,guest_id,user_id,status,area,brand_name,branch_name,room_type_name,room_type2,channel_group,channel_name,reservation_date,check_in_date,nights,peoples,payment_amount,original_price,lead_time',
}

async function ensureTableData(tableName) {
  const entry = _tableCache[tableName]

  // 메모리 캐시 히트
  if (entry?.data && (Date.now() - entry.ts < TABLE_CACHE_TTL)) return entry.data

  // 중복 fetch 방지
  if (entry?.promise) return entry.promise

  const promise = (async () => {
    try {
      // 테이블별 필수 컬럼 사용 (없으면 * 폴백)
      const cols = TABLE_ESSENTIAL_COLS[tableName] || '*'
      const rows = await fetchAll(tableName, cols)
      _tableCache[tableName] = { data: rows, ts: Date.now(), promise: null }
      return rows
    } catch (e) {
      _tableCache[tableName] = { ...(_tableCache[tableName] || {}), promise: null }
      throw e
    }
  })()

  _tableCache[tableName] = { ...(_tableCache[tableName] || {}), promise }
  return promise
}

export async function fetchByDateRange(tableName, dateColumn, startDate, endDate, columns = '*') {
  if (!supabase) {
    console.warn('[fetchByDateRange] supabase 클라이언트가 초기화되지 않았습니다.')
    return []
  }

  // 전체 데이터 1회 로딩 (항상 전체 컬럼으로 캐시)
  const allData = await ensureTableData(tableName)

  // 날짜 필터 없으면 전체 반환
  if (!dateColumn || !startDate || !endDate) return allData

  // 클라이언트 날짜 필터링 (즉시!)
  return allData.filter(row => {
    const d = String(row[dateColumn] || '').slice(0, 10)
    return d && d >= startDate && d <= endDate
  })
}

/** 특정 테이블 캐시 무효화 */
export function invalidateTableCache(tableName) {
  if (tableName) {
    delete _tableCache[tableName]
  } else {
    Object.keys(_tableCache).forEach(k => delete _tableCache[k])
  }
}
