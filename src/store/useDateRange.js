import { useState, useCallback } from 'react'

const STORAGE_KEY = 'growth_date_range'

/* ──────────────────────────────────────────
   프리셋 정의
─────────────────────────────────────────── */
export const DATE_PRESETS = [
  { id: '1d',  label: '최근 1일',  days: 1  },
  { id: '3d',  label: '최근 3일',  days: 3  },
  { id: '7d',  label: '최근 7일',  days: 7  },
  { id: '14d', label: '최근 14일', days: 14 },
  { id: '30d', label: '최근 30일', days: 30 },
]

/* YYYY-MM-DD 문자열 반환 */
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* days 기준 시작/종료 계산 */
export function getPresetRange(days) {
  const end   = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  return { start: toDateStr(start), end: toDateStr(end) }
}

/* 초기값 */
function getInitial() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved?.start && saved?.end) return saved
  } catch {}
  return { preset: '30d', ...getPresetRange(30) }
}

/* ──────────────────────────────────────────
   Hook
─────────────────────────────────────────── */
export function useDateRange() {
  const [state, _setState] = useState(getInitial)

  const persist = useCallback(next => {
    _setState(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  /** 프리셋 선택 */
  const setPreset = useCallback((presetId) => {
    const p = DATE_PRESETS.find(x => x.id === presetId)
    if (!p) return
    persist({ preset: presetId, ...getPresetRange(p.days) })
  }, [persist])

  /** 직접 날짜 지정 */
  const setCustomRange = useCallback((start, end) => {
    persist({ preset: 'custom', start, end })
  }, [persist])

  /**
   * data 배열을 dateRange 기준으로 필터링
   * Event Date 컬럼: 'YYYY-MM-DD...' 형식
   */
  const filterByDate = useCallback((data) => {
    const { start, end } = state
    if (!start || !end || !Array.isArray(data)) return data
    return data.filter(r => {
      const d = r['Event Date']?.slice(0, 10)
      return d && d >= start && d <= end
    })
  }, [state])

  return {
    dateRange:     state,
    setPreset,
    setCustomRange,
    filterByDate,
  }
}
