import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X, TrendingUp, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'

/* ─── 항상 이 테이블에 저장 ─── */
const TARGET_TABLE = 'marketing_perf'

/* 필수 컬럼 (CSV 기준) */
const REQUIRED_COLS = ['Event Date', 'Channel']

/**
 * CSV 컬럼명 → DB 컬럼명 매핑
 * marketing_perf 테이블에서 channel만 소문자라서 별도 처리
 */
const COL_MAP = {
  'Event Date':            'Event Date',
  'Channel':               'channel',          // ← DB는 소문자
  'Campaign':              'Campaign',
  'Ad Group':              'Ad Group',
  'Ad Creative':           'Ad Creative',
  'Content':               'Content',
  'Sub Publisher':         'Sub Publisher',
  'Impressions (Channel)': 'Impressions (Channel)',
  'Clicks (Channel)':      'Clicks (Channel)',
  'CPC (Channel)':         'CPC (Channel)',
  'Installs (App)':        'Installs (App)',
  'Cost (Channel)':        'Cost (Channel)',
  '회원가입 (App+Web)':      '회원가입 (App+Web)',
  '구매 완료 (App+Web)':     '구매 완료 (App+Web)',
  '구매액 (App+Web)':        '구매액 (App+Web)',
}

/* CSV 컬럼명 목록 (표시/매핑 확인용) */
const ALL_COLS = Object.keys(COL_MAP)

/* ─── CSV 파서 (줄바꿈·따옴표 기본 처리) ─── */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  })
  return { headers, rows }
}

/* ─── 채널별 행 수 집계 ─── */
function getChannelSummary(rows) {
  const map = {}
  rows.forEach(r => {
    const ch = r['Channel'] || '(채널 없음)'
    map[ch] = (map[ch] || 0) + 1
  })
  return Object.entries(map).map(([channel, count]) => ({ channel, count }))
}

/* ─── 날짜 범위 ─── */
function getDateRange(rows) {
  const dates = rows.map(r => r['Event Date']).filter(Boolean).sort()
  if (!dates.length) return null
  return { start: dates[0], end: dates[dates.length - 1] }
}

const CHANNEL_COLORS = [
  'indigo', 'violet', 'cyan', 'emerald', 'orange', 'pink', 'yellow',
]
const colorClass = (i, dark) => {
  const colors = [
    dark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'  : 'bg-indigo-50 border-indigo-100 text-indigo-600',
    dark ? 'bg-violet-500/10 border-violet-500/20 text-violet-300'  : 'bg-violet-50 border-violet-100 text-violet-600',
    dark ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'        : 'bg-cyan-50 border-cyan-100 text-cyan-600',
    dark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300': 'bg-emerald-50 border-emerald-100 text-emerald-600',
    dark ? 'bg-orange-500/10 border-orange-500/20 text-orange-300'  : 'bg-orange-50 border-orange-100 text-orange-600',
  ]
  return colors[i % colors.length]
}

