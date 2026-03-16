import { useState, useRef, useEffect } from 'react'
import { Bell, Search, CalendarDays, ChevronDown, LogOut, User } from 'lucide-react'
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
      ? 'bg-[#1D2125] border-[#A1BDD914] text-white [color-scheme:dark] focus:border-[#579DFF]'
      : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-[#0C66E4]'}`

  return (
    <div className="relative" ref={ref}>
      {/* ── 트리거 버튼 ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-medium transition-all
          ${open
            ? dark
              ? 'bg-[#22272B] border-[#579DFF]/60 text-white'
              : 'bg-white border-[#0C66E4] text-slate-700 shadow-sm'
            : dark
              ? 'bg-[#22272B] border-[#A1BDD914] text-slate-300 hover:border-[#579DFF]/40 hover:text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-[#579DFF] shadow-sm'
          }`}
      >
        <CalendarDays size={16} className={dark ? 'text-[#579DFF]' : 'text-[#0C66E4]'} />
        <span className="font-semibold">{displayLabel}</span>
        <span className={`hidden sm:inline text-xs ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
          {fmtMD(dateRange.start)} – {fmtMD(dateRange.end)}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}
            ${dark ? 'text-slate-400' : 'text-slate-700'}`}
        />
      </button>

      {/* ── 드롭다운 ── */}
      {open && (
        <div className={`
          absolute right-0 top-[calc(100%+8px)] z-[100] w-96 rounded-xl border shadow-2xl overflow-hidden
          ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200'}
        `}>
          {/* 프리셋 버튼 — 그룹별 */}
          <div className="p-3 flex flex-col gap-2">
            {[
              { key: 'day',   label: '일' },
              { key: 'week',  label: '주' },
              { key: 'month', label: '월' },
            ].map(g => {
              const items = DATE_PRESETS.filter(p => p.group === g.key)
              if (items.length === 0) return null
              return (
                <div key={g.key} className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-bold w-5 shrink-0 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{g.label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setPreset(p.id); setOpen(false) }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors
                          ${dateRange.preset === p.id
                            ? 'bg-[#0C66E4] text-white shadow-sm'
                            : dark
                              ? 'bg-[#1D2125] text-slate-400 hover:bg-[#0C66E4]/20 hover:text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-[#E9F2FF] hover:text-[#0C66E4]'
                          }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className={`border-t ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`} />

          {/* 직접 날짜 설정 */}
          <div className="p-3 flex flex-col gap-2.5">
            <p className={`text-xs font-bold uppercase tracking-widest ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
              직접 설정
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className={`text-xs mb-1 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>시작일</p>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={e => setCustomStart(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <p className={`text-xs mb-1 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>종료일</p>
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
              className="w-full px-4 py-2.5 bg-[#0C66E4] text-white text-xs font-semibold rounded-lg
                hover:bg-[#0055CC] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {customStart && customEnd && customStart <= customEnd
                ? `${fmtFull(customStart)} ~ ${fmtFull(customEnd)} 적용`
                : '적용'}
            </button>
          </div>

          {/* 선택된 기간 요약 */}
          {dateRange.preset === 'custom' && (
            <div className={`px-3 pb-3 text-xs ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
              현재: {fmtFull(dateRange.start)} ~ {fmtFull(dateRange.end)}
            </div>
          )}
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
