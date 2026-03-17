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
const MAX_ROWS = 100_000

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

  const PAGE = 5000
  let from = 0
  const all = []

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...data)

    if (all.length >= MAX_ROWS) {
      console.warn(`[fetchAll] ${tableName}: ${MAX_ROWS.toLocaleString()}행 제한 도달 — 데이터가 잘릴 수 있습니다.`)
      break
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  return normalizeRows(all)
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

export async function fetchByDateRange(tableName, dateColumn, startDate, endDate, columns = '*') {
  if (!supabase) {
    console.warn('[fetchByDateRange] supabase 클라이언트가 초기화되지 않았습니다.')
    return []
  }
  if (!dateColumn || !startDate || !endDate) {
    return fetchAll(tableName, columns)
  }

  const PAGE = 5000
  let from = 0
  const all = []

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(columns)
      .gte(dateColumn, startDate)
      .lte(dateColumn, endDate)
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    all.push(...data)

    if (all.length >= MAX_ROWS) {
      console.warn(`[fetchByDateRange] ${tableName}: ${MAX_ROWS.toLocaleString()}행 제한 도달`)
      break
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  return normalizeRows(all)
}
