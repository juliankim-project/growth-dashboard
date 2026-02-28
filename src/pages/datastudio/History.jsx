import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Trash2, FileText } from 'lucide-react'

const STORAGE_KEY = 'upload_history_v1'

export default function History({ dark }) {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })

  const clear = () => {
    if (confirm('업로드 기록을 모두 삭제할까요?')) {
      setHistory([])
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const td = `px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`

  return (
    <div className="p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>업로드 기록</h2>
          <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            Data Studio에서 업로드한 CSV 기록이에요
          </p>
        </div>
        {history.length > 0 && (
          <button onClick={clear}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 size={13} /> 기록 삭제
          </button>
        )}
      </div>

      <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <FileText size={32} className={dark ? 'text-slate-700' : 'text-slate-300'} />
            <p className={`text-sm ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              아직 업로드 기록이 없어요
            </p>
            <p className={`text-xs ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
              CSV 업로드 탭에서 데이터를 업로드하면 여기에 기록돼요
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={dark ? 'bg-[#13151C]' : 'bg-slate-50'}>
                  {['파일명', '테이블', '행 수', '상태', '일시'].map(h => (
                    <th key={h} className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                    <td className={`${td} font-medium`}>{h.filename}</td>
                    <td className={td}>{h.table}</td>
                    <td className={td}>{h.rows?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {h.ok
                        ? <span className="flex items-center gap-1 text-xs text-emerald-500"><CheckCircle size={12} /> 성공</span>
                        : <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> 실패</span>
                      }
                    </td>
                    <td className={td}>{h.date}</td>
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
