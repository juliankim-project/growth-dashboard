import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, Check, X, RefreshCw, ChevronDown } from 'lucide-react'
import { usePickerSearch } from './usePickerSearch'

/* ── 카테고리 탭 정의 ── */
const TAB_DEFS = [
  { id: 'all',      label: '전체' },
  { id: 'metric',   label: '기본' },
  { id: 'derived',  label: '파생' },
  { id: 'computed', label: '계산' },
]

function groupCategory(m) {
  if (m._computed) return 'computed'
  if (m.derived)   return 'derived'
  return m.group || 'metric'
}

/* ────────────────────────────────────────────────
   MetricPicker — 검색 + 탭 + 체크박스 팝오버
──────────────────────────────────────────────── */
export default function MetricPicker({ metrics = [], selected, onSelect, multi = false, dark, onRefresh }) {
  const [open, setOpen] = useState(false)
  const [localSel, setLocalSel] = useState(() =>
    multi ? (Array.isArray(selected) ? [...selected] : []) : selected || ''
  )
  const [activeTab, setActiveTab] = useState('all')
  const { query, setQuery, filtered } = usePickerSearch(metrics)
  const popRef = useRef(null)

  /* 외부 클릭 닫기 */
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  /* 팝오버 열릴 때 로컬 선택 동기화 */
  useEffect(() => {
    if (open) {
      setLocalSel(multi ? (Array.isArray(selected) ? [...selected] : []) : selected || '')
      setQuery('')
      setActiveTab('all')
    }
  }, [open]) // eslint-disable-line

  /* 탭별 카운트 */
  const tabCounts = useMemo(() => {
    const c = { all: metrics.length, metric: 0, derived: 0, computed: 0 }
    metrics.forEach(m => { const g = groupCategory(m); if (c[g] !== undefined) c[g]++ })
    return c
  }, [metrics])

  /* 탭 + 검색 필터 적용 */
  const visibleItems = useMemo(() => {
    return filtered.filter(m => activeTab === 'all' || groupCategory(m) === activeTab)
  }, [filtered, activeTab])

  /* 체크 토글 */
  const toggle = (mid) => {
    if (multi) {
      setLocalSel(prev => prev.includes(mid) ? prev.filter(x => x !== mid) : [...prev, mid])
    } else {
      onSelect(mid)
      setOpen(false)
    }
  }

  /* 적용 */
  const apply = () => { onSelect(localSel); setOpen(false) }

  /* 트리거 라벨 */
  const selArr = multi ? (Array.isArray(selected) ? selected : []) : (selected ? [selected] : [])
  const triggerLabel = selArr.length > 0
    ? selArr.map(id => metrics.find(m => m.id === id)?.label || id).join(', ')
    : '선택 안됨'

  const isSel = (mid) => multi ? localSel.includes(mid) : localSel === mid

  return (
    <div className="relative" ref={popRef}>
      {/* 트리거 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs w-full text-left transition-colors
          ${dark ? 'bg-[#1D2125] border-[#A1BDD914] text-slate-300 hover:border-[#579DFF]/40'
                 : 'bg-white border-slate-200 text-slate-600 hover:border-[#85B8FF]'}`}
      >
        <span className="flex-1 truncate">{triggerLabel}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
          ${selArr.length > 0
            ? 'bg-[#579DFF]/10 text-[#579DFF]'
            : dark ? 'bg-[#2C333A] text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
          {selArr.length}
        </span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 팝오버 */}
      {open && (
        <div className={`absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border shadow-xl
          ${dark ? 'bg-[#1D2125] border-[#A1BDD914]' : 'bg-white border-slate-200'}`}>

          {/* 검색 */}
          <div className="relative px-3 pt-3 pb-2">
            <Search size={14} className={`absolute left-5 top-1/2 -translate-y-1/2 mt-0.5
              ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="메트릭 검색"
              className={`w-full pl-7 pr-3 py-1.5 rounded-lg border text-xs outline-none
                ${dark ? 'bg-[#1D2125] border-[#A1BDD914] text-white placeholder:text-slate-500'
                       : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'}`}
              autoFocus
            />
          </div>

          {/* 탭 */}
          <div className={`flex gap-1 px-3 pb-2 border-b
            ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
            {TAB_DEFS.filter(t => t.id === 'all' || tabCounts[t.id] > 0).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors
                  ${activeTab === t.id
                    ? 'bg-[#579DFF]/10 text-[#579DFF] font-semibold'
                    : dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t.label} <span className="text-[10px] opacity-70">{tabCounts[t.id]}</span>
              </button>
            ))}
          </div>

          {/* 아이템 리스트 */}
          <div className="max-h-60 overflow-y-auto py-1">
            {visibleItems.length === 0 ? (
              <div className={`text-center py-6 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                검색 결과 없음
              </div>
            ) : visibleItems.map(m => {
              const checked = isSel(m.id)
              const isComputed = m._computed
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-xs transition-colors
                    ${isComputed ? 'border-l-2 border-l-violet-500' : 'border-l-2 border-l-transparent'}
                    ${checked
                      ? dark ? 'bg-[#579DFF]/5' : 'bg-[#E9F2FF]/50'
                      : dark ? 'hover:bg-[#22272B]' : 'hover:bg-slate-50'}`}
                >
                  {/* 체크박스 */}
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                    ${checked
                      ? 'bg-[#579DFF] border-[#579DFF]'
                      : dark ? 'border-[#3a3f50]' : 'border-slate-300'}`}>
                    {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                  {/* 라벨 */}
                  <span className={`flex-1 truncate
                    ${checked
                      ? 'text-[#579DFF] font-medium'
                      : dark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {m.label}
                  </span>
                  {/* 포맷 뱃지 */}
                  {m.fmt && m.fmt !== 'number' && (
                    <span className={`text-[9px] px-1 py-0.5 rounded shrink-0
                      ${dark ? 'bg-[#2C333A] text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                      {m.fmt === 'currency' ? '₩' : m.fmt === 'pct' ? '%' : m.fmt === 'roas' ? 'x' : m.fmt}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 하단 액션 바 */}
          {multi && (
            <div className={`flex items-center justify-between px-3 py-2 border-t
              ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
              <button
                type="button"
                onClick={onRefresh}
                className={`flex items-center gap-1 text-[11px]
                  ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <RefreshCw size={11} /> 새로고침
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)}
                  className={`text-[11px] px-3 py-1 rounded-md
                    ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                  취소
                </button>
                <button type="button" onClick={apply}
                  className="text-[11px] px-3 py-1 rounded-md bg-[#0C66E4] text-white hover:bg-[#0055CC] font-medium">
                  적용
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
