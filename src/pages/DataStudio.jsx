import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, ChevronRight, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

/* CSV 파서 */
function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  })
  return { headers, rows }
}

/* 기본 매핑 테이블 (CSV 헤더 → Supabase 컬럼) */
const DEFAULT_MAPPING = {
  'Event Date':              'Event Date',
  'Channel':                 'Channel',
  'Campaign':                'Campaign',
  'Ad Group':                'Ad Group',
  'Ad Creative':             'Ad Creative',
  'Content':                 'Content',
  'Sub Publisher':           'Sub Publisher',
  'Term':                    'Term',
  'Impressions (Channel)':   'Impressions (Channel)',
  'Clicks (Channel)':        'Clicks (Channel)',
  'CPC (Channel)':           'CPC (Channel)',
  'Installs (App)':          'Installs (App)',
  'Cost (Channel)':          'Cost (Channel)',
  '회원가입 (App+Web)':       '회원가입 (App+Web)',
  '구매 완료 (App+Web)':      '구매 완료 (App+Web)',
  '구매액 (App+Web)':         '구매액 (App+Web)',
}

const TABLES = ['perf_meta', 'perf_google', 'perf_naver_pl', 'perf_naver_brand']

const STEPS = ['파일 업로드', '컬럼 매핑', '테이블 선택', '업로드 완료']

