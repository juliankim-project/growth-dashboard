import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Table2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import Spinner from '../../components/UI/Spinner'

const TABLES = ['perf_meta', 'perf_google', 'perf_naver_pl', 'perf_naver_brand', 'marketing_perf']

export default function Tables({ dark }) {
  const [tables, setTables]   = useState({}) // { tableName: { count, columns, sample } }
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState({})

  const loadTables = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const result = {}
    for (const t of TABLES) {
      try {
        const { data, error, count } = await supabase
          .from(t).select('*', { count: 'exact' }).limit(3)
        if (!error) {
          result[t] = {
            count,
            columns: data?.[0] ? Object.keys(data[0]) : [],
            sample: data || []
          }
        }
      } catch {}
    }
    setTables(result)
    setLoading(false)
  }

  useEffect(() => { loadTables() }, [])

  const toggle = t => setOpen(o => ({ ...o, [t]: !o[t] }))

  const td = `px-3 py-2 text-xs border-r ${dark ? 'border-[#252836] text-slate-300' : 'border-slate-100 text-slate-600'}`

  if (loading) return <Spinner dark={dark} />

  return (
    <div className="p-6 flex flex-col gap-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>테이블 관리</h2>
          <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            Supabase 테이블 구조 및 데이터 현황
          </p>
        </div>
        <button onClick={loadTables}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors
            ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
          <RefreshCw size={13} /> 새로고침
        </button>
      </div>

      {TABLES.map(t => {
        const info    = tables[t]
        const isOpen  = !!open[t]
        return (
          <div key={t} className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
            {/* 헤더 */}
            <button
              onClick={() => toggle(t)}
              className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors
                ${dark ? 'hover:bg-[#13151C]' : 'hover:bg-slate-50'}`}
            >
              <Table2 size={16} className="text-indigo-500 shrink-0" />
              <span className={`font-semibold text-sm flex-1 ${dark ? 'text-white' : 'text-slate-800'}`}>{t}</span>
              {info && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                  {info.count?.toLocaleString() ?? 0}행
                </span>
              )}
              {info ? (
                isOpen ? <ChevronDown size={14} className={dark ? 'text-slate-500' : 'text-slate-300'} />
                       : <ChevronRight size={14} className={dark ? 'text-slate-500' : 'text-slate-300'} />
              ) : (
                <span className="text-xs text-red-400">연결 없음</span>
              )}
            </button>

            {/* 컬럼 + 샘플 */}
            {isOpen && info && (
              <div className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                {/* 컬럼 목록 */}
                <div className={`px-5 py-3 flex flex-wrap gap-1.5 border-b ${dark ? 'border-[#252836] bg-[#13151C]' : 'border-slate-100 bg-slate-50'}`}>
                  {info.columns.map(col => (
                    <span key={col} className={`text-xs px-2 py-0.5 rounded border font-mono
                      ${dark ? 'bg-[#1A1D27] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                      {col}
                    </span>
                  ))}
                </div>
                {/* 샘플 데이터 */}
                {info.sample.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={dark ? 'bg-[#0F1117]' : 'bg-slate-50'}>
                          {info.columns.slice(0, 8).map(c => (
                            <th key={c} className={`px-3 py-2 text-left font-semibold border-r whitespace-nowrap
                              ${dark ? 'border-[#252836] text-slate-500' : 'border-slate-100 text-slate-400'}`}>
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {info.sample.map((row, i) => (
                          <tr key={i} className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                            {info.columns.slice(0, 8).map(c => (
                              <td key={c} className={`${td} whitespace-nowrap max-w-[120px] truncate`}>
                                {String(row[c] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
