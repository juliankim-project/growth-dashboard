import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Trash2, FileText, RefreshCw } from 'lucide-react'

const STORAGE_KEY = 'upload_history_v1'

export default function History({ dark }) {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })

  /* 다른 탭에서 업로드 시 실시간 반영 */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return
      try { setHistory(JSON.parse(e.newValue || '[]')) } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /* 같은 탭에서 업로드 후 돌아올 경우 포커스 시 갱신 */
  useEffect(() => {
    const onFocus = () => {
      try { setHistory(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const clear = () => {
    if (confirm('업로드 기록을 모두 삭제할까요?')) {
      setHistory([])
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const refresh = () => {
    try { setHistory(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) } catch {}
  }

  const th = `px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-slate-700'}`
  const td = `px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`

  const modeLabel = (h) => {
    if (!h.mode) return '—'
    return h.mode === 'clear_all' ? '전체 초기화' : '날짜 덮어쓰기'
  }

  return (
    <div className="p-6 flex flex-col gap-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>업로드 기록</h2>
          <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
            Data Studio에서 업로드한 CSV 기록이에요 · 최근 200건 보관
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors
              ${dark ? 'text-slate-400 hover:bg-[#22272B]' : 'text-slate-700 hover:bg-slate-100'}`}>
            <RefreshCw size={12}/> 새로고침
          </button>
          {history.length > 0 && (
            <button onClick={clear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-400/10 transition-colors">
              <Trash2 size={12}/> 기록 삭제
            </button>
          )}
        </div>
      </div>

      <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <FileText size={32} className={dark ? 'text-slate-400' : 'text-slate-700'} />
            <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
              아직 업로드 기록이 없어요
            </p>
            <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
              CSV 업로드 탭에서 데이터를 업로드하면 여기에 기록돼요
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={dark ? 'bg-[#1D2125]' : 'bg-slate-50'}>
                  {['파일명', '테이블', '행 수', '업로드 방식', '날짜 범위', '상태', '일시'].map(h => (
                    <th key={h} className={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className={`border-t ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
                    <td className={`${td} font-medium font-mono max-w-[180px] truncate`} title={h.filename}>
                      {h.filename}
                    </td>
                    <td className={td}>
                      <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${dark ? 'bg-[#579DFF]/10 text-[#579DFF]' : 'bg-[#E9F2FF] text-[#0C66E4]'}`}>
                        {h.table || '—'}
                      </span>
                    </td>
                    <td className={`${td} text-right font-mono`}>
                      {h.rows != null ? h.rows.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {h.mode === 'clear_all'
                        ? <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'}`}>전체 초기화</span>
                        : h.mode === 'overwrite'
                          ? <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${dark ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>날짜 덮어쓰기</span>
                          : <span className={`text-[11px] ${dark ? 'text-slate-400' : 'text-slate-700'}`}>—</span>
                      }
                    </td>
                    <td className={`${td} font-mono text-[11px]`}>
                      {h.dateRange || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {h.ok
                        ? <span className="flex items-center gap-1 text-xs text-emerald-500"><CheckCircle size={12}/> 성공</span>
                        : <span className="flex items-center gap-1 text-xs text-red-400" title={h.error}><XCircle size={12}/> 실패</span>
                      }
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{h.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
