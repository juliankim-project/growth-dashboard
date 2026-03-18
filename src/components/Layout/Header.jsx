import { useState, useRef, useEffect, useMemo } from 'react'
import { Bell, Search, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, LogOut, User, ArrowRight } from 'lucide-react'
import { DEFAULT_SECTIONS } from './Sidebar'
import { DATE_PRESETS } from '../../store/useDateRange'

/* ──────────────────────────────────────────
   날짜 포맷 헬퍼
─────────────────────────────────────────── */
const fmtMD = d => d ? `${d.slice(5, 7)}.${d.slice(8, 10)}` : '—'
const fmtFull = d => d ? d.replace(/-/g, '.') : '—'
const toYMD = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/* ── 미니 캘린더 (월~일 순서) ── */
const DAY_HEADERS = ['월', '화', '수', '목', '금', '토', '일']

function MiniCalendar({ dark, year, month, rangeStart, rangeEnd, onSelectDate, showNav = true, onMonthChange }) {
  const t = dark
    ? { head: 'text-slate-500', day: 'text-slate-300', today: 'ring-2 ring-blue-400', muted: 'text-slate-600',
        inRange: 'bg-blue-500/15', startEnd: 'bg-blue-600 text-white', hover: 'hover:bg-[#2C333A]' }
    : { head: 'text-slate-400', day: 'text-slate-700', today: 'ring-2 ring-blue-500', muted: 'text-slate-300',
        inRange: 'bg-blue-50', startEnd: 'bg-blue-600 text-white', hover: 'hover:bg-slate-100' }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const rawFirstDay = new Date(year, month, 1).getDay() // 0=일
  const firstDay = rawFirstDay === 0 ? 6 : rawFirstDay - 1 // 월=0, 화=1 ... 일=6
  const todayStr = new Date().toISOString().slice(0, 10)
  const weeks = []
  let week = new Array(firstDay).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week) }

  return (
    <div>
      {/* 월 헤더 */}
      <div className="flex items-center justify-between mb-1.5">
        {showNav ? (
          <button onClick={() => onMonthChange?.(-1)} className={`p-1 rounded ${t.hover}`}>
            <ChevronLeft size={14} className={t.head} />
          </button>
        ) : <div className="w-6" />}
        <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
          {year}년 {month + 1}월
        </span>
        {showNav ? (
          <button onClick={() => onMonthChange?.(1)} className={`p-1 rounded ${t.hover}`}>
            <ChevronRight size={14} className={t.head} />
          </button>
        ) : <div className="w-6" />}
      </div>
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_HEADERS.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-semibold py-1 ${i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : t.head}`}>{d}</div>
        ))}
      </div>
      {/* 날짜 그리드 */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            if (!day) return <div key={di} />
            const dateStr = toYMD(year, month, day)
            const isToday = dateStr === todayStr
            const isStart = dateStr === rangeStart
            const isEnd = dateStr === rangeEnd
            const inRange = rangeStart && rangeEnd && dateStr >= rangeStart && dateStr <= rangeEnd
            const isStartOrEnd = isStart || isEnd
            const isSat = di === 5, isSun = di === 6

            return (
              <button key={di}
                onClick={() => onSelectDate(dateStr)}
                className={`text-xs py-1.5 text-center rounded-lg transition-all font-medium
                  ${isStartOrEnd ? t.startEnd
                    : inRange ? t.inRange + ' ' + t.day
                    : isSun ? 'text-red-400 ' + t.hover
                    : isSat ? 'text-blue-400 ' + t.hover
                    : t.day + ' ' + t.hover}
                  ${isToday && !isStartOrEnd ? t.today : ''}
                `}>
                {day}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────
   DateRangePicker 컴포넌트
─────────────────────────────────────────── */
function DateRangePicker({ dateRange, setPreset, setCustomRange, dark }) {
  const [open, setOpen] = useState(false)
  const [customStart, setCustomStart] = useState(dateRange.start || '')
  const [customEnd, setCustomEnd] = useState(dateRange.end || '')
  const [selectingStart, setSelectingStart] = useState(true) // true=시작일 선택중, false=종료일 선택중
  const ref = useRef(null)

  // 캘린더 표시 월 (2개월 표시)
  const initDate = dateRange.start ? new Date(dateRange.start) : new Date()
  const [calYear, setCalYear] = useState(initDate.getFullYear())
  const [calMonth, setCalMonth] = useState(initDate.getMonth())

  useEffect(() => {
    if (open) {
      setCustomStart(dateRange.start || '')
      setCustomEnd(dateRange.end || '')
      setSelectingStart(true)
      if (dateRange.start) {
        const d = new Date(dateRange.start)
        setCalYear(d.getFullYear())
        setCalMonth(d.getMonth())
      }
    }
  }, [open])

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const presetLabel = DATE_PRESETS.find(p => p.id === dateRange.preset)?.label
  const displayLabel = presetLabel ?? '직접 설정'

  // 선택 일수 계산
  const dayCount = useMemo(() => {
    if (!customStart || !customEnd) return 0
    return Math.round((new Date(customEnd) - new Date(customStart)) / 86400000) + 1
  }, [customStart, customEnd])

  const applyCustom = () => {
    if (!customStart || !customEnd || customStart > customEnd) return
    setCustomRange(customStart, customEnd)
    setOpen(false)
  }

  const onSelectDate = (dateStr) => {
    if (selectingStart) {
      setCustomStart(dateStr)
      setCustomEnd('')
      setSelectingStart(false)
    } else {
      if (dateStr < customStart) {
        setCustomStart(dateStr)
        setSelectingStart(false)
      } else {
        setCustomEnd(dateStr)
        setSelectingStart(true)
      }
    }
  }

  const changeMonth = (delta) => {
    let m = calMonth + delta
    let y = calYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setCalMonth(m)
    setCalYear(y)
  }

  // 월별 퀵 선택 버튼 (최근 6개월)
  const monthButtons = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const end = i === 0 ? now : last
      result.push({
        label: `${d.getMonth() + 1}월`,
        start: toYMD(d.getFullYear(), d.getMonth(), 1),
        end: toYMD(end.getFullYear(), end.getMonth(), end.getDate()),
      })
    }
    return result
  }, [])

  // 두번째 캘린더 월
  const cal2Month = calMonth + 1 > 11 ? 0 : calMonth + 1
  const cal2Year = calMonth + 1 > 11 ? calYear + 1 : calYear

  const inputCls = `w-full px-3 py-2 rounded-lg border text-xs outline-none transition-all cursor-pointer
    ${dark
      ? 'bg-[#1D2125] border-[#A1BDD914] text-white [color-scheme:dark] focus:border-[#579DFF]'
      : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-[#0C66E4]'}`

  return (
    <div className="relative" ref={ref}>
      {/* ── 트리거 버튼 ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-medium transition-all
          ${open
            ? dark ? 'bg-[#22272B] border-[#579DFF]/60 text-white' : 'bg-white border-[#0C66E4] text-slate-700 shadow-sm'
            : dark ? 'bg-[#22272B] border-[#A1BDD914] text-slate-300 hover:border-[#579DFF]/40 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-[#579DFF] shadow-sm'
          }`}
      >
        <CalendarDays size={16} className={dark ? 'text-[#579DFF]' : 'text-[#0C66E4]'} />
        <span className="font-semibold">{displayLabel}</span>
        <span className={`hidden sm:inline text-xs ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
          {fmtMD(dateRange.start)} – {fmtMD(dateRange.end)}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''} ${dark ? 'text-slate-400' : 'text-slate-700'}`} />
      </button>

      {/* ── 드롭다운 ── */}
      {open && (
        <div className={`absolute right-0 top-[calc(100%+6px)] z-[100] rounded-xl border shadow-2xl
          ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200'}`}
          style={{ width: 700 }}>

          <div className="flex">
            {/* ── 좌측: 월별 + 기간별 ── */}
            <div className={`w-[150px] shrink-0 border-r ${dark ? 'border-[#A1BDD914] bg-[#1D2125]' : 'border-slate-100 bg-slate-50'} p-2 flex flex-col`}>
              {/* 월별 — 2열 그리드 */}
              <p className={`text-[10px] font-bold px-1 mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>월별</p>
              <div className="grid grid-cols-2 gap-1 mb-2">
                {monthButtons.map((mb, i) => {
                  const yr = mb.start.slice(2, 4)
                  const mo = parseInt(mb.start.slice(5, 7))
                  return (
                    <button key={i}
                      onClick={() => { setCustomRange(mb.start, mb.end); setOpen(false) }}
                      className={`px-1.5 py-1.5 rounded text-[11px] font-medium transition-colors text-center
                        ${dark ? 'text-slate-300 hover:bg-[#22272B] hover:text-white' : 'text-slate-600 hover:bg-white hover:text-slate-800'}`}>
                      {yr}.{String(mo).padStart(2, '0')}
                    </button>
                  )
                })}
              </div>
              {/* 기간별 — 2열 그리드 */}
              <p className={`text-[10px] font-bold px-1 mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>기간별</p>
              <div className="grid grid-cols-2 gap-0.5">
                {DATE_PRESETS.map(p => (
                  <button key={p.id}
                    onClick={() => { setPreset(p.id); setOpen(false) }}
                    className={`px-1.5 py-1.5 rounded text-[11px] font-medium transition-colors text-center
                      ${dateRange.preset === p.id
                        ? 'bg-blue-600 text-white'
                        : dark ? 'text-slate-300 hover:bg-[#22272B] hover:text-white' : 'text-slate-600 hover:bg-white hover:text-slate-800'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 우측: 날짜 인풋 + 듀얼 캘린더 + 적용 ── */}
            <div className="flex-1 p-3 flex flex-col gap-2">
              {/* 시작일~종료일 인풋 */}
              <div className="flex items-center gap-2">
                <div className="flex-1" onClick={() => setSelectingStart(true)}>
                  <input type="date" value={customStart} readOnly
                    className={`${inputCls} ${selectingStart ? (dark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50') : ''}`} />
                </div>
                <ArrowRight size={14} className={dark ? 'text-slate-500' : 'text-slate-400'} />
                <div className="flex-1" onClick={() => setSelectingStart(false)}>
                  <input type="date" value={customEnd} readOnly
                    className={`${inputCls} ${!selectingStart ? (dark ? 'border-blue-500 bg-blue-500/10' : 'border-blue-500 bg-blue-50') : ''}`} />
                </div>
                {dayCount > 0 && (
                  <span className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg shrink-0 ${dark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    {dayCount}일
                  </span>
                )}
              </div>

              {/* 듀얼 캘린더 */}
              <div className="grid grid-cols-2 gap-5">
                <MiniCalendar dark={dark} year={calYear} month={calMonth}
                  rangeStart={customStart} rangeEnd={customEnd}
                  onSelectDate={onSelectDate} showNav onMonthChange={changeMonth} />
                <MiniCalendar dark={dark} year={cal2Year} month={cal2Month}
                  rangeStart={customStart} rangeEnd={customEnd}
                  onSelectDate={onSelectDate} showNav={false} />
              </div>

              {/* 적용 버튼 */}
              <button onClick={applyCustom}
                disabled={!customStart || !customEnd || customStart > customEnd}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg
                  hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {customStart && customEnd && customStart <= customEnd
                  ? `${fmtFull(customStart)} ~ ${fmtFull(customEnd)} 적용`
                  : '날짜를 선택하세요'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   유저 아바타 + 로그아웃 드롭다운
─────────────────────────────────────────── */
function UserMenu({ user, onSignOut, dark }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* 이메일 첫 글자 또는 Google 아바타 */
  const email    = user?.email || ''
  const initial  = email.charAt(0).toUpperCase() || 'G'
  const avatar   = user?.user_metadata?.avatar_url   // Google OAuth 시 있음
  const name     = user?.user_metadata?.full_name || email

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full focus:outline-none"
      >
        {avatar
          ? <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-[#579DFF]/30" />
          : (
            <div className="w-9 h-9 rounded-full bg-[#0C66E4] flex items-center justify-center text-white text-sm font-bold ring-2 ring-[#579DFF]/30">
              {initial}
            </div>
          )
        }
      </button>

      {open && (
        <div className={`
          absolute right-0 top-[calc(100%+8px)] z-[100] w-64 rounded-xl border shadow-2xl overflow-hidden
          ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200'}
        `}>
          {/* 유저 정보 */}
          <div className={`px-4 py-3 border-b ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
            <div className="flex items-center gap-2.5">
              {avatar
                ? <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover" />
                : <div className="w-9 h-9 rounded-full bg-[#0C66E4] flex items-center justify-center text-white text-sm font-bold">{initial}</div>
              }
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${dark ? 'text-white' : 'text-slate-800'}`}>{name}</p>
                <p className={`text-xs truncate ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{email}</p>
              </div>
            </div>
          </div>

          {/* 로그아웃 */}
          <div className="p-1.5">
            <button
              onClick={() => { onSignOut(); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors
                ${dark
                  ? 'text-slate-400 hover:bg-red-500/10 hover:text-red-400'
                  : 'text-slate-600 hover:bg-red-50 hover:text-red-500'}`}
            >
              <LogOut size={15} />
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   Header 메인
─────────────────────────────────────────── */
export default function Header({ nav, dark, config, getL3Subs, dateRange, setPreset, setCustomRange, user, onSignOut }) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  /* ── 탭 라벨 (커스텀 라벨 우선) ── */
  const section       = DEFAULT_SECTIONS.find(s => s.id === nav.section)
  // 커스텀 L1 섹션 fallback
  const customSec     = (config?.customSections || []).find(s => s.id === nav.section)
  const sectionLabel  = config?.sectionLabels?.[nav.section] || section?.label || customSec?.label || ''

  // L2 서브 (빌트인 + 커스텀)
  const builtinSub    = section?.subs.find(s => s.id === nav.sub)
  const customSubItem = (config?.customSubs?.[nav.section] || []).find(s => s.id === nav.sub)
  const subKey        = `${nav.section}.${nav.sub}`
  const subLabel      = config?.subLabels?.[subKey] || builtinSub?.label || customSubItem?.label || ''

  // L3 서서브 (l3sub 이동 시 이름 표시)
  const l3subLabel = (() => {
    if (!nav.l3sub || !getL3Subs) return ''
    const l3subs = getL3Subs(nav.section, nav.sub)
    return l3subs.find(s => s.id === nav.l3sub)?.label || ''
  })()

  const title = l3subLabel || subLabel || sectionLabel

  const slash = <span className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-700'}`}>/</span>

  return (
    <header className={`
      flex items-center justify-between px-8 py-5 border-b shrink-0 transition-colors duration-200
      ${dark ? 'bg-[#1D2125] border-[#A1BDD914]' : 'bg-[#F7F8F9] border-[#DFE1E6]'}
    `}>
      {/* 좌측: 타이틀 + 브레드크럼 */}
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
            {sectionLabel}
          </span>
          {subLabel && (
            <>
              {slash}
              <span className={`text-sm font-medium ${l3subLabel ? (dark ? 'text-slate-400' : 'text-slate-700') : (dark ? 'text-[#579DFF]' : 'text-[#0C66E4]')}`}>
                {subLabel}
              </span>
            </>
          )}
          {l3subLabel && (
            <>
              {slash}
              <span className={`text-sm font-semibold ${dark ? 'text-[#579DFF]' : 'text-[#0C66E4]'}`}>
                {l3subLabel}
              </span>
            </>
          )}
        </div>
        <h1 className={`text-2xl font-bold mt-0.5 ${dark ? 'text-white' : 'text-slate-800'}`}>
          {title}
        </h1>
        <p className={`text-sm mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{today}</p>
      </div>

      {/* 우측: 날짜 필터 + 서치 + 알림 + 아바타 */}
      <div className="flex items-center gap-3">

        {/* 기간 필터 (dateRange props 있을 때만) */}
        {dateRange && (
          <DateRangePicker
            dateRange={dateRange}
            setPreset={setPreset}
            setCustomRange={setCustomRange}
            dark={dark}
          />
        )}

        <div className={`
          flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm
          ${dark ? 'bg-[#22272B] text-slate-400 border border-[#A1BDD914]' : 'bg-white text-slate-600 border border-slate-200'}
        `}>
          <Search size={16} />
          <span className="text-sm hidden sm:block">Search...</span>
        </div>

        <button className={`relative p-2.5 rounded-lg ${dark ? 'hover:bg-[#22272B] text-slate-400' : 'hover:bg-slate-100 text-slate-700'}`}>
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {user
          ? <UserMenu user={user} onSignOut={onSignOut} dark={dark} />
          : (
            <div className="w-9 h-9 rounded-full bg-[#0C66E4] flex items-center justify-center text-white text-sm font-bold">
              G
            </div>
          )
        }
      </div>
    </header>
  )
}
