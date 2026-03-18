import { useState, useEffect, useRef, useCallback } from 'react'
import { Shield, Upload, Trash2, Search, Download, AlertCircle, CheckCircle2, Users } from 'lucide-react'

const STORAGE_KEY = 'excluded_guest_ids'

/* ─── localStorage 기반 제외 목록 관리 ─── */
export function getExcludedGuestIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch { return [] }
}

export function setExcludedGuestIds(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/* ─── CSV 파싱 ─── */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], error: '데이터가 없습니다 (헤더 + 1행 이상 필요)' }

  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''))

  // userId, email, guestId 컬럼 찾기
  const guestIdx = headers.findIndex(h => h === 'guestid' || h === 'guest_id')
  const userIdx = headers.findIndex(h => h === 'userid' || h === 'user_id')
  const emailIdx = headers.findIndex(h => h === 'email')

  if (guestIdx === -1) {
    return { rows: [], error: 'guestId (또는 guest_id) 컬럼을 찾을 수 없습니다' }
  }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/"/g, ''))
    const guestId = cols[guestIdx]
    if (!guestId) continue
    rows.push({
      guestId,
      userId: userIdx >= 0 ? cols[userIdx] || '' : '',
      email: emailIdx >= 0 ? cols[emailIdx] || '' : '',
    })
  }

  return { rows, error: null }
}

const fmtNum = v => Math.round(v).toLocaleString()

