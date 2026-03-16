import { useState, useEffect } from 'react'
import { Clock, MessageSquare, Database, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function QueryHistory({ dark }) {
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('ai_queries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error && data) setQueries(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!supabase) return
    await supabase.from('ai_queries').delete().eq('id', id)
    setQueries(q => q.filter(x => x.id !== id))
  }

  const fmtDate = (d) => {
    const dt = new Date(d)
    return dt.toLocaleDateString('ko-KR', { month:'short', day:'numeric' }) + ' ' +
           dt.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col gap-4 p-6 ${dark ? 'text-white' : 'text-slate-800'}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">질문 내역</h1>
          <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            이전에 실행한 질문과 결과를 확인하세요
          </p>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <RefreshCw size={16} className={dark ? 'text-slate-400' : 'text-slate-500'} />
        </button>
      </div>

      {queries.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Clock size={40} strokeWidth={1.5} />
          <p className="mt-3 text-sm">아직 질문 내역이 없습니다</p>
          <p className="text-xs mt-1">질문하기 탭에서 첫 질문을 해보세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-auto flex-1">
          {queries.map(q => {
            const isOpen = expanded === q.id
            let parsed = null
            try { parsed = JSON.parse(q.result) } catch { parsed = q.result }
            const rows = Array.isArray(parsed) ? parsed : parsed?.rows ?? parsed?.data ?? null

            return (
              <div
                key={q.id}
                className={`rounded-lg border transition-all ${
                  dark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                }`}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                  onClick={() => setExpanded(isOpen ? null : q.id)}
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <div className={`p-1.5 rounded ${q.mode === 'ask' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'}`}>
                    {q.mode === 'ask' ? <MessageSquare size={12} /> : <Database size={12} />}
                  </div>
                  <span className="flex-1 text-sm font-medium truncate">{q.question}</span>
                  <span className={`text-xs shrink-0 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {fmtDate(q.created_at)}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(q.id) }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {isOpen && (
                  <div className={`px-4 pb-3 border-t ${dark ? 'border-slate-700' : 'border-slate-100'}`}>
                    {rows && rows.length > 0 ? (
                      <div className="overflow-auto max-h-64 mt-2 rounded border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                            <tr>
                              {Object.keys(rows[0]).map(c => (
                                <th key={c} className="px-3 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, 50).map((r, i) => (
                              <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                                {Object.keys(rows[0]).map(c => (
                                  <td key={c} className="px-3 py-1 whitespace-nowrap text-slate-700 dark:text-slate-300">{r[c] != null ? String(r[c]) : '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <pre className={`mt-2 p-3 rounded text-xs overflow-auto max-h-48 ${dark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                        {typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
