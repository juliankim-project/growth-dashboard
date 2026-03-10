import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X, TrendingUp, Info, Trash2, RefreshCw, Package, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'

/* ─── camelCase → snake_case 변환 ─── */
function camelToSnake(s) {
  return s.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
}

/* ─── CSV 헤더 → DB-safe 컬럼명 변환 (한글·특수문자 포함) ─── */
function sanitizeColName(header) {
  return header
    .replace(/[()（）\[\]]/g, '')
    .replace(/[+&]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}

/* ═══════════════════════════════════════════════════
   테이블별 설정
   ═══════════════════════════════════════════════════ */
const TABLE_CONFIGS = {
  marketing_data: {
    label: 'Marketing Data',
    desc: '에어브릿지 마케팅 데이터',
    color: 'indigo',
    requiredCols: ['Event Date', 'Channel'],
    colMap: {
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
      '상세페이지 조회 (App+Web)': 'view_content',
      '회원가입 (App+Web)':      'signups',
      '구매 완료 (App+Web)':     'purchases',
      '구매액 (App+Web)':        'revenue',
    },
    numericCols: new Set([
      'impressions', 'clicks', 'cpc', 'installs', 'spend',
      'view_content', 'signups', 'purchases', 'revenue',
    ]),
    dedupKey: row => [row.date, row.channel, row.campaign, row.ad_group, row.ad_creative].join('|'),
    dateDbCol: 'date',
    csvDateCol: 'Event Date',
    csvChannelCol: 'Channel',
  },

  product_revenue_raw: {
    label: 'Product Revenue',
    desc: '상품 매출 원장 데이터',
    color: 'violet',
    requiredCols: ['id', 'reservationDate'],
    colMap: 'auto',   // camelCase → snake_case 자동 변환
    numericCols: new Set([
      'id', 'guest_id', 'user_id', 'branch_id', 'roomtype_id', 'room_id', 'channel_id',
      'nights', 'peoples', 'payment_amount', 'original_price',
      'staypass_discount', 'promo_discount', 'coupon_discount_amount', 'point_amount',
      'has_gift', 'is_extend', 'prohibit_move', 'early_check_in', 'late_check_out',
      'is_long', 'lead_time',
    ]),
    /* DB 컬럼 타입 (ensure_table_columns RPC에 전달) */
    colTypes: {
      'id': 'BIGINT', 'guest_id': 'BIGINT', 'user_id': 'BIGINT',
      'branch_id': 'INTEGER', 'roomtype_id': 'INTEGER', 'room_id': 'INTEGER', 'channel_id': 'INTEGER',
      'nights': 'INTEGER', 'peoples': 'INTEGER',
      'payment_amount': 'NUMERIC', 'original_price': 'NUMERIC',
      'staypass_discount': 'NUMERIC', 'promo_discount': 'NUMERIC',
      'coupon_discount_amount': 'NUMERIC', 'point_amount': 'NUMERIC',
      'has_gift': 'INTEGER', 'is_extend': 'INTEGER', 'prohibit_move': 'INTEGER',
      'early_check_in': 'INTEGER', 'late_check_out': 'INTEGER',
      'is_long': 'INTEGER', 'lead_time': 'INTEGER',
      'reservation_date': 'DATE', 'check_in_date': 'DATE',
      'check_in': 'TIMESTAMPTZ', 'check_out': 'TIMESTAMPTZ',
      'reserved_at': 'TIMESTAMPTZ', 'created_at': 'TIMESTAMPTZ', 'updated_at': 'TIMESTAMPTZ',
    },
    dedupKey: row => String(row.id),
    dateDbCol: 'reservation_date',
    csvDateCol: 'reservationDate',
    csvChannelCol: 'channelName',
  },
}

const TABLE_KEYS = Object.keys(TABLE_CONFIGS)

/* ─── 구분자 자동 감지 파서 (CSV/TSV) ─── */
function parseDelimited(text) {
  const firstLine = text.split(/\r?\n/)[0] || ''
  const tabCount   = (firstLine.match(/\t/g) || []).length
  const commaCount = (firstLine.match(/,/g)  || []).length

  if (tabCount > commaCount && tabCount > 2) return parseTSV(text)
  return parseCSV(text)
}

/* RFC 4180 CSV 파서 (quoted 필드 내 콤마·개행 처리) */
function parseCSV(text) {
  const rows = []
  let row = [], field = '', inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else field += ch
    } else {
      if      (ch === '"')                   inQuotes = true
      else if (ch === ',')                   { row.push(field.trim()); field = '' }
      else if (ch === '\r' && next === '\n') { row.push(field.trim()); field = ''; rows.push(row); row = []; i++ }
      else if (ch === '\n' || ch === '\r')   { row.push(field.trim()); field = ''; rows.push(row); row = [] }
      else                                   field += ch
    }
  }
  row.push(field.trim())
  if (row.some(f => f !== '')) rows.push(row)
  return toObjects(rows)
}

