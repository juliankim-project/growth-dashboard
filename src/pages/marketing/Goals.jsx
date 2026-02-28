import { useState } from 'react'
import { Target, Save, Plus, Trash2 } from 'lucide-react'

const STORAGE_KEY = 'marketing_goals_v1'

const DEFAULT_GOALS = [
  { id: 1, channel: 'Meta',         metric: 'ROAS',    target: '2.5', period: '월' },
  { id: 2, channel: 'Google',       metric: 'CPA',     target: '5000', period: '월' },
  { id: 3, channel: 'Naver_PL',     metric: 'ROAS',    target: '2.0', period: '월' },
  { id: 4, channel: 'Naver_Brand',  metric: 'CTR',     target: '3.0', period: '월' },
]

const METRICS  = ['ROAS', 'CPA', 'CTR', 'CPC', '설치수', '구매수', '광고비']
const PERIODS  = ['일', '주', '월', '분기']
const CHANNELS = ['Meta', 'Google', 'Naver_PL', 'Naver_Brand', '전체']

export default function Goals({ dark }) {
  const [goals, setGoals] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '') || DEFAULT_GOALS
    } catch { return DEFAULT_GOALS }
  })
  const [saved, setSaved] = useState(false)

  const update = (id, field, value) => {
    setGoals(g => g.map(r => r.id === id ? { ...r, [field]: value } : r))
    setSaved(false)
  }

  const addRow = () => {
    setGoals(g => [...g, { id: Date.now(), channel: 'Meta', metric: 'ROAS', target: '', period: '월' }])
    setSaved(false)
  }

  const removeRow = id => setGoals(g => g.filter(r => r.id !== id))

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inp = `
    px-2.5 py-1.5 rounded-lg border text-xs outline-none transition-colors w-full
    ${dark
      ? 'bg-[#13151C] border-[#252836] text-white focus:border-indigo-500'
      : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-indigo-400'}
  `

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>목표 설정</h2>
          <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            채널별 KPI 목표를 설정하면 대시보드에서 달성률을 확인할 수 있어요
          </p>
        </div>
        <button onClick={save}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors
            ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
          <Save size={13} />
          {saved ? '저장됨 ✓' : '저장'}
        </button>
      </div>

      <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <table className="w-full text-xs">
          <thead>
            <tr className={dark ? 'bg-[#13151C]' : 'bg-slate-50'}>
              {['채널', '지표', '목표값', '기간', ''].map(h => (
                <th key={h} className={`px-4 py-3 text-left font-semibold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {goals.map(row => (
              <tr key={row.id} className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                <td className="px-4 py-2.5">
                  <select value={row.channel} onChange={e => update(row.id, 'channel', e.target.value)} className={inp}>
                    {CHANNELS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <select value={row.metric} onChange={e => update(row.id, 'metric', e.target.value)} className={inp}>
                    {METRICS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <input type="number" value={row.target}
                    onChange={e => update(row.id, 'target', e.target.value)}
                    placeholder="0"
                    className={inp} />
                </td>
                <td className="px-4 py-2.5">
                  <select value={row.period} onChange={e => update(row.id, 'period', e.target.value)} className={inp}>
                    {PERIODS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => removeRow(row.id)}
                    className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={`px-4 py-3 border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <button onClick={addRow}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors
              ${dark ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-indigo-500 hover:bg-indigo-50'}`}>
            <Plus size={13} /> 행 추가
          </button>
        </div>
      </div>
    </div>
  )
}
