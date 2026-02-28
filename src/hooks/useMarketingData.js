import { useState, useEffect } from 'react'
import { fetchAll } from '../lib/supabase'

export function useMarketingData() {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
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