/* 간단한 TSV 파서 */
function parseTSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const rows = lines.map(l => l.split('\t').map(c => c.trim()))
  return toObjects(rows)
}

/* rows → objects 변환 */
function toObjects(rows) {
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

/* ─── DB 값 변환 ─── */
function toDbValue(dbCol, rawVal, numericCols) {
  if (rawVal === '' || rawVal === undefined || rawVal === null) return null
  if (numericCols.has(dbCol)) {
    const n = parseFloat(String(rawVal).replace(/,/g, ''))
    return isNaN(n) ? null : n
  }
  return rawVal
}

/* ─── 업로드 기록 ─── */
const HISTORY_KEY = 'upload_history_v1'
function appendHistory(entry) {
  try {
    const prev = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...prev].slice(0, 200)))
  } catch {}
}

/* ─── 채널 요약 ─── */
function getChannelSummary(rows, channelCol) {
  const map = {}
  rows.forEach(r => {
    const ch = r[channelCol] || '(채널 없음)'
    map[ch] = (map[ch] || 0) + 1
  })
  return Object.entries(map).map(([channel, count]) => ({ channel, count }))
}

/* ─── 날짜 범위 ─── */
function getDateRange(rows, dateCol) {
  const dates = rows.map(r => r[dateCol]).filter(Boolean).sort()
  if (!dates.length) return null
  return { start: dates[0], end: dates[dates.length - 1] }
}

/* ─── colMap 빌드 ─── */
function buildColMap(cfg, headers) {
  if (cfg.colMap === 'auto') {
    return Object.fromEntries(headers.map(h => [h, camelToSnake(h)]))
  }
  /* 정적 매핑 + CSV에만 있는 미지 컬럼 자동 추가 */
  const map = { ...cfg.colMap }
  headers.forEach(h => {
    if (!map[h]) {
      map[h] = sanitizeColName(h)
    }
  })
  return map
}

