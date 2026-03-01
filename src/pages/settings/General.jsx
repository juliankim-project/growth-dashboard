import { useState } from 'react'
import { Save } from 'lucide-react'

export default function General({ dark }) {
  const [settings, setSettings] = useState({
    projectName: 'Growth HQ',
    currency: 'KRW',
    timezone: 'Asia/Seoul',
    defaultPeriod: '30',
  })
  const [saved, setSaved] = useState(false)

  const update = (k, v) => setSettings(s => ({ ...s, [k]: v }))

  const save = () => {
    localStorage.setItem('app_settings', JSON.stringify(settings))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inp = `w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors
    ${dark ? 'bg-[#13151C] border-[#252836] text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-indigo-400'}`
  const label = `block text-xs font-semibold mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`

  return (
    <div className="p-6 max-w-lg flex flex-col gap-5 h-full overflow-y-auto">
      <div>
        <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>일반 설정</h2>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>프로젝트 기본 설정</p>
      </div>

      <div className={`rounded-xl border p-5 flex flex-col gap-4 ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div>
          <label className={label}>프로젝트 이름</label>
          <input value={settings.projectName} onChange={e => update('projectName', e.target.value)} className={inp} />
        </div>
        <div>
          <label className={label}>통화</label>
          <select value={settings.currency} onChange={e => update('currency', e.target.value)} className={inp}>
            <option value="KRW">KRW (원)</option>
            <option value="USD">USD (달러)</option>
            <option value="JPY">JPY (엔)</option>
          </select>
        </div>
        <div>
          <label className={label}>기본 기간</label>
          <select value={settings.defaultPeriod} onChange={e => update('defaultPeriod', e.target.value)} className={inp}>
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
            <option value="90">최근 90일</option>
          </select>
        </div>
        <button onClick={save}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors w-full justify-center
            ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
          <Save size={14} />
          {saved ? '저장됨 ✓' : '저장'}
        </button>
      </div>
    </div>
  )
}
