import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'keyword_trends_history_v1'
const MAX_HISTORY_ENTRIES = 1000
const HISTORY_RETENTION_DAYS = 90

/**
 * 키워드 트렌드 조회 이력 관리 훅
 * - 월간 검색량 변화 추적
 * - 날짜별 조회 히스토리 저장
 */
export function useKeywordTrendHistory() {
  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored)

      // 만료 데이터 정리
      const now = Date.now()
      const cleaned = {}
      Object.entries(parsed).forEach(([keyword, entries]) => {
        const filtered = entries.filter(
          e => now - e.timestamp < HISTORY_RETENTION_DAYS * 86400000
        )
        if (filtered.length > 0) {
          cleaned[keyword] = filtered
        }
      })

      return cleaned
    } catch {
      return {}
    }
  })

  // 로컬스토리지에 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch {
      console.warn('키워드 트렌드 이력 저장 실패')
    }
  }, [history])

  /**
   * 새 조회 결과 기록
   */
  const recordTrend = useCallback((keyword, data) => {
    setHistory(prev => {
      const updated = { ...prev }
      if (!updated[keyword]) {
        updated[keyword] = []
      }

      // 중복 제거 (같은 날짜)
      const today = new Date().toISOString().split('T')[0]
      updated[keyword] = updated[keyword].filter(e => e.date !== today)

      // 새 항목 추가
      updated[keyword].push({
        date: today,
        timestamp: Date.now(),
        pc: typeof data.monthlyPcQcCnt === 'number' ? data.monthlyPcQcCnt : 0,
        mobile: typeof data.monthlyMobileQcCnt === 'number' ? data.monthlyMobileQcCnt : 0,
        compIdx: data.compIdx || '-',
        ctr: data.monthlyAvePcCtr || 0,
        clkCnt: data.monthlyAvePcClkCnt || 0,
      })

      // 최근 항목 유지
      if (updated[keyword].length > 365) {
        updated[keyword] = updated[keyword].slice(-365)
      }

      return updated
    })
  }, [])

  /**
   * 특정 키워드의 트렌드 데이터 반환
   */
  const getTrendData = useCallback((keyword) => {
    const entries = history[keyword] || []
    return entries.sort((a, b) => a.timestamp - b.timestamp)
  }, [history])

  /**
   * 여러 키워드의 트렌드 데이터 (차트용)
   */
  const getTrendChartData = useCallback((keywords) => {
    if (!Array.isArray(keywords) || keywords.length === 0) return []

    // 모든 날짜 수집
    const dateSet = new Set()
    keywords.forEach(kw => {
      const trends = history[kw] || []
      trends.forEach(t => dateSet.add(t.date))
    })

    const dates = Array.from(dateSet).sort()

    // 날짜별 데이터 구조화
    return dates.map(date => {
      const row = { date }
      keywords.forEach(kw => {
        const trend = (history[kw] || []).find(t => t.date === date)
        if (trend) {
          row[kw] = trend.pc + trend.mobile
        }
      })
      return row
    })
  }, [history])

  /**
   * 키워드 트렌드 변화율 계산
   */
  const getTrendChangePercent = useCallback((keyword, days = 7) => {
    const trends = getTrendData(keyword)
    if (trends.length < 2) return 0

    const recent = trends.slice(-days)
    if (recent.length < 2) return 0

    const current = recent[recent.length - 1]
    const previous = recent[0]
    const currentVol = current.pc + current.mobile
    const previousVol = previous.pc + previous.mobile

    if (previousVol === 0) return 0
    return Math.round((currentVol - previousVol) / previousVol * 100)
  }, [getTrendData])

  /**
   * 트렌드 통계
   */
  const getTrendStats = useCallback((keyword) => {
    const trends = getTrendData(keyword)
    if (trends.length === 0) return null

    const volumes = trends.map(t => t.pc + t.mobile)
    const avg = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length)
    const max = Math.max(...volumes)
    const min = Math.min(...volumes)
    const latest = volumes[volumes.length - 1]

    return { avg, max, min, latest, count: trends.length }
  }, [getTrendData])

  /**
   * 이력 초기화
   */
  const clearHistory = useCallback(() => {
    setHistory({})
  }, [])

  /**
   * 특정 키워드 이력 삭제
   */
  const removeKeywordHistory = useCallback((keyword) => {
    setHistory(prev => {
      const updated = { ...prev }
      delete updated[keyword]
      return updated
    })
  }, [])

  return {
    history,
    recordTrend,
    getTrendData,
    getTrendChartData,
    getTrendChangePercent,
    getTrendStats,
    clearHistory,
    removeKeywordHistory,
  }
}
