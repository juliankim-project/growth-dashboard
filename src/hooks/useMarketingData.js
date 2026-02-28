import { useState, useEffect } from 'react'
import { fetchAll, supabase } from '../lib/supabase'

export function useMarketingData() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    // Supabase 연결 없으면 빈 데이터로 종료
    if (!supabase) {
      setError('Supabase 환경변수가 설정되지 않았습니다')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchAll('marketing_perf')
      .then(rows => {
        if (!cancelled) {
          setData(rows)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  return { data, loading, error }
}
