import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X, TrendingUp, Info, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

/* ─── 항상 이 테이블에 저장 ─── */
const TARGET_TABLE = 'marketing_data'

/* 필수 컬럼 (CSV 기준) */
const REQUIRED_COLS = ['Event Date', 'Channel']

/**
 * CSV 컬럼명(에어브릿지) → DB 컬럼명(snake_case) 매핑
 */
const COL_MAP = {
  'Event Date':            'date',
  'Channel':               'channel',
  'Campaign':              'campaign',
  'Ad Group':              'ad_group',
  'Ad Creative':           'ad_creative',
  'Content':               'content',
  'Sub Publisher':         'sub_publisher',
  'Term':                  'term',
  'Impressions (Channel)': 'impressions',
  'Clicks (Channel)':      'clicks',
  'CPC (Channel)':         'cpc',
  'Installs (App)':        'installs',
  'Cost (Channel)':        'spend',
  '회원가입 (App+Web)':      'signups',
  '구매 완료 (App+Web)':     'purchases',
  '구매액 (App+Web)':        'revenue',
}

/* CSV 컬럼명 목록 (표시/매핑 확인용) */
const ALL_COLS = Object.keys(COL_MAP)

/* ─── CSV 파서 (RFC 4180 준수 — quoted 필드 내 콤마·개행 올바르게 처리) ─── */
function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }  // "" → escaped "
      else if (ch === '"')             { inQuotes = false }
      else                             { field += ch }
    } else {
      if      (ch === '"')                          { inQuotes = true }
      else if (ch === ',')                          { row.push(field.trim()); field = '' }
      else if (ch === '\r' && next === '\n')        { row.push(field.trim()); field = ''; rows.push(row); row = []; i++ }
      else if (ch === '\n' || ch === '\r')          { row.push(field.trim()); field = ''; rows.push(row); row = [] }
      else                                          { field += ch }
    }
  }
  // 마지막 필드/행
  row.push(field.trim())
  if (row.some(f => f !== '')) rows.push(row)

  if (rows.length < 2) return { headers: [], rows: [] }

  const headers = rows[0]
  const dataRows = rows.slice(1)
    .filter(r => r.some(f => f !== ''))
    .map(vals => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
      return obj
    })
  return { headers, rows: dataRows }
}

/* ─── 숫자형 DB 컬럼 (insert 전 string → number 변환) ─── */
const NUMERIC_DB_COLS = new Set([
  'impressions', 'clicks', 'cpc', 'installs', 'spend',
  'signups', 'purchases', 'revenue',
])

