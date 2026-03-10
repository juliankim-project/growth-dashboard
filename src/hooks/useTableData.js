import { useState, useEffect, useRef } from 'react'
import { fetchAll, fetchByDateRange, supabase } from '../lib/supabase'
import { getNeededColumns } from '../store/columnUtils'

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
 * - dateRange가 있으면 서버사이드 날짜 필터링 적용
 * - ComparisonWidget을 위해 이전 기간도 포함하도록 확장
 * - columnConfig에서 dateColumn 자동 조회 + 필요 컬럼만 SELECT
 */
export function useMultiTableData(tableNames = [], dateRange = null, columnConfig = null) {
  const [dataMap,  setDataMap]  = useState({})
  const [loading,  setLoading]  = useState(true)
  const [errors,   setErrors]   = useState({})
  const prevKeyRef = useRef('')

  // 안정적 키: 정렬된 유니크 테이블 목록
  const uniqueTables = [...new Set(tableNames.filter(Boolean))].sort()

  // dateRange를 캐시키에 포함 → 날짜 변경 시 재조회
  const dateKey = dateRange?.start && dateRange?.end
    ? `${dateRange.start}_${dateRange.end}` : 'all'
  // columnConfig 유무도 키에 포함 (컬럼 선택 변경 시 재조회)
  const ccReady = columnConfig && Object.keys(columnConfig).length > 0 ? '1' : '0'
  const key = uniqueTables.join(',') + '|' + dateKey + '|' + ccReady

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

    // 이전과 동일한 테이블 세트 + 날짜면 다시 조회하지 않음
    if (key === prevKeyRef.current) return
    prevKeyRef.current = key

    let cancelled = false
    setLoading(true)

    // ComparisonWidget을 위해 이전 기간도 포함하도록 확장 범위 계산
    let expandedStart = dateRange?.start
    if (dateRange?.start && dateRange?.end) {
      const s = new Date(dateRange.start)
      const e = new Date(dateRange.end)
      const periodMs = e.getTime() - s.getTime()
      const prev = new Date(s.getTime() - periodMs - 86400000)
      expandedStart = prev.toISOString().slice(0, 10)
    }

    Promise.all(
      uniqueTables.map(t => {
        const dateCol = columnConfig?.[t]?.dateColumn
        const columns = getNeededColumns(t, columnConfig)
        const fetcher = (dateCol && expandedStart && dateRange?.end)
          ? fetchByDateRange(t, dateCol, expandedStart, dateRange.end, columns)
          : fetchAll(t, columns)

        return fetcher
          .then(rows => ({ table: t, rows, error: null }))
          .catch(err => ({ table: t, rows: [], error: err.message }))
      })
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
