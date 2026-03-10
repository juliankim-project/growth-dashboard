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
 * - supabase 클라이언트 null 방어
 * - MAX_ROWS 초과 시 자동 중단 (무한 fetch 방지)
 */
const MAX_ROWS = 100_000

export async function fetchAll(tableName) {
  if (!supabase) {
    console.warn('[fetchAll] supabase 클라이언트가 초기화되지 않았습니다. 환경변수를 확인하세요.')
    return []
  }

  const PAGE = 1000
  let from = 0
  let all = []

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    all = [...all, ...data]

    if (all.length >= MAX_ROWS) {
      console.warn(`[fetchAll] ${tableName}: ${MAX_ROWS.toLocaleString()}행 제한 도달 — 데이터가 잘릴 수 있습니다.`)
      break
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

/**
 * 서버사이드 날짜 필터링 fetch
 * - dateColumn, startDate, endDate가 모두 있으면 WHERE 절 추가
 * - 없으면 fetchAll 폴백
 */
export async function fetchByDateRange(tableName, dateColumn, startDate, endDate) {
  if (!supabase) {
    console.warn('[fetchByDateRange] supabase 클라이언트가 초기화되지 않았습니다.')
    return []
  }
  if (!dateColumn || !startDate || !endDate) {
    return fetchAll(tableName)
  }

  const PAGE = 1000
  let from = 0
  let all = []

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .gte(dateColumn, startDate)
      .lte(dateColumn, endDate)
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    all = [...all, ...data]

    if (all.length >= MAX_ROWS) {
      console.warn(`[fetchByDateRange] ${tableName}: ${MAX_ROWS.toLocaleString()}행 제한 도달`)
      break
    }

    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}