/* ─── 샘플 데이터로 숫자 컬럼 자동 감지 ─── */
function detectNumericCols(rows, csvCols, colMap, knownNumeric) {
  const detected = new Set(knownNumeric)
  csvCols.forEach(csvCol => {
    const dbCol = colMap[csvCol]
    if (detected.has(dbCol)) return
    const sample = rows.slice(0, 50).filter(r => r[csvCol] != null && r[csvCol] !== '')
    if (sample.length > 0 && sample.every(r => {
      const v = String(r[csvCol]).replace(/,/g, '')
      return !isNaN(parseFloat(v)) && isFinite(v)
    })) {
      detected.add(dbCol)
    }
  })
  return detected
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
  const [selectedTable, setSelectedTable] = useState('marketing_data')
  const [file,         setFile]         = useState(null)
  const [parsed,       setParsed]       = useState(null)
  const [uploading,    setUploading]    = useState(false)
  const [progress,     setProgress]     = useState(0)
  const [result,       setResult]       = useState(null)
  const [dragOver,     setDragOver]     = useState(false)
  const [uploadMode,   setUploadMode]   = useState('overwrite')
  const [clearConfirm, setClearConfirm] = useState(false)
  const fileRef = useRef()

  const cfg    = TABLE_CONFIGS[selectedTable]
  const colMap = parsed ? buildColMap(cfg, parsed.headers) : {}
  const allCols = Object.keys(colMap)

  /* 파일 처리 */
  const handleFile = f => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'tsv'].includes(ext)) return alert('CSV 또는 TSV 파일만 지원합니다.')
    setFile(f)
    const reader = new FileReader()
    reader.onload = e => {
      const p = parseDelimited(e.target.result)
      setParsed(p)
      // 테이블 자동 감지: CSV 헤더 기반
      const headers = p.headers
      if (headers.includes('reservationDate') && headers.includes('branchName')) {
        setSelectedTable('product_revenue_raw')
      } else if (headers.includes('Event Date') && headers.includes('Channel')) {
        setSelectedTable('marketing_data')
      }
      setStep(1)
    }
    reader.readAsText(f, 'UTF-8')
  }

  /* 파생 데이터 — cfg 변경 시 재계산 */
  const channelSummary = parsed ? getChannelSummary(parsed.rows, cfg.csvChannelCol) : []
  const dateRange      = parsed ? getDateRange(parsed.rows, cfg.csvDateCol) : null
  const missingCols    = parsed ? cfg.requiredCols.filter(c => !parsed.headers.includes(c)) : []
  const matchedCols    = parsed ? allCols.filter(c => parsed.headers.includes(c)) : []
  const unmatchedCols  = parsed ? allCols.filter(c => !parsed.headers.includes(c)) : []

  const canUpload = !uploading && missingCols.length === 0
    && (uploadMode !== 'clear_all' || clearConfirm)

  /* 업로드 실행 */
  const handleUpload = async () => {
    setUploading(true)
    setProgress(0)
    try {
      const currentColMap = buildColMap(cfg, parsed.headers)
      const currentMatchedCols = Object.keys(currentColMap).filter(c => parsed.headers.includes(c))

      /* 숫자 컬럼 자동 감지 (config에 없는 새 컬럼 포함) */
      const dynNumericCols = detectNumericCols(
        parsed.rows, currentMatchedCols, currentColMap, cfg.numericCols
      )

      /* 모든 테이블: DB에 없는 컬럼 자동 생성 (ensure_table_columns RPC) */
      const colDefs = currentMatchedCols.map(csvCol => {
        const dbCol = currentColMap[csvCol]
        let type = cfg.colTypes?.[dbCol]
        if (!type) type = dynNumericCols.has(dbCol) ? 'NUMERIC' : 'TEXT'
        return { name: dbCol, type }
      })
      const { error: rpcErr } = await supabase.rpc('ensure_table_columns', {
        p_table: selectedTable,
        p_columns: colDefs,
      })
      if (rpcErr) {
        console.warn('[DataStudio] ensure_table_columns:', rpcErr.message)
        /* RPC가 없으면 안내 후 중단 */
        if (rpcErr.message.includes('Could not find the function')) {
          throw new Error(
            'ensure_table_columns RPC 함수가 Supabase에 없습니다.\n' +
            'Supabase SQL Editor에서 해당 함수를 먼저 생성해주세요.'
          )
        }
      }

      /* PostgREST 스키마 캐시 갱신 대기 (새 컬럼 추가 시) */
      const hasNewCols = colDefs.some(d =>
        typeof cfg.colMap === 'object' ? !Object.values(cfg.colMap).includes(d.name) : false
      ) || cfg.colMap === 'auto'
      if (!rpcErr && hasNewCols) {
        setProgress(5)
        await new Promise(r => setTimeout(r, 2000))
      }

      const rawRows = parsed.rows.map(row => {
        const obj = {}
        currentMatchedCols.forEach(csvCol => {
          const dbCol = currentColMap[csvCol]
          obj[dbCol] = toDbValue(dbCol, row[csvCol], dynNumericCols)
        })
        return obj
      })

      /* 중복 제거 */
      const deduped = Object.values(
        rawRows.reduce((acc, row) => {
          const key = cfg.dedupKey(row)
          acc[key] = row
          return acc
        }, {})
      )

      /* Step 1: 기존 데이터 삭제 */
      if (uploadMode === 'clear_all') {
        const { error } = await supabase
          .from(selectedTable)
          .delete()
          .gte(cfg.dateDbCol, '1900-01-01')
        if (error) throw error
      } else {
        if (dateRange) {
          const { error } = await supabase
            .from(selectedTable)
            .delete()
            .gte(cfg.dateDbCol, dateRange.start)
            .lte(cfg.dateDbCol, dateRange.end)
          if (error) throw error
        }
      }

      /* Step 2: 새 데이터 삽입 */
      const CHUNK = 500
      let inserted = 0
      for (let i = 0; i < deduped.length; i += CHUNK) {
        const chunk = deduped.slice(i, i + CHUNK)
        const { error } = await supabase.from(selectedTable).insert(chunk)
        if (error) throw error
        inserted += chunk.length
        setProgress(Math.round((inserted / deduped.length) * 100))
      }

      const res = { ok: true, count: inserted, mode: uploadMode, dateRange }
      setResult(res)
      setStep(2)
      appendHistory({
        filename: file.name, table: selectedTable, rows: inserted, ok: true,
        mode: uploadMode,
        dateRange: dateRange ? `${dateRange.start} ~ ${dateRange.end}` : null,
        date: new Date().toLocaleString('ko-KR'),
      })
    } catch (err) {
      setResult({ ok: false, error: err.message })
      setStep(2)
      appendHistory({
        filename: file.name, table: selectedTable, rows: 0, ok: false,
        error: err.message, date: new Date().toLocaleString('ko-KR'),
      })
    }
    setUploading(false)
  }

  const reset = () => {
    setStep(0); setFile(null); setParsed(null)
    setResult(null); setProgress(0)
    setUploadMode('overwrite'); setClearConfirm(false)
  }

  /* 스타일 */
  const card = `rounded-xl border p-6 ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`
  const txt  = dark ? 'text-white' : 'text-slate-800'
  const sub  = dark ? 'text-slate-400' : 'text-slate-700'

  const accentBorder = cfg.color === 'violet'
    ? dark ? 'border-violet-500' : 'border-violet-500'
    : dark ? 'border-indigo-500' : 'border-indigo-500'
  const accentBg = cfg.color === 'violet'
    ? dark ? 'bg-violet-500/10' : 'bg-violet-50'
    : dark ? 'bg-indigo-500/10' : 'bg-indigo-50'
  const accentText = cfg.color === 'violet' ? 'text-violet-400' : 'text-indigo-400'

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl mx-auto">

      {/* 헤더 */}
      <div>
        <h2 className={`text-lg font-bold ${txt}`}>Data Studio</h2>
        <p className={`text-xs mt-1 ${sub}`}>
          CSV/TSV 업로드 →{' '}
          <span className={`font-mono font-semibold ${accentText}`}>{selectedTable}</span>
          {' '}자동 저장 · 채널은 CSV 내 Channel 컬럼으로 자동 구분
        </p>
      </div>

      {/* ── Step 0: 파일 업로드 ── */}
      {step === 0 && (
        <div className="flex flex-col gap-4">

          {/* 테이블 선택 */}
          <div className={card}>
            <p className={`text-xs font-semibold mb-3 ${sub}`}>저장할 테이블 선택</p>
            <div className="grid grid-cols-2 gap-3">
              {TABLE_KEYS.map(key => {
                const c = TABLE_CONFIGS[key]
                const active = selectedTable === key
                const isViolet = c.color === 'violet'
                return (
                  <button key={key} onClick={() => setSelectedTable(key)}
                    className={`
                      rounded-xl border p-4 text-left transition-all
                      ${active
                        ? isViolet
                          ? dark ? 'border-violet-500 bg-violet-500/10' : 'border-violet-500 bg-violet-50'
                          : dark ? 'border-indigo-500 bg-indigo-500/10' : 'border-indigo-500 bg-indigo-50'
                        : dark
                          ? 'border-[#252836] hover:border-slate-600 bg-[#13151C]'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                        ${active
                          ? isViolet ? 'bg-violet-500 text-white' : 'bg-indigo-500 text-white'
                          : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-200 text-slate-600'
                        }`}>
                        {isViolet ? <Package size={14} /> : <TrendingUp size={14} />}
                      </div>
                      <span className={`text-xs font-bold ${active
                        ? isViolet ? 'text-violet-400' : 'text-indigo-400'
                        : sub}`}>
                        {c.label}
                      </span>
                    </div>
                    <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-slate-500'}`}>
                      {c.desc}
                    </p>
                    <p className={`text-[10px] font-mono mt-1.5 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {key}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 파일 드롭 */}
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
                  ? `${accentBorder} ${accentBg}`
                  : dark ? 'border-[#2E3450] hover:border-indigo-600' : 'border-slate-200 hover:border-indigo-400'}
              `}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center
                ${dark ? 'bg-[#13151C]' : 'bg-slate-50'}`}>
                <Upload size={28} className={accentText} />
              </div>
              <div className="text-center">
                <p className={`font-semibold text-sm ${txt}`}>
                  CSV / TSV 파일을 드롭하거나 클릭해서 선택
                </p>
                <p className={`text-xs mt-1 ${sub}`}>
                  UTF-8 인코딩 · 테이블 자동 감지 · <span className="font-mono">{selectedTable}</span>에 저장
                </p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.tsv" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />

            {/* 필수 컬럼 안내 */}
            <div className={`mt-4 rounded-lg px-4 py-3 text-xs flex gap-3 items-start
              ${dark ? 'bg-indigo-500/5 border border-indigo-500/15 text-slate-400' : 'bg-indigo-50 border border-indigo-100 text-slate-700'}`}>
              <Info size={13} className={`${accentText} mt-0.5 shrink-0`} />
              <div>
                <p className={`font-semibold ${accentText} mb-1`}>
                  {selectedTable} 필수 컬럼
                </p>
                <p>
                  {cfg.requiredCols.map(c => <span key={c} className="font-mono">{c}</span>).reduce((a, b) => [a, ', ', b])}
                  {' '}컬럼이 반드시 있어야 합니다.
                </p>
                {selectedTable === 'marketing_data' && (
                  <p className="mt-1">Meta, Google, Kakao 등 어떤 채널이든 하나의 CSV로 한 번에 업로드 가능합니다.</p>
                )}
                {selectedTable === 'product_revenue_raw' && (
                  <p className="mt-1">리대시 예약 데이터 CSV/TSV를 그대로 업로드하세요. 컬럼명 자동 변환(camelCase → snake_case)됩니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: 데이터 확인 ── */}
      {step === 1 && parsed && (
        <div className="flex flex-col gap-4">

          {/* 파일 정보 + 테이블 선택 */}
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

            {/* 테이블 전환 */}
            <div className={`mb-4 rounded-lg px-3 py-2 flex items-center gap-2 border
              ${dark ? 'border-[#252836] bg-[#13151C]' : 'border-slate-100 bg-slate-50'}`}>
              <span className={`text-[10px] shrink-0 ${sub}`}>테이블:</span>
              <div className="flex gap-1.5">
                {TABLE_KEYS.map(key => {
                  const c = TABLE_CONFIGS[key]
                  const active = selectedTable === key
                  return (
                    <button key={key} onClick={() => setSelectedTable(key)}
                      className={`
                        text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all
                        ${active
                          ? c.color === 'violet'
                            ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                            : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                          : dark
                            ? 'text-slate-500 hover:text-slate-300 border border-transparent'
                            : 'text-slate-400 hover:text-slate-600 border border-transparent'
                        }
                      `}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>
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
                { label: '매핑 컬럼', value: `${matchedCols.length} / ${allCols.length}` },
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
              ${accentBg} border ${accentBorder}`}>
              <span className={sub}>저장 위치:</span>
              <span className={`font-mono font-bold ${accentText}`}>{selectedTable}</span>
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
              {matchedCols.map(col => {
                const isNew = typeof cfg.colMap === 'object' && !cfg.colMap[col]
                return (
                  <span key={col} className={`text-[11px] px-2 py-1 rounded font-mono border
                    ${isNew
                      ? dark ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-sky-50 text-sky-600 border-sky-100'
                      : dark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                    {isNew ? '+ ' : '✓ '}{col}{(isNew || cfg.colMap === 'auto') ? ` (${colMap[col]})` : ''}
                  </span>
                )
              })}
              {unmatchedCols.map(col => (
                <span key={col} className={`text-[11px] px-2 py-1 rounded font-mono border
                  ${dark ? 'bg-[#13151C] text-slate-600 border-[#252836]' : 'bg-slate-50 text-slate-700 border-slate-100'}`}>
                  — {col}
                </span>
              ))}
            </div>
            <p className={`text-[10px] mt-2 ${sub}`}>
              ✓ 매핑됨: {matchedCols.length}개 · — CSV에 없는 컬럼은 null로 저장
              {cfg.colMap === 'auto' && ' · camelCase → snake_case 자동 변환'}
              {typeof cfg.colMap === 'object' && matchedCols.some(c => !cfg.colMap[c]) &&
                ` · + 새 컬럼 ${matchedCols.filter(c => !cfg.colMap[c]).length}개 자동 추가`
              }
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
                      ? `${accentBorder} ${accentBg}`
                      : `${accentBorder} ${accentBg}`
                    : dark
                      ? 'border-[#252836] hover:border-indigo-500/40 bg-[#13151C]'
                      : 'border-slate-200 hover:border-indigo-300 bg-slate-50'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                    ${uploadMode === 'overwrite'
                      ? cfg.color === 'violet' ? 'bg-violet-500 text-white' : 'bg-indigo-500 text-white'
                      : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-200 text-slate-600'}`}>
                    <RefreshCw size={14} />
                  </div>
                  <span className={`text-xs font-bold ${uploadMode === 'overwrite' ? accentText : sub}`}>
                    날짜 범위 덮어쓰기
                  </span>
                  {uploadMode === 'overwrite' && (
                    <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded text-white font-semibold
                      ${cfg.color === 'violet' ? 'bg-violet-500' : 'bg-indigo-500'}`}>
                      권장
                    </span>
                  )}
                </div>
                <p className={`text-[11px] leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                  CSV의 날짜 범위 내 기존 데이터만 삭제 후 교체합니다.
                  범위 밖 데이터는 그대로 유지됩니다.
                </p>
                {uploadMode === 'overwrite' && dateRange && (
                  <div className={`mt-2.5 rounded-lg px-2.5 py-2 text-[11px] font-mono
                    ${cfg.color === 'violet'
                      ? dark ? 'bg-violet-500/10 text-violet-300' : 'bg-violet-100 text-violet-600'
                      : dark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-100 text-indigo-600'
                    }`}>
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
                    ? dark ? 'border-red-500/60 bg-red-500/10' : 'border-red-400 bg-red-50'
                    : dark ? 'border-[#252836] hover:border-red-500/30 bg-[#13151C]' : 'border-slate-200 hover:border-red-300 bg-slate-50'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                    ${uploadMode === 'clear_all'
                      ? 'bg-red-500 text-white'
                      : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-200 text-slate-600'}`}>
                    <Trash2 size={14} />
                  </div>
                  <span className={`text-xs font-bold ${uploadMode === 'clear_all' ? 'text-red-400' : sub}`}>
                    전체 초기화
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
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
                  <span className="font-mono font-bold">{selectedTable}</span>의 모든 데이터가 삭제됨을 이해했습니다
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
                  className={`h-2 rounded-full transition-all duration-300
                    ${cfg.color === 'violet' ? 'bg-violet-500' : 'bg-indigo-500'}`}
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
                : cfg.color === 'violet'
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'}
            `}
          >
            {uploading
              ? `업로드 중... ${progress}%`
              : uploadMode === 'clear_all'
                ? `전체 초기화 후 ${parsed.rows.length.toLocaleString()}행 업로드`
                : `${parsed.rows.length.toLocaleString()}행 → ${selectedTable} 덮어쓰기`
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
                    <span className={`font-mono font-semibold ${accentText}`}>{selectedTable}</span>에 저장되었습니다.
                  </p>
                  {result.mode === 'overwrite' && result.dateRange && (
                    <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                      적용 범위: {result.dateRange.start} ~ {result.dateRange.end}
                    </p>
                  )}
                  {result.mode === 'clear_all' && (
                    <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                      기존 데이터 전체 삭제 후 새로 저장
                    </p>
                  )}
                  <p className={`text-xs mt-1 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                    대시보드를 새로고침하면 반영됩니다.
                  </p>
                </div>
              ) : (
                <p className={`text-sm mt-1.5 ${sub}`}>{result.error}</p>
              )}
            </div>
            <button onClick={reset}
              className={`px-8 py-2.5 text-white text-sm font-semibold rounded-xl transition-colors
                ${cfg.color === 'violet' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              새로 업로드
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