export default function ExcludeUsers({ dark }) {
  const [excludeList, setExcludeList] = useState([]) // { guestId, userId, email, addedAt }
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileRef = useRef(null)

  const t = dark
    ? { bg: 'bg-[#1D2125]', card: 'bg-[#22272B]', border: 'border-[#A1BDD914]', text: 'text-white', sub: 'text-slate-400', muted: 'text-slate-500',
        input: 'bg-[#2C333A] border-[#A1BDD914] text-white', inputFocus: 'focus:border-blue-500' }
    : { bg: 'bg-slate-50', card: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', sub: 'text-slate-600', muted: 'text-slate-400',
        input: 'bg-white border-slate-200 text-slate-800', inputFocus: 'focus:border-blue-500' }

  // 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setExcludeList(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  // 저장
  const save = useCallback((list) => {
    setExcludeList(list)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }, [])

  // CSV 파일 처리
  const handleFile = useCallback((file) => {
    if (!file) return
    setUploadResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const { rows, error } = parseCSV(e.target.result)
      if (error) {
        setUploadResult({ success: false, message: error })
        return
      }

      const existing = new Set(excludeList.map(x => x.guestId))
      const now = new Date().toISOString()
      const newEntries = rows
        .filter(r => !existing.has(r.guestId))
        .map(r => ({ ...r, addedAt: now }))

      const merged = [...excludeList, ...newEntries]
      save(merged)
      setUploadResult({
        success: true,
        message: `${fmtNum(rows.length)}건 중 ${fmtNum(newEntries.length)}건 추가 (${fmtNum(rows.length - newEntries.length)}건 중복)`,
      })
    }
    reader.readAsText(file, 'UTF-8')
  }, [excludeList, save])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv'))) handleFile(file)
  }

  const removeItem = (guestId) => {
    save(excludeList.filter(x => x.guestId !== guestId))
  }

  const clearAll = () => {
    if (confirm('제외 목록을 전체 초기화하시겠습니까?')) {
      save([])
      setUploadResult(null)
    }
  }

  // 필터
  const filtered = search
    ? excludeList.filter(x =>
        x.guestId.includes(search) ||
        (x.userId && x.userId.includes(search)) ||
        (x.email && x.email.toLowerCase().includes(search.toLowerCase()))
      )
    : excludeList

  // 샘플 CSV 다운로드
  const downloadSample = () => {
    const csv = 'userId,email,guestId\nuser001,test@test.com,12345\nuser002,staff@company.com,67890\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'exclude_users_sample.csv'
    a.click()
  }

  return (
    <div className={`min-h-screen ${t.bg}`}>
      {/* ── Sticky 헤더 ── */}
      <div className={`sticky top-0 z-20 ${dark ? 'bg-[#1D2125]/95' : 'bg-slate-50/95'} backdrop-blur-sm border-b ${t.border}`}>
        <div className="px-4 pt-3 pb-2.5">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-red-400" />
            <h1 className={`text-base font-bold ${t.text}`}>유저 제외 관리</h1>
            <span className={`text-[11px] px-2 py-0.5 rounded-full ml-2 ${dark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-500'}`}>
              {fmtNum(excludeList.length)}명 제외 중
            </span>
          </div>
          <p className={`text-[11px] mt-0.5 ${t.muted}`}>
            내부 임직원 등 분석 대상에서 제외할 유저를 관리합니다. guestId 기준으로 유저분석 전체에 적용됩니다.
          </p>
        </div>
      </div>

      <div className="px-4 pt-3 pb-6 space-y-3">
        {/* ── CSV 업로드 ── */}
        <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-xs font-semibold ${t.text}`}>📤 CSV 업로드</h3>
            <button onClick={downloadSample}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Download size={10} /> 샘플 CSV
            </button>
          </div>

          {/* 드래그 & 드롭 영역 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
              ${dragOver
                ? 'border-blue-400 bg-blue-500/10'
                : dark ? 'border-[#A1BDD914] hover:border-slate-500' : 'border-slate-200 hover:border-slate-400'}`}>
            <Upload size={20} className={`mx-auto mb-1.5 ${dragOver ? 'text-blue-400' : t.muted}`} />
            <p className={`text-xs ${t.sub}`}>CSV/TSV 파일을 드래그하거나 클릭하여 업로드</p>
            <p className={`text-[10px] mt-0.5 ${t.muted}`}>필수 컬럼: guestId · 선택: userId, email</p>
            <input ref={fileRef} type="file" accept=".csv,.tsv" className="hidden"
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {/* 업로드 결과 */}
          {uploadResult && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs ${uploadResult.success ? 'text-emerald-500' : 'text-red-500'}`}>
              {uploadResult.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {uploadResult.message}
            </div>
          )}
        </div>

        {/* ── 제외 목록 ── */}
        <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
          <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Users size={13} className={t.muted} />
              <h3 className={`text-xs font-semibold ${t.text}`}>제외 유저 목록</h3>
              <span className={`text-[10px] ${t.muted}`}>{fmtNum(filtered.length)}명</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 rounded px-2 py-0.5 ${dark ? 'bg-[#2C333A]' : 'bg-slate-100'}`}>
                <Search size={11} className={t.muted} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="검색..." className={`bg-transparent outline-none text-[11px] w-24 ${t.text}`} />
              </div>
              {excludeList.length > 0 && (
                <button onClick={clearAll}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
                  <Trash2 size={10} /> 전체 초기화
                </button>
              )}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="overflow-x-auto" style={{ maxHeight: 400 }}>
              <table className="w-full text-[11px]">
                <thead className={`sticky top-0 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'}`}>
                  <tr>
                    {['Guest ID', 'User ID', 'Email', '등록일', ''].map(h => (
                      <th key={h} className={`px-2 py-1.5 text-left font-semibold ${t.sub}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((item) => (
                    <tr key={item.guestId} className={`border-t ${t.border} ${dark ? 'hover:bg-[#2C333A]' : 'hover:bg-slate-50'}`}>
                      <td className={`px-2 py-1.5 font-mono font-medium ${t.text}`}>{item.guestId}</td>
                      <td className={`px-2 py-1.5 font-mono ${t.muted}`}>{item.userId || '—'}</td>
                      <td className={`px-2 py-1.5 ${t.muted}`}>{item.email || '—'}</td>
                      <td className={`px-2 py-1.5 ${t.muted}`}>
                        {item.addedAt ? new Date(item.addedAt).toLocaleDateString('ko-KR') : '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeItem(item.guestId)}
                          className="text-red-400 hover:text-red-300 p-0.5">
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`p-6 text-center ${t.muted}`}>
              <Shield size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs">제외된 유저가 없습니다</p>
              <p className="text-[10px] mt-0.5">CSV 파일을 업로드하여 내부 임직원을 추가하세요</p>
            </div>
          )}
        </div>

        {/* ── 안내 ── */}
        <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
          <h3 className={`text-xs font-semibold mb-1.5 ${t.text}`}>ℹ️ 적용 범위</h3>
          <ul className={`text-[11px] space-y-0.5 ${t.muted}`}>
            <li>• 지점별 분석, 유저 세그먼트, 이용 패턴 등 유저분석 전체에 적용</li>
            <li>• guestId 기준으로 해당 유저의 모든 예약 데이터가 분석에서 제외됩니다</li>
            <li>• 제외 목록은 브라우저에 저장되며 다른 기기에서는 별도 설정이 필요합니다</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
