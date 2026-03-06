import { useState, useEffect, useRef } from 'react'
import { fetchAll, supabase } from '../lib/supabase'

/**
 * 범용 Supabase 테이블 데이터 훅
 * tableName 이 바뀌면 자동으로 재조회
 */
export function useTableData(tableName = 'marketing_data') {
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

/**
 * 여러 테이블 동시 조회 훅
 * tableNames 배열이 바뀌면 자동으로 재조회
 * 반환: { dataMap: { tableName: rows[] }, loading, errors: { tableName: msg } }
 */
export function useMultiTableData(tableNames = []) {
  const [dataMap,  setDataMap]  = useState({})
  const [loading,  setLoading]  = useState(true)
  const [errors,   setErrors]   = useState({})
  const prevKeyRef = useRef('')

  // 안정적 키: 정렬된 유니크 테이블 목록
  const uniqueTables = [...new Set(tableNames.filter(Boolean))].sort()
  const key = uniqueTables.join(',')

  useEffect(() => {
    if (!supabase) {
      setErrors({ _global: 'Supabase 환경변수가 설정되지 않았습니다' })
      setLoading(false)
      return
    }
    if (uniqueTables.length === 0) {
      setDataMap({})
      setErrors({})
      setLoading(false)
      return
    }

    // 이전과 동일한 테이블 세트면 다시 조회하지 않음
    if (key === prevKeyRef.current) return
    prevKeyRef.current = key

    let cancelled = false
    setLoading(true)

    Promise.all(
      uniqueTables.map(t =>
        fetchAll(t)
          .then(rows => ({ table: t, rows, error: null }))
          .catch(err => ({ table: t, rows: [], error: err.message }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      const errs = {}
      results.forEach(r => {
        map[r.table] = r.rows
        if (r.error) errs[r.table] = r.error
      })
      setDataMap(map)
      setErrors(errs)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [key])

  return { dataMap, loading, errors }
}
