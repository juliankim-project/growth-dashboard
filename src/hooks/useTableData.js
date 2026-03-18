import { useState, useEffect, useRef, useMemo } from 'react'
import { fetchAll, fetchByDateRange, supabase } from '../lib/supabase'
import { getNeededColumns } from '../store/columnUtils'
import { getPreviousPeriod } from '../store/useDateRange'

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

/* ── 테이블별 캐시 — 동일 날짜+컬럼 조합은 재요청하지 않음 ── */
const tableCache = new Map()
const tableCacheTs = new Map()
const MAX_CACHE_SIZE = 50
const CACHE_TTL = 300_000 // 5분 후 캐시 만료 (로딩 최소화)

function getCacheKey(table, dateKey, ccReady) {
  return `${table}|${dateKey}|${ccReady}`
}

/** 전체 캐시 무효화 (CSV 업로드 후 호출) */
export function invalidateTableCache() {
  tableCache.clear()
  tableCacheTs.clear()
}

/**
 * 여러 테이블 동시 조회 훅
 * - dateRange가 있으면 서버사이드 날짜 필터링 적용
 * - ComparisonWidget을 위해 이전 기간도 포함하도록 확장
 * - columnConfig에서 dateColumn 자동 조회 + 필요 컬럼만 SELECT
 * - 증분 fetch: 캐시된 테이블은 재요청하지 않고, 새 테이블만 fetch
 */
export function useMultiTableData(tableNames = [], dateRange = null, columnConfig = null) {
  const [dataMap,  setDataMap]  = useState({})
  const [loading,  setLoading]  = useState(true)
  const [errors,   setErrors]   = useState({})
  const prevKeyRef = useRef('')

  // 안정적 키: 정렬된 유니크 테이블 목록 (메모이제이션으로 불필요 재계산 방지)
  const tableKey = tableNames.filter(Boolean).sort().join(',')
  const uniqueTables = useMemo(
    () => [...new Set(tableNames.filter(Boolean))].sort(),
    [tableKey]
  )

  // dateRange를 캐시키에 포함 → 날짜 변경 시 재조회
  const dateKey = dateRange?.start && dateRange?.end
    ? `${dateRange.start}_${dateRange.end}` : 'all'
  // columnConfig 유무도 키에 포함 (컬럼 선택 변경 시 재조회)
  const ccReady = columnConfig && Object.keys(columnConfig).length > 0 ? '1' : '0'
  const key = tableKey + '|' + dateKey + '|' + ccReady

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

    // 이전과 동일한 키 + 캐시가 있으면 재조회 불필요
    if (key === prevKeyRef.current && tableCache.size > 0) return
    prevKeyRef.current = key

    // ComparisonWidget을 위해 이전 기간도 포함하도록 확장 범위 계산
    let expandedStart = dateRange?.start
    if (dateRange?.start && dateRange?.end) {
      const prev = getPreviousPeriod(dateRange)
      expandedStart = prev.start || dateRange.start
    }

    /* 캐시 히트된 테이블과 새로 fetch할 테이블 분리 */
    const cachedMap = {}
    const tablesToFetch = []
    for (const t of uniqueTables) {
      const ck = getCacheKey(t, dateKey, ccReady)
      const cachedTs = tableCacheTs.get(ck)
      if (tableCache.has(ck) && cachedTs && (Date.now() - cachedTs < CACHE_TTL)) {
        cachedMap[t] = tableCache.get(ck)
      } else {
        tablesToFetch.push(t)
      }
    }

    /* 모든 테이블이 캐시 히트 → 즉시 반영 */
    if (tablesToFetch.length === 0) {
      setDataMap(cachedMap)
      setErrors({})
      setLoading(false)
      return
    }

    /* 캐시된 데이터 먼저 반영 (기존 테이블은 즉시 표시) */
    if (Object.keys(cachedMap).length > 0) {
      setDataMap(prev => ({ ...prev, ...cachedMap }))
    }

    let cancelled = false
    setLoading(true)

    Promise.all(
      tablesToFetch.map(t => {
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
      const newMap = { ...cachedMap }
      const errs = {}
      results.forEach(r => {
        newMap[r.table] = r.rows
        // 캐시에 저장 (LRU 방식으로 오래된 항목 제거)
        const ck = getCacheKey(r.table, dateKey, ccReady)
        tableCache.set(ck, r.rows)
        tableCacheTs.set(ck, Date.now())
        if (tableCache.size > MAX_CACHE_SIZE) {
          const oldest = tableCache.keys().next().value
          tableCache.delete(oldest)
          tableCacheTs.delete(oldest)
        }
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
