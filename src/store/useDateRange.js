import { useState, useCallback } from 'react'

const STORAGE_KEY = 'growth_date_range'

/* ──────────────────────────────────────────
   프리셋 정의
─────────────────────────────────────────── */
export const DATE_PRESETS = [
  // 일 단위
  { id: '1d',  label: '어제',       group: 'day', type: 'days', days: 1  },
  { id: '7d',  label: '최근 7일',   group: 'day', type: 'days', days: 7  },
  { id: '14d', label: '최근 14일',  group: 'day', type: 'days', days: 14 },
  { id: '30d', label: '최근 30일',  group: 'day', type: 'days', days: 30 },
  // 주 단위
  { id: 'tw',  label: '이번주',     group: 'week', type: 'week',  offset: 0 },
  { id: 'lw',  label: '지난주',     group: 'week', type: 'week',  offset: -1 },
  // 월 단위
  { id: 'tm',  label: '이번달',     group: 'month', type: 'month', offset: 0 },
  { id: 'lm',  label: '지난달',     group: 'month', type: 'month', offset: -1 },
  { id: 'l3m', label: '최근 3개월', group: 'month', type: 'days',  days: 90 },
]

/* YYYY-MM-DD 문자열 반환 */
function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/* 프리셋 → 시작/종료 날짜 계산 */
export function getPresetRange(preset) {
  /* 하위 호환: 숫자만 넘기면 days로 처리 */
  if (typeof preset === 'number') {
    const end = new Date(); const start = new Date()
    start.setDate(start.getDate() - (preset - 1))
    return { start: toDateStr(start), end: toDateStr(end) }
  }

  const p = typeof preset === 'string'
    ? DATE_PRESETS.find(x => x.id === preset)
    : preset

  if (!p) return { start: toDateStr(new Date()), end: toDateStr(new Date()) }

  const today = new Date()

  if (p.type === 'days') {
    const end = new Date(); const start = new Date()
    start.setDate(start.getDate() - ((p.days || 1) - 1))
    return { start: toDateStr(start), end: toDateStr(end) }
  }

  if (p.type === 'week') {
    const off = p.offset || 0
    /* 이번주 월요일 기준 */
    const dayOfWeek = today.getDay() || 7 // 일=7, 월=1 ... 토=6
    const monday = new Date(today)
    monday.setDate(today.getDate() - (dayOfWeek - 1) + off * 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const end = off === 0 ? today : sunday // 이번주면 오늘까지, 지난주면 일요일까지
    return { start: toDateStr(monday), end: toDateStr(end) }
  }

  if (p.type === 'month') {
    const off = p.offset || 0
    const y = today.getFullYear()
    const m = today.getMonth() + off
    const first = new Date(y, m, 1)
    const lastDay = new Date(y, m + 1, 0)
    const end = off === 0 ? today : lastDay // 이번달이면 오늘까지, 지난달이면 말일까지
    return { start: toDateStr(first), end: toDateStr(end) }
  }

  return { start: toDateStr(today), end: toDateStr(today) }
}

/**
 * 이전 기간 계산 (ComparisonWidget + 데이터 fetch 공통)
 * - 월 프리셋: 이전 달 전체 (또는 같은 일자까지)
 * - 주 프리셋: 7일 전으로 시프트
 * - 일/커스텀: 동일 일수 직전 기간
 */
export function getPreviousPeriod(dateRange) {
  if (!dateRange?.start || !dateRange?.end) return { start: null, end: null }

  const preset = dateRange.preset
  const presetDef = preset ? DATE_PRESETS.find(x => x.id === preset) : null

  if (presetDef?.type === 'month') {
    const s = new Date(dateRange.start + 'T00:00:00')
    const e = new Date(dateRange.end + 'T00:00:00')
    /* 이전 달 1일 */
    const prevFirst = new Date(s.getFullYear(), s.getMonth() - 1, 1)

    if (presetDef.offset === 0) {
      /* 이번달 (1일~오늘): 이전 = 지난달 1일 ~ 같은 일자(또는 말일) */
      const dayOfMonth = e.getDate()
      const prevLast = new Date(s.getFullYear(), s.getMonth(), 0) // 이전 달 말일
      const prevEndDay = Math.min(dayOfMonth, prevLast.getDate())
      return {
        start: toDateStr(prevFirst),
        end: toDateStr(new Date(prevFirst.getFullYear(), prevFirst.getMonth(), prevEndDay))
      }
    }
    /* 지난달 등 (전체 월): 이전 = 그 전 달 전체 */
    const prevLast = new Date(s.getFullYear(), s.getMonth(), 0)
    return { start: toDateStr(prevFirst), end: toDateStr(prevLast) }
  }

  if (presetDef?.type === 'week') {
    /* 주 단위: 7일 전으로 시프트 */
    const s = new Date(dateRange.start + 'T00:00:00')
    const e = new Date(dateRange.end + 'T00:00:00')
    const prevS = new Date(s); prevS.setDate(s.getDate() - 7)
    const prevE = new Date(e); prevE.setDate(e.getDate() - 7)
    return { start: toDateStr(prevS), end: toDateStr(prevE) }
  }

  /* 일 단위 / 커스텀: 동일 일수 직전 기간 */
  const s = new Date(dateRange.start + 'T00:00:00')
  const e = new Date(dateRange.end + 'T00:00:00')
  const daySpan = Math.round((e.getTime() - s.getTime()) / 86400000) // start~end 사이 일수 (exclusive)
  const prevE = new Date(s); prevE.setDate(s.getDate() - 1)          // start - 1일
  const prevS = new Date(prevE); prevS.setDate(prevE.getDate() - daySpan) // prevEnd - span
  return { start: toDateStr(prevS), end: toDateStr(prevE) }
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
    persist({ preset: presetId, ...getPresetRange(p) })
  }, [persist])

  /** 직접 날짜 지정 */
  const setCustomRange = useCallback((start, end) => {
    persist({ preset: 'custom', start, end })
  }, [persist])

  /**
   * data 배열을 dateRange 기준으로 필터링
   * @param {Array} data - 필터링할 데이터 배열
   * @param {string} [explicitDateCol] - columnConfig.dateColumn 등으로 명시된 날짜 컬럼
   */
  const filterByDate = useCallback((data, explicitDateCol) => {
    const { start, end } = state
    if (!start || !end || !Array.isArray(data) || data.length === 0) return data
    const row0 = data[0]

    /* 1) 명시적 dateColumn 우선 → 2) 자동 감지 폴백 */
    let dateCol = explicitDateCol && row0[explicitDateCol] != null ? explicitDateCol : null
    if (!dateCol) {
      const DATE_FIELDS = ['date', 'Event Date', 'reservation_date', 'check_in_date', 'check_in', 'reserved_at', 'created_at', 'updated_at']
      dateCol = DATE_FIELDS.find(f => row0[f] != null)
    }
    if (!dateCol) return data  /* 날짜 컬럼 없으면 필터 건너뜀 */

    return data.filter(r => {
      const d = String(r[dateCol] || '').slice(0, 10)
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