/* ════════════════════════════════════════════════ */
export default function DataStudio({ dark }) {
  const [step,           setStep]           = useState(0)   // 0:업로드 1:확인 2:완료
  const [file,           setFile]           = useState(null)
  const [parsed,         setParsed]         = useState(null) // { headers, rows }
  const [uploading,      setUploading]      = useState(false)
  const [progress,       setProgress]       = useState(0)
  const [result,         setResult]         = useState(null)
  const [dragOver,       setDragOver]       = useState(false)
  const fileRef = useRef()

  /* 파일 처리 */
  const handleFile = f => {
    if (!f) return
    if (!f.name.endsWith('.csv')) return alert('CSV 파일만 지원합니다.')
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => {
      const p = parseCSV(e.target.result)
      setParsed(p)
      setStep(1)
    }
    reader.readAsText(f, 'UTF-8')
  }

  /* 파생 데이터 */
  const channelSummary = parsed ? getChannelSummary(parsed.rows) : []
  const dateRange      = parsed ? getDateRange(parsed.rows) : null
  const missingCols    = parsed ? REQUIRED_COLS.filter(c => !parsed.headers.includes(c)) : []
  const matchedCols    = parsed ? ALL_COLS.filter(c => parsed.headers.includes(c)) : []
  const unmatchedCols  = parsed ? ALL_COLS.filter(c => !parsed.headers.includes(c)) : []

  /* 업로드 실행 */
  const handleUpload = async () => {
    setUploading(true)
    setProgress(0)
    try {
      /* COL_MAP 기준으로 CSV → DB 컬럼명 변환 후 삽입 */
      const rows = parsed.rows.map(row => {
        const obj = {}
        matchedCols.forEach(csvCol => {
          const dbCol = COL_MAP[csvCol]
          const v = row[csvCol]
          obj[dbCol] = (v === '' || v === undefined) ? null : v
        })
        return obj
      })

      const CHUNK = 500
      let inserted = 0
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK)
        const { error } = await supabase.from(TARGET_TABLE).insert(chunk)
        if (error) throw error
        inserted += chunk.length
        setProgress(Math.round((inserted / rows.length) * 100))
      }

      setResult({ ok: true, count: inserted })
      setStep(2)
    } catch (err) {
      setResult({ ok: false, error: err.message })
      setStep(2)
    }
    setUploading(false)
  }

  const reset = () => {
    setStep(0); setFile(null); setParsed(null)
    setResult(null); setProgress(0)
  }

  /* 스타일 헬퍼 */
  const card = `rounded-xl border p-6 ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`
  const txt  = dark ? 'text-white' : 'text-slate-800'
  const sub  = dark ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl mx-auto h-full overflow-y-auto">

      {/* 헤더 */}
      <div>
        <h2 className={`text-lg font-bold ${txt}`}>Data Studio</h2>
        <p className={`text-xs mt-1 ${sub}`}>
          CSV 업로드 →{' '}
          <span className="font-mono font-semibold text-indigo-400">{TARGET_TABLE}</span>
          {' '}자동 저장 · 채널은 CSV 내 Channel 컬럼으로 자동 구분
        </p>
      </div>

      {/* ── Step 0: 파일 업로드 ── */}
      {step === 0 && (
        <div className={card}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-14 flex flex-col items-center gap-4
              cursor-pointer transition-all
              ${dragOver
                ? 'border-indigo-500 bg-indigo-500/5'
                : dark ? 'border-[#2E3450] hover:border-indigo-600' : 'border-slate-200 hover:border-indigo-400'}
            `}
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center
              ${dark ? 'bg-[#13151C]' : 'bg-slate-50'}`}>
              <Upload size={28} className="text-indigo-500" />
            </div>
            <div className="text-center">
              <p className={`font-semibold text-sm ${txt}`}>
                CSV 파일을 드롭하거나 클릭해서 선택
              </p>
              <p className={`text-xs mt-1 ${sub}`}>
                UTF-8 인코딩 · 채널 자동 감지 · marketing_perf에 직접 저장
              </p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />

          {/* 안내 박스 */}
          <div className={`mt-4 rounded-lg px-4 py-3 text-xs flex gap-3 items-start
            ${dark ? 'bg-indigo-500/5 border border-indigo-500/15 text-slate-400' : 'bg-indigo-50 border border-indigo-100 text-slate-500'}`}>
            <Info size={13} className="text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-indigo-400 mb-1">필수 컬럼</p>
              <p><span className="font-mono">Event Date</span>, <span className="font-mono">Channel</span> 컬럼이 반드시 있어야 합니다.</p>
              <p className="mt-1">Meta, Google, Kakao 등 어떤 채널이든 하나의 CSV로 한 번에 업로드 가능합니다.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: 데이터 확인 ── */}
      {step === 1 && parsed && (
        <div className="flex flex-col gap-4">

          {/* 파일 정보 */}
          <div className={card}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className={`text-sm font-semibold ${txt}`}>데이터 확인</p>
                <p className={`text-xs mt-0.5 ${sub}`}>
                  <FileText size={11} className="inline mr-1" />
                  {file?.name}
                </p>
              </div>
              <button onClick={reset} className={`${sub} hover:text-red-400 transition-colors`}>
                <X size={16} />
              </button>
            </div>

            {/* 필수 컬럼 누락 경고 */}
            {missingCols.length > 0 && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertCircle size={12} className="inline mr-1" />
                필수 컬럼 누락: <span className="font-mono font-bold">{missingCols.join(', ')}</span>
                {' '}— CSV 헤더를 확인해주세요.
              </div>
            )}

            {/* 요약 카드 */}
            <div className={`grid grid-cols-3 gap-3 mb-4`}>
              {[
                { label: '총 행 수',   value: parsed.rows.length.toLocaleString() + '행' },
                { label: '날짜 범위',  value: dateRange ? `${dateRange.start} ~ ${dateRange.end}` : '—' },
                { label: '매핑 컬럼', value: `${matchedCols.length} / ${ALL_COLS.length}` },
              ].map(({ label, value }) => (
                <div key={label} className={`rounded-lg px-3 py-3 text-center
                  ${dark ? 'bg-[#13151C]' : 'bg-slate-50'}`}>
                  <p className={`text-[10px] ${sub} mb-0.5`}>{label}</p>
                  <p className={`text-xs font-bold ${txt}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* 저장 위치 */}
            <div className={`rounded-lg px-4 py-3 text-xs flex items-center gap-2
              ${dark ? 'bg-indigo-500/5 border border-indigo-500/15' : 'bg-indigo-50 border border-indigo-100'}`}>
              <span className={sub}>저장 위치:</span>
              <span className="font-mono font-bold text-indigo-400">{TARGET_TABLE}</span>
              <span className={`ml-auto text-[10px] ${sub}`}>업로드 즉시 대시보드 반영</span>
            </div>
          </div>

          {/* 채널 감지 */}
          <div className={card}>
            <p className={`text-xs font-semibold mb-3 ${sub}`}>
              감지된 채널 ({channelSummary.length}개)
            </p>
            <div className="flex flex-wrap gap-2">
              {channelSummary.map(({ channel, count }, i) => (
                <div key={channel}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${colorClass(i, dark)}`}>
                  <TrendingUp size={11} />
                  <span className="font-semibold">{channel}</span>
                  <span className="opacity-60">{count.toLocaleString()}행</span>
                </div>
              ))}
            </div>
          </div>

          {/* 컬럼 매핑 현황 */}
          <div className={card}>
            <p className={`text-xs font-semibold mb-3 ${sub}`}>컬럼 매핑 현황</p>
            <div className="flex flex-wrap gap-1.5">
              {matchedCols.map(col => (
                <span key={col} className={`text-[11px] px-2 py-1 rounded font-mono border
                  ${dark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                  ✓ {col}
                </span>
              ))}
              {unmatchedCols.map(col => (
                <span key={col} className={`text-[11px] px-2 py-1 rounded font-mono border
                  ${dark ? 'bg-[#13151C] text-slate-600 border-[#252836]' : 'bg-slate-50 text-slate-300 border-slate-100'}`}>
                  — {col}
                </span>
              ))}
            </div>
            <p className={`text-[10px] mt-2 ${sub}`}>
              ✓ 매핑됨: {matchedCols.length}개 · — CSV에 없는 컬럼은 null로 저장
            </p>
          </div>

          {/* 업로드 진행 바 */}
          {uploading && (
            <div className={card}>
              <p className={`text-xs font-semibold mb-3 ${txt}`}>업로드 중...</p>
              <div className={`w-full rounded-full h-2 ${dark ? 'bg-[#13151C]' : 'bg-slate-100'}`}>
                <div
                  className="h-2 rounded-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className={`text-xs mt-2 ${sub}`}>{progress}% 완료</p>
            </div>
          )}

          {/* 업로드 버튼 */}
          <button
            onClick={handleUpload}
            disabled={uploading || missingCols.length > 0}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
              disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {uploading
              ? `업로드 중... ${progress}%`
              : `${parsed.rows.length.toLocaleString()}행 → ${TARGET_TABLE} 업로드`}
          </button>
        </div>
      )}

      {/* ── Step 2: 완료 ── */}
      {step === 2 && result && (
        <div className={card}>
          <div className="flex flex-col items-center gap-5 py-8">
            {result.ok
              ? <CheckCircle size={52} className="text-emerald-500" />
              : <AlertCircle  size={52} className="text-red-500" />
            }
            <div className="text-center">
              <p className={`text-lg font-bold ${txt}`}>
                {result.ok ? '업로드 완료!' : '업로드 실패'}
              </p>
              <p className={`text-sm mt-1.5 ${sub}`}>
                {result.ok
                  ? `${result.count.toLocaleString()}행이 ${TARGET_TABLE}에 저장되었습니다. 대시보드를 새로고침하면 반영됩니다.`
                  : result.error
                }
              </p>
            </div>
            <button onClick={reset}
              className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              새로 업로드
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
