import { useState, useRef } from 'react'
import { Save, Upload, X, Image } from 'lucide-react'

export default function General({ dark, projectName, logoUrl, setProjectName, setLogoUrl }) {
  const [localName,    setLocalName]    = useState(projectName || 'Growth HQ')
  const [currency,     setCurrency]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('app_settings') || '{}').currency || 'KRW' } catch { return 'KRW' }
  })
  const [defaultPeriod, setDefaultPeriod] = useState(() => {
    try { return JSON.parse(localStorage.getItem('app_settings') || '{}').defaultPeriod || '30' } catch { return '30' }
  })
  const [saved,    setSaved]    = useState(false)
  const [logoErr,  setLogoErr]  = useState('')
  const fileRef = useRef()

  /* 프로젝트명은 input 변경 즉시 반영 */
  const handleNameChange = (v) => {
    setLocalName(v)
    setProjectName?.(v)
  }

  const save = () => {
    localStorage.setItem('app_settings', JSON.stringify({ currency, defaultPeriod }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  /* 로고 이미지 업로드 */
  const handleLogoFile = (file) => {
    if (!file) return
    setLogoErr('')
    if (!file.type.startsWith('image/')) { setLogoErr('이미지 파일만 지원합니다.'); return }
    if (file.size > 512 * 1024) { setLogoErr('500KB 이하 이미지만 가능합니다.'); return }
    const reader = new FileReader()
    reader.onload = (e) => setLogoUrl?.(e.target.result)
    reader.readAsDataURL(file)
  }

  const removeLogo = () => setLogoUrl?.(null)

  const inp = `w-full px-3 py-2 rounded-lg border text-sm outline-none transition-colors
    ${dark ? 'bg-[#13151C] border-[#252836] text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-indigo-400'}`
  const label = `block text-xs font-semibold mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`

  return (
    <div className="p-6 max-w-lg flex flex-col gap-5">
      <div>
        <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>일반 설정</h2>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>프로젝트 기본 설정</p>
      </div>

      {/* ── 브랜딩 ── */}
      <div className={`rounded-xl border p-5 flex flex-col gap-5 ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <p className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-700'}`}>브랜딩</p>

        {/* 프로젝트명 */}
        <div>
          <label className={label}>프로젝트 이름 <span className={`normal-case font-normal ${dark ? 'text-slate-600' : 'text-slate-600'}`}>(변경 즉시 반영)</span></label>
          <input
            value={localName}
            onChange={e => handleNameChange(e.target.value)}
            className={inp}
            placeholder="Growth HQ"
          />
        </div>

        {/* 로고 */}
        <div>
          <label className={label}>로고 이미지 <span className={`normal-case font-normal ${dark ? 'text-slate-600' : 'text-slate-600'}`}>(PNG · JPG · SVG · 500KB 이하)</span></label>

          <div className="flex items-center gap-3">
            {/* 현재 로고 미리보기 */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border
              ${dark ? 'bg-[#13151C] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="w-full h-full rounded-xl object-cover"/>
              ) : (
                <Image size={22} className={dark ? 'text-slate-400' : 'text-slate-700'}/>
              )}
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <button
                onClick={() => fileRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors
                  ${dark ? 'border-[#252836] text-slate-300 hover:border-indigo-500 hover:text-indigo-400' : 'border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'}`}
              >
                <Upload size={12}/> {logoUrl ? '로고 변경' : '로고 업로드'}
              </button>
              {logoUrl && (
                <button
                  onClick={removeLogo}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-500 transition-colors"
                >
                  <X size={10}/> 로고 제거
                </button>
              )}
            </div>
          </div>

          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => handleLogoFile(e.target.files[0])}/>

          {logoErr && (
            <p className="mt-1.5 text-xs text-red-400">{logoErr}</p>
          )}
        </div>
      </div>

      {/* ── 기타 설정 ── */}
      <div className={`rounded-xl border p-5 flex flex-col gap-4 ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <p className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-700'}`}>표시 설정</p>
        <div>
          <label className={label}>통화</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)} className={inp}>
            <option value="KRW">KRW (원)</option>
            <option value="USD">USD (달러)</option>
            <option value="JPY">JPY (엔)</option>
          </select>
        </div>
        <div>
          <label className={label}>기본 기간</label>
          <select value={defaultPeriod} onChange={e => setDefaultPeriod(e.target.value)} className={inp}>
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
