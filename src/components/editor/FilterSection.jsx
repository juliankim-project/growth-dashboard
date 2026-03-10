import { useState } from 'react'
import { getColumnLabel } from '../../store/columnUtils'

/* ─────────────────────────────────────────────────────────────────
   FilterSection  —  columnConfig 기반 동적 디멘전 필터
───────────────────────────────────────────────────────────────── */
export default function FilterSection({ filters = {}, groupBy, data, dark, onChange, onGroupByChange, initialOpen = false, columnConfig, tableName }) {
  const [open, setOpen] = useState(initialOpen)
  const tCfg = columnConfig?.[tableName]
  const dimCols = tCfg?.dimensionColumns || []
  const dimLabel = (dim) => getColumnLabel(dim, tCfg?.columns?.[dim])

  const dimStates = dimCols.map((dim) => {
    let filtered = data
    dimCols.forEach(otherDim => {
      if (otherDim === dim) return
      const sel = filters[otherDim] || []
      if (sel.length > 0) filtered = filtered.filter(r => sel.includes(r[otherDim]))
    })
    const opts = [...new Set(filtered.map(r => r[dim]).filter(Boolean))].sort()
    const sel = filters[dim] || []
    return { key: dim, label: dimLabel(dim), opts, sel, show: opts.length > 0 }
  })

  const COLS = dimStates.filter(d => d.show)
  const toggle = (dim, val) => {
    const cur = filters[dim] || []
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]
    onChange({ ...filters, [dim]: next })
  }
  const clearDim = (dim) => onChange({ ...filters, [dim]: [] })
  const activeCount = dimStates.reduce((sum, d) => sum + d.sel.length, 0)
  const groupByLabel = COLS.find(c => c.key === groupBy)?.label ?? dimLabel(groupBy)

  return (
    <div className={`rounded-xl border ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors rounded-xl
          ${dark ? 'hover:bg-[#1A1D27]' : 'hover:bg-slate-50'}`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-bold ${dark ? 'text-slate-300' : 'text-slate-700'}`}>데이터 필터</span>
          {activeCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500 text-white font-bold">{activeCount}</span>}
          {groupBy && onGroupByChange && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
              그룹바이: {groupByLabel}
            </span>
          )}
        </div>
        <span className={`text-[10px] shrink-0 ml-2 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={`border-t overflow-x-auto ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <div className="flex min-w-max">
            {COLS.length === 0 && (
              <p className={`text-[10px] px-4 py-3 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
                디멘전 컬럼이 설정되지 않았습니다.
              </p>
            )}
            {COLS.map((col, ci) => {
              const isGroupByDim = groupBy === col.key
              const bdrR = ci < COLS.length - 1 ? (dark ? 'border-r border-[#252836]' : 'border-r border-slate-200') : ''
              return (
                <div key={col.key} className={`w-36 flex flex-col shrink-0 ${bdrR}`}>
                  <div className={`flex items-center justify-between px-2.5 py-1.5 border-b shrink-0
                    ${dark ? 'bg-[#0D0F18] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wide truncate
                      ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{col.label}</span>
                    {col.sel.length > 0 && !isGroupByDim && (
                      <button onClick={() => clearDim(col.key)} className="text-[9px] text-indigo-400 hover:text-indigo-300 ml-1 shrink-0">해제</button>
                    )}
                  </div>
                  {onGroupByChange && (
                    <button onClick={() => onGroupByChange(isGroupByDim ? null : col.key)}
                      className={`text-[10px] px-2.5 py-1 text-center border-b w-full transition-colors
                        ${dark ? 'border-[#252836]' : 'border-slate-200'}
                        ${isGroupByDim ? 'bg-violet-500/15 text-violet-400 font-semibold'
                          : dark ? 'text-slate-600 hover:text-slate-400 hover:bg-[#1A1D27]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                      {isGroupByDim ? '✓ 그룹바이' : '그룹바이'}
                    </button>
                  )}
                  <div className="overflow-y-auto flex flex-col" style={{ maxHeight: 164 }}>
                    {col.opts.length === 0
                      ? <p className={`text-[10px] px-2.5 py-2 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>없음</p>
                      : col.opts.map(v => {
                        const isOn = col.sel.includes(v)
                        const dimmed = isGroupByDim
                        return (
                          <button key={v} onClick={() => !dimmed && toggle(col.key, v)} title={v}
                            className={`text-[11px] px-2.5 py-[5px] text-left w-full transition-colors leading-snug break-words
                              ${dimmed ? (dark ? 'text-slate-700 cursor-default' : 'text-slate-300 cursor-default')
                                : isOn ? (dark ? 'bg-indigo-500/15 text-indigo-400 font-semibold' : 'bg-indigo-50 text-indigo-600 font-semibold')
                                  : dark ? 'text-slate-400 hover:bg-[#1A1D27] hover:text-slate-200' : 'text-slate-600 hover:bg-slate-50'}`}>
                            {!dimmed && isOn ? '✓ ' : ''}{v}
                          </button>
                        )
                      })
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
