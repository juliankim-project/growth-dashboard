import { useState, useRef, useEffect } from 'react'
import { Bell, Search, CalendarDays, ChevronDown } from 'lucide-react'
import { DEFAULT_SECTIONS } from './Sidebar'
import { DATE_PRESETS } from '../../store/useDateRange'

/* ──────────────────────────────────────────
   날짜 포맷 헬퍼
─────────────────────────────────────────── */
const fmtMD = d => d ? `${d.slice(5, 7)}.${d.slice(8, 10)}` : '—'   // MM.DD
const fmtFull = d => d ? d.replace(/-/g, '.') : '—'                   // YYYY.MM.DD

/* ──────────────────────────────────────────
   DateRangePicker 컴포넌트
─────────────────────────────────────────── */
function DateRangePicker({ dateRange, setPreset, setCustomRange, dark }) {
  const [open,        setOpen]        = useState(false)
  const [customStart, setCustomStart] = useState(dateRange.start || '')
  const [customEnd,   setCustomEnd]   = useState(dateRange.end   || '')
  const ref = useRef(null)

  /* 드롭다운 열릴 때 현재 값으로 인풋 동기화 */
  useEffect(() => {
    if (open) {
      setCustomStart(dateRange.start || '')
      setCustomEnd(dateRange.end   || '')
    }
  }, [open, dateRange.start, dateRange.end])

  /* 외부 클릭 시 닫기 */
  useEffect(() => {
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const presetLabel = DATE_PRESETS.find(p => p.id === dateRange.preset)?.label
  const displayLabel = presetLabel ?? '직접 설정'

  const applyCustom = () => {
    if (!customStart || !customEnd) return
    if (customStart > customEnd) return
    setCustomRange(customStart, customEnd)
    setOpen(false)
  }

  const inputCls = `w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition-colors
    ${dark
      ? 'bg-[#0F1117] border-[#252836] text-white [color-scheme:dark] focus:border-indigo-500'
      : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-indigo-400'}`

  return (
    <div className="relative" ref={ref}>
      {/* ── 트리거 버튼 ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all
          ${open
            ? dark
              ? 'bg-[#1A1D27] border-indigo-500/60 text-white'
              : 'bg-white border-indigo-400 text-slate-700 shadow-sm'
            : dark
              ? 'bg-[#1A1D27] border-[#252836] text-slate-300 hover:border-indigo-500/40 hover:text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 shadow-sm'
          }`}
      >
        <CalendarDays size={13} className={dark ? 'text-indigo-400' : 'text-indigo-500'} />
        <span className="font-semibold">{displayLabel}</span>
        <span className={`hidden sm:inline text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          {fmtMD(dateRange.start)} – {fmtMD(dateRange.end)}
        </span>
        <ChevronDown
          size={12}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}
            ${dark ? 'text-slate-500' : 'text-slate-400'}`}
        />
      </button>

      {/* ── 드롭다운 ── */}
      {open && (
        <div className={`
          absolute right-0 top-[calc(100%+8px)] z-[100] w-72 rounded-xl border shadow-2xl overflow-hidden
          ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}
        `}>
          {/* 프리셋 버튼 */}
          <div className="p-3 flex flex-wrap gap-1.5">
            {DATE_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => { setPreset(p.id); setOpen(false) }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${dateRange.preset === p.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : dark
                      ? 'bg-[#13151C] text-slate-400 hover:bg-indigo-600/20 hover:text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`} />

          {/* 직접 날짜 설정 */}
          <div className="p-3 flex flex-col gap-2.5">
            <p className={`text-[10px] font-bold uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              직접 설정
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={`text-[10px] mb-1 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>시작일</p>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={e => setCustomStart(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <p className={`text-[10px] mb-1 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>종료일</p>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={e => setCustomEnd(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* 적용 버튼 */}
            <button
              onClick={applyCustom}
              disabled={!customStart || !customEnd || customStart > customEnd}
              className="w-full px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg
                hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {customStart && customEnd && customStart <= customEnd
                ? `${fmtFull(customStart)} ~ ${fmtFull(customEnd)} 적용`
                : '적용'}
            </button>
          </div>

          {/* 선택된 기간 요약 */}
          {dateRange.preset === 'custom' && (
            <div className={`px-3 pb-3 text-[10px] ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
              현재: {fmtFull(dateRange.start)} ~ {fmtFull(dateRange.end)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   Header 메인
─────────────────────────────────────────── */
export default function Header({ nav, dark, config, dateRange, setPreset, setCustomRange }) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  /* 탭 라벨 (커스텀 라벨 우선) */
  const section = DEFAULT_SECTIONS.find(s => s.id === nav.section)
  const sub     = section?.subs.find(s => s.id === nav.sub)

  const sectionLabel = config?.sectionLabels?.[nav.section] || section?.label || ''
  const subKey       = `${nav.section}.${nav.sub}`
  const subLabel     = config?.subLabels?.[subKey] || sub?.label || ''
  const title        = subLabel || sectionLabel

  return (
    <header className={`
      flex items-center justify-between px-7 py-4 border-b shrink-0 transition-colors duration-200
      ${dark ? 'bg-[#13151C] border-[#1E2130]' : 'bg-[#F8FAFF] border-slate-200'}
    `}>
      {/* 좌측: 타이틀 + 브레드크럼 */}
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {sectionLabel}
          </span>
          {subLabel && (
            <>
              <span className={`text-xs ${dark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
              <span className={`text-xs font-semibold ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>
                {subLabel}
              </span>
            </>
          )}
        </div>
        <h1 className={`text-xl font-bold mt-0.5 ${dark ? 'text-white' : 'text-slate-800'}`}>
          {title}
        </h1>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>{today}</p>
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
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm
          ${dark ? 'bg-[#1A1D27] text-slate-400 border border-[#252836]' : 'bg-white text-slate-400 border border-slate-200'}
        `}>
          <Search size={13} />
          <span className="text-xs hidden sm:block">Search...</span>
        </div>

        <button className={`relative p-2 rounded-lg ${dark ? 'hover:bg-[#1A1D27] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
          G
        </div>
      </div>
    </header>
  )
}
