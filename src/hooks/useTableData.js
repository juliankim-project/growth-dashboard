import { useState, useEffect } from 'react'
import { fetchAll, supabase } from '../lib/supabase'

/**
 * 범용 Supabase 테이블 데이터 훅
 * tableName 이 바뀌면 자동으로 재조회
 */
export function useTableData(tableName = 'marketing_perf') {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!supabase) {
      setError('Supabase 환경변수가 설정되지 않았습니다')
      setLoading(false)
      return
    }
    if (!tableName) {
      setData([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setData([])
    setError(null)

    fetchAll(tableName)
      .then(rows => {
        if (!cancelled) { setData(rows); setLoading(false) }
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [tableName])

  return { data, loading, error }
}