function toDbValue(dbCol, rawVal) {
  if (rawVal === '' || rawVal === undefined || rawVal === null) return null
  if (NUMERIC_DB_COLS.has(dbCol)) {
    const n = parseFloat(String(rawVal).replace(/,/g, ''))  // "1,234" → 1234
    return isNaN(n) ? null : n
  }
  return rawVal
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
  const [step,         setStep]         = useState(0)   // 0:업로드 1:확인 2:완료
  const [file,         setFile]         = useState(null)
  const [parsed,       setParsed]       = useState(null) // { headers, rows }
  const [uploading,    setUploading]    = useState(false)
  const [progress,     setProgress]     = useState(0)
  const [result,       setResult]       = useState(null)
  const [dragOver,     setDragOver]     = useState(false)
  const [uploadMode,   setUploadMode]   = useState('overwrite') // 'overwrite' | 'clear_all'
  const [clearConfirm, setClearConfirm] = useState(false)
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

  /* 업로드 가능 여부 */
  const canUpload = !uploading && missingCols.length === 0
    && (uploadMode !== 'clear_all' || clearConfirm)

  /* 업로드 실행 */
  const handleUpload = async () => {
    setUploading(true)
    setProgress(0)
    try {
      /* COL_MAP 기준으로 CSV → DB 컬럼명 변환 + 숫자 타입 변환 */
      const rawRows = parsed.rows.map(row => {
        const obj = {}
        matchedCols.forEach(csvCol => {
          const dbCol = COL_MAP[csvCol]
          obj[dbCol] = toDbValue(dbCol, row[csvCol])
        })
        return obj
      })

      /* CSV 내 중복 제거 (동일 키: date+channel+campaign+ad_group+ad_creative → 마지막 행 우선) */
      const deduped = Object.values(
        rawRows.reduce((acc, row) => {
          const key = [row.date, row.channel, row.campaign, row.ad_group, row.ad_creative].join('|')
          acc[key] = row
          return acc
        }, {})
      )

      /* ── Step 1: 기존 데이터 삭제 ── */
      if (uploadMode === 'clear_all') {
        /* 전체 초기화: 테이블 전체 삭제 */
        const { error } = await supabase
          .from(TARGET_TABLE)
          .delete()
          .gte('date', '1900-01-01')
        if (error) throw error
      } else {
        /* 날짜 범위 덮어쓰기: CSV 날짜 범위 내 행만 삭제 */
        if (dateRange) {
          const { error } = await supabase
            .from(TARGET_TABLE)
            .delete()
            .gte('date', dateRange.start)
            .lte('date', dateRange.end)
          if (error) throw error
        }
      }

      /* ── Step 2: 새 데이터 삽입 ── */
      const CHUNK = 500
      let inserted = 0
      for (let i = 0; i < deduped.length; i += CHUNK) {
        const chunk = deduped.slice(i, i + CHUNK)
        const { error } = await supabase.from(TARGET_TABLE).insert(chunk)
        if (error) throw error
        inserted += chunk.length
        setProgress(Math.round((inserted / deduped.length) * 100))
      }

      setResult({ ok: true, count: inserted, mode: uploadMode, dateRange })
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
    setUploadMode('overwrite'); setClearConfirm(false)
  }

  /* 스타일 헬퍼 */
  const card = `rounded-xl border p-6 ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`
  const txt  = dark ? 'text-white' : 'text-slate-800'
  const sub  = dark ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl mx-auto">

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
                UTF-8 인코딩 · 채널 자동 감지 · marketing_data에 직접 저장
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
            <div className="grid grid-cols-3 gap-3 mb-4">
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

          {/* ── 업로드 방식 선택 ── */}
          <div className={card}>
            <p className={`text-xs font-semibold mb-3 ${sub}`}>업로드 방식</p>
            <div className="grid grid-cols-2 gap-3">

              {/* 날짜 범위 덮어쓰기 */}
              <button
                onClick={() => { setUploadMode('overwrite'); setClearConfirm(false) }}
                className={`
                  rounded-xl border p-4 text-left transition-all
                  ${uploadMode === 'overwrite'
                    ? dark
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-indigo-500 bg-indigo-50'
                    : dark
                      ? 'border-[#252836] hover:border-indigo-500/40 bg-[#13151C]'
                      : 'border-slate-200 hover:border-indigo-300 bg-slate-50'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                    ${uploadMode === 'overwrite'
                      ? 'bg-indigo-500 text-white'
                      : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-200 text-slate-400'}`}>
                    <RefreshCw size={14} />
                  </div>
                  <span className={`text-xs font-bold ${uploadMode === 'overwrite' ? 'text-indigo-400' : sub}`}>
                    날짜 범위 덮어쓰기
                  </span>
                  {uploadMode === 'overwrite' && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-indigo-500 text-white font-semibold">
                      권장
                    </span>
                  )}
                </div>
                <p className={`text-[11px] leading-relaxed ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  CSV의 날짜 범위 내 기존 데이터만 삭제 후 교체합니다.
                  범위 밖 데이터는 그대로 유지됩니다.
                </p>
                {uploadMode === 'overwrite' && dateRange && (
                  <div className={`mt-2.5 rounded-lg px-2.5 py-2 text-[11px] font-mono
                    ${dark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                    🗓 {dateRange.start} ~ {dateRange.end}
                  </div>
                )}
              </button>

              {/* 전체 초기화 */}
              <button
                onClick={() => { setUploadMode('clear_all'); setClearConfirm(false) }}
                className={`
                  rounded-xl border p-4 text-left transition-all
                  ${uploadMode === 'clear_all'
                    ? dark
                      ? 'border-red-500/60 bg-red-500/10'
                      : 'border-red-400 bg-red-50'
                    : dark
                      ? 'border-[#252836] hover:border-red-500/30 bg-[#13151C]'
                      : 'border-slate-200 hover:border-red-300 bg-slate-50'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                    ${uploadMode === 'clear_all'
                      ? 'bg-red-500 text-white'
                      : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-200 text-slate-400'}`}>
                    <Trash2 size={14} />
                  </div>
                  <span className={`text-xs font-bold ${uploadMode === 'clear_all' ? 'text-red-400' : sub}`}>
                    전체 초기화
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  테이블의 모든 데이터를 삭제하고 CSV 데이터로 새로 채웁니다.
                  되돌릴 수 없습니다.
                </p>
              </button>
            </div>

            {/* 전체 초기화 확인 체크박스 */}
            {uploadMode === 'clear_all' && (
              <label className={`
                mt-3 flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer
                border transition-all select-none
                ${clearConfirm
                  ? dark ? 'border-red-500/40 bg-red-500/10' : 'border-red-300 bg-red-50'
                  : dark ? 'border-[#252836] bg-[#13151C]' : 'border-slate-200 bg-slate-50'
                }
              `}>
                <input
                  type="checkbox"
                  checked={clearConfirm}
                  onChange={e => setClearConfirm(e.target.checked)}
                  className="w-4 h-4 accent-red-500 shrink-0"
                />
                <span className={`text-xs ${clearConfirm ? 'text-red-400 font-semibold' : sub}`}>
                  <span className="font-mono font-bold">{TARGET_TABLE}</span>의 모든 데이터가 삭제됨을 이해했습니다
                </span>
              </label>
            )}
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
            disabled={!canUpload}
            className={`
              w-full py-3 text-white text-sm font-semibold rounded-xl transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              ${uploadMode === 'clear_all'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-indigo-600 hover:bg-indigo-700'}
            `}
          >
            {uploading
              ? `업로드 중... ${progress}%`
              : uploadMode === 'clear_all'
                ? `전체 초기화 후 ${parsed.rows.length.toLocaleString()}행 업로드`
                : `${parsed.rows.length.toLocaleString()}행 → ${TARGET_TABLE} 덮어쓰기`
            }
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
              {result.ok ? (
                <div className={`text-sm mt-1.5 ${sub} flex flex-col gap-1`}>
                  <p>
                    {result.count.toLocaleString()}행이{' '}
                    <span className="font-mono font-semibold text-indigo-400">{TARGET_TABLE}</span>에 저장되었습니다.
                  </p>
                  {result.mode === 'overwrite' && result.dateRange && (
                    <p className={`text-xs ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                      적용 범위: {result.dateRange.start} ~ {result.dateRange.end}
                    </p>
                  )}
                  {result.mode === 'clear_all' && (
                    <p className={`text-xs ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                      기존 데이터 전체 삭제 후 새로 저장
                    </p>
                  )}
                  <p className={`text-xs mt-1 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                    대시보드를 새로고침하면 반영됩니다.
                  </p>
                </div>
              ) : (
                <p className={`text-sm mt-1.5 ${sub}`}>{result.error}</p>
              )}
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
