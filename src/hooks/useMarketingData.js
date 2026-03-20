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

    // 최적화: fetchAll이 이미 supabase.js에서 캐싱 처리 → 중복 fetch 방지
    fetchAll('marketing_data')
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
