import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { usePickerSearch } from './usePickerSearch'

/* ────────────────────────────────────────────────
   GroupByPicker — 검색 + 라디오 팝오버
──────────────────────────────────────────────── */
export default function GroupByPicker({ options = [], selected, onSelect, dark }) {
  const [open, setOpen] = useState(false)
  const [localSel, setLocalSel] = useState(selected || '')
  const { query, setQuery, filtered } = usePickerSearch(options)
  const popRef = useRef(null)

  /* 외부 클릭 닫기 */
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (popRef.current && !popRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  /* 팝오버 열릴 때 동기화 */
  useEffect(() => {
    if (open) { setLocalSel(selected || ''); setQuery('') }
  }, [open]) // eslint-disable-line

  /* 완료 */
  const commit = () => { onSelect(localSel); setOpen(false) }

  /* 트리거 라벨 */
  const selLabel = options.find(o => o.id === selected)?.label || '선택 안됨'

  return (
    <div className="relative" ref={popRef}>
      {/* 트리거 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs w-full text-left transition-colors
          ${dark ? 'bg-[#0F1117] border-[#252836] text-slate-300 hover:border-violet-500/40'
                 : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'}`}
      >
        <span className="flex-1 truncate">{selLabel}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 팝오버 */}
      {open && (
        <div className={`absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border shadow-xl
          ${dark ? 'bg-[#13151F] border-[#252836]' : 'bg-white border-slate-200'}`}>

          {/* 검색 */}
          <div className="relative px-3 pt-3 pb-2">
            <Search size={14} className={`absolute left-5 top-1/2 -translate-y-1/2 mt-0.5
              ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="프로퍼티 검색"
              className={`w-full pl-7 pr-3 py-1.5 rounded-lg border text-xs outline-none
                ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-500'
                       : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'}`}
              autoFocus
            />
          </div>

          {/* 아이템 리스트 */}
          <div className={`max-h-52 overflow-y-auto py-1 border-t
            ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
            {filtered.length === 0 ? (
              <div className={`text-center py-6 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                검색 결과 없음
              </div>
            ) : filtered.map(o => {
              const on = localSel === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setLocalSel(o.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-xs transition-colors
                    ${on
                      ? dark ? 'bg-violet-500/5' : 'bg-violet-50/50'
                      : dark ? 'hover:bg-[#1A1D27]' : 'hover:bg-slate-50'}`}
                >
                  {/* 라디오 */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                    ${on
                      ? 'border-violet-500'
                      : dark ? 'border-[#3a3f50]' : 'border-slate-300'}`}>
                    {on && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                  </div>
                  {/* 라벨 */}
                  <span className={`flex-1 truncate
                    ${on
                      ? 'text-violet-400 font-medium'
                      : dark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {o.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 하단 액션 바 */}
          <div className={`flex items-center justify-end gap-2 px-3 py-2 border-t
            ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
            <button type="button" onClick={() => setOpen(false)}
              className={`text-[11px] px-3 py-1 rounded-md
                ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
              취소
            </button>
            <button type="button" onClick={commit}
              className="text-[11px] px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 font-medium">
              완료
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
