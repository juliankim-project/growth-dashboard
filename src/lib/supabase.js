import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

const isMissingEnv = !supabaseUrl || !supabaseAnon

if (isMissingEnv) {
  console.error('⚠️ Supabase 환경변수 누락: VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY 확인 필요')
}

// 환경변수 없어도 앱이 죽지 않도록 fallback
export const supabase = isMissingEnv
  ? null
  : createClient(supabaseUrl, supabaseAnon)

/** 페이지네이션으로 전체 데이터 fetch */
export async function fetchAll(tableName) {
  const PAGE = 1000
  let from = 0
  let all  = []

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    all = [...all, ...data]
    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}
