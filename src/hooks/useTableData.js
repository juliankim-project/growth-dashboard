import { useState, useEffect, useMemo } from 'react'
import { fetchByDateRange, supabase } from '../lib/supabase'
import { getNeededColumns } from '../store/columnUtils'
import { getPreviousPeriod } from '../store/useDateRange'

/**
 * 범용 Supabase 테이블 데이터 훅
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
    if (!tableName) { setData([]); setLoading(false); return }

    let cancelled = false
    setLoading(true)
    setData([])
    setError(null)

    // ★ fetchByDateRange(null) → ensureTableData 경유 (캐시+dedup 보장)
    fetchByDateRange(tableName, null, null, null)
      .then(rows => { if (!cancelled) { setData(rows); setLoading(false) } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })

    return () => { cancelled = true }
  }, [tableName])

  return { data, loading, error }
}

/** 전체 캐시 무효화 (CSV 업로드 후 호출) — supabase.js 캐시 사용 */
export function invalidateTableCache() {
  // supabase.js의 캐시가 메인 → 여기서는 no-op
  // supabase.js의 invalidateTableDataCache()를 직접 호출할 것
}

/**
 * 여러 테이블 동시 조회 훅
 * - 캐시는 supabase.js의 ensureTableData에서 관리 (30분 TTL)
 * - 여기서는 캐시 없이 매번 호출 → supabase.js가 캐시 히트하면 즉시 반환
 * - ComparisonWidget을 위해 이전 기간도 포함
 */
export function useMultiTableData(tableNames = [], dateRange = null, columnConfig = null) {
  const [dataMap,  setDataMap]  = useState({})
  const [loading,  setLoading]  = useState(true)
  const [errors,   setErrors]   = useState({})

  const tableKey = tableNames.filter(Boolean).sort().join(',')
  const uniqueTables = useMemo(
    () => [...new Set(tableNames.filter(Boolean))].sort(),
    [tableKey]
  )

  const dateKey = dateRange?.start && dateRange?.end
    ? `${dateRange.start}_${dateRange.end}` : 'all'

  const key = tableKey + '|' + dateKey

  useEffect(() => {
    if (!supabase) {
      setErrors({ _global: 'Supabase 환경변수가 설정되지 않았습니다' })
      setLoading(false)
      return
    }
    if (uniqueTables.length === 0) {
      setDataMap({}); setErrors({}); setLoading(false)
      return
    }

    // ComparisonWidget을 위해 이전 기간도 포함
    let expandedStart = dateRange?.start
    if (dateRange?.start && dateRange?.end) {
      const prev = getPreviousPeriod(dateRange)
      expandedStart = prev.start || dateRange.start
    }

    let cancelled = false
    setLoading(true)

    Promise.all(
      uniqueTables.map(t => {
        /* dateColumn: columnConfig 우선, marketing_data는 'date' 폴백 */
        const dateCol = columnConfig?.[t]?.dateColumn
          || (t === 'marketing_data' ? 'date' : null)

        // ★ 항상 fetchByDateRange 경유 → ensureTableData(캐시+dedup) 보장
        // dateCol이 없으면 전체 데이터 반환, 있으면 날짜 필터 적용
        const fetcher = fetchByDateRange(
          t,
          dateCol || null,
          (dateCol && expandedStart) ? expandedStart : null,
          (dateCol && dateRange?.end) ? dateRange.end : null
        )

        return fetcher
          .then(rows => ({ table: t, rows, error: null }))
          .catch(err => ({ table: t, rows: [], error: err.message }))
      })
    ).then(results => {
      if (cancelled) return
      const newMap = {}
      const errs = {}
      results.forEach(r => {
        newMap[r.table] = r.rows
        if (r.error) errs[r.table] = r.error
      })
      setDataMap(newMap)
      setErrors(errs)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [key])

  return { dataMap, loading, errors }
}