export default function DataStudio({ dark }) {
  const [step,      setStep]      = useState(0) // 0~3
  const [file,      setFile]      = useState(null)
  const [parsed,    setParsed]    = useState(null) // { headers, rows }
  const [mapping,   setMapping]   = useState({})
  const [table,     setTable]     = useState(TABLES[0])
  const [uploading, setUploading] = useState(false)
  const [result,    setResult]    = useState(null) // { ok, count, error }
  const [dragOver,  setDragOver]  = useState(false)
  const fileRef = useRef()

  /* 파일 처리 */
  const handleFile = f => {
    if (!f || !f.name.endsWith('.csv')) return alert('CSV 파일만 지원합니다.')
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => {
      const { headers, rows } = parseCSV(e.target.result)
      setParsed({ headers, rows })
      // 자동 매핑
      const auto = {}
      headers.forEach(h => { auto[h] = DEFAULT_MAPPING[h] || '' })
      setMapping(auto)
      setStep(1)
    }
    reader.readAsText(f, 'UTF-8')
  }

  /* 업로드 실행 */
  const handleUpload = async () => {
    setUploading(true)
    try {
      const rows = parsed.rows.map(row => {
        const obj = {}
        Object.entries(mapping).forEach(([csvCol, dbCol]) => {
          if (dbCol) obj[dbCol] = row[csvCol] ?? null
        })
        return obj
      })

      const CHUNK = 500
      let inserted = 0
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK)
        const { error } = await supabase.from(table).insert(chunk)
        if (error) throw error
        inserted += chunk.length
      }

      setResult({ ok: true, count: inserted })
      setStep(3)
    } catch (err) {
      setResult({ ok: false, error: err.message })
      setStep(3)
    }
    setUploading(false)
  }

  const reset = () => {
    setStep(0); setFile(null); setParsed(null)
    setMapping({}); setResult(null)
  }

  const card = `rounded-xl border p-6 ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl mx-auto">

      {/* 제목 */}
      <div>
        <h2 className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
          Data Studio
        </h2>
        <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          CSV 파일을 업로드하고 컬럼을 매핑해서 Supabase에 저장합니다
        </p>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${i === step
                ? 'bg-indigo-600 text-white'
                : i < step
                  ? 'text-emerald-500'
                  : dark ? 'text-slate-600' : 'text-slate-300'}
            `}>
              <span className={`
                w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${i === step ? 'bg-white text-indigo-600' : i < step ? 'bg-emerald-500 text-white' : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-100 text-slate-400'}
              `}>{i < step ? '✓' : i + 1}</span>
              <span className="hidden sm:block">{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className={dark ? 'text-slate-700 mx-1' : 'text-slate-200 mx-1'} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: 파일 업로드 */}
      {step === 0 && (
        <div className={card}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4
              cursor-pointer transition-all
              ${dragOver
                ? 'border-indigo-500 bg-indigo-500/5'
                : dark ? 'border-[#2E3450] hover:border-indigo-600' : 'border-slate-200 hover:border-indigo-400'}
            `}
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${dark ? 'bg-[#13151C]' : 'bg-slate-50'}`}>
              <Upload size={24} className="text-indigo-500" />
            </div>
            <div className="text-center">
              <p className={`font-semibold text-sm ${dark ? 'text-white' : 'text-slate-700'}`}>
                CSV 파일을 여기에 드롭하거나 클릭해서 선택
              </p>
              <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                UTF-8 인코딩 CSV 파일 지원
              </p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />
        </div>
      )}

      {/* Step 1: 컬럼 매핑 */}
      {step === 1 && parsed && (
        <div className={card}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>
                컬럼 매핑
              </p>
              <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                <FileText size={11} className="inline mr-1" />
                {file?.name} — {parsed.rows.length.toLocaleString()}행 감지됨
              </p>
            </div>
            <button onClick={reset} className="text-slate-400 hover:text-red-400">
              <X size={16} />
            </button>
          </div>

          <div className={`grid grid-cols-2 gap-2 text-xs font-semibold uppercase tracking-wide mb-2 px-1
            ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>CSV 컬럼</span>
            <span>Supabase 컬럼</span>
          </div>

          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
            {parsed.headers.map(h => (
              <div key={h} className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg
                ${dark ? 'bg-[#13151C]' : 'bg-slate-50'}
              `}>
                <span className={`flex-1 text-xs font-medium truncate ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {h}
                </span>
                <ChevronRight size={12} className={dark ? 'text-slate-600' : 'text-slate-300'} />
                <input
                  type="text"
                  value={mapping[h] || ''}
                  onChange={e => setMapping(m => ({ ...m, [h]: e.target.value }))}
                  placeholder="무시"
                  className={`
                    flex-1 text-xs px-2 py-1.5 rounded border outline-none
                    ${dark
                      ? 'bg-[#1A1D27] border-[#252836] text-white placeholder:text-slate-600'
                      : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-300'}
                    ${mapping[h] ? 'border-indigo-500/50' : ''}
                  `}
                />
                {mapping[h]
                  ? <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                  : <span className={`text-xs shrink-0 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>무시</span>
                }
              </div>
            ))}
          </div>

          <button onClick={() => setStep(2)}
            className="mt-5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors">
            다음 → 테이블 선택
          </button>
        </div>
      )}

      {/* Step 2: 테이블 선택 + 확인 */}
      {step === 2 && (
        <div className={card}>
          <p className={`text-sm font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>
            저장할 테이블 선택
          </p>

          <div className="flex flex-col gap-2 mb-5">
            {TABLES.map(t => (
              <button
                key={t}
                onClick={() => setTable(t)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg border text-left text-sm transition-all
                  ${table === t
                    ? 'border-indigo-500 bg-indigo-500/5 text-indigo-500'
                    : dark
                      ? 'border-[#252836] text-slate-400 hover:border-indigo-500/30'
                      : 'border-slate-200 text-slate-600 hover:border-indigo-300'}
                `}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
                  ${table === t ? 'border-indigo-500' : dark ? 'border-slate-600' : 'border-slate-300'}`}>
                  {table === t && <span className="w-2 h-2 rounded-full bg-indigo-500 block" />}
                </span>
                <span className="font-medium">{t}</span>
              </button>
            ))}
          </div>

          <div className={`rounded-lg px-4 py-3 mb-5 text-xs ${dark ? 'bg-[#13151C] text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
            <p><span className="font-semibold">파일:</span> {file?.name}</p>
            <p><span className="font-semibold">행 수:</span> {parsed?.rows.length.toLocaleString()}행</p>
            <p><span className="font-semibold">매핑:</span> {Object.values(mapping).filter(Boolean).length}개 컬럼</p>
            <p><span className="font-semibold">대상:</span> {table}</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg border transition-colors
                ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              ← 이전
            </button>
            <button onClick={handleUpload} disabled={uploading}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              {uploading ? '업로드 중...' : '업로드 시작 →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 완료 */}
      {step === 3 && result && (
        <div className={card}>
          <div className="flex flex-col items-center gap-4 py-6">
            {result.ok
              ? <CheckCircle size={48} className="text-emerald-500" />
              : <AlertCircle  size={48} className="text-red-500" />
            }
            <div className="text-center">
              <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                {result.ok ? '업로드 완료!' : '업로드 실패'}
              </p>
              <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                {result.ok
                  ? `${result.count.toLocaleString()}행이 ${table}에 저장되었습니다`
                  : result.error
                }
              </p>
            </div>
            <button onClick={reset}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors">
              새로 업로드
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
