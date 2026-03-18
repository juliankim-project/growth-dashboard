import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Shield, Upload, Trash2, Search, Download, AlertCircle, CheckCircle2, Users, RefreshCw } from 'lucide-react'

const TABLE = 'excluded_users'

/* ─── DB에서 제외 목록 가져오기 (다른 파일에서도 import 가능) ─── */
let _cache = null
let _cacheTs = 0
const CACHE_TTL = 30_000

export async function getExcludedGuestIds() {
  if (_cache && Date.now() - _cacheTs < CACHE_TTL) return _cache
  if (!supabase) return []
  const { data, error } = await supabase.from(TABLE).select('guest_id')
  if (error) { console.error('[excluded_users]', error); return _cache || [] }
  _cache = data.map(r => r.guest_id)
  _cacheTs = Date.now()
  return _cache
}

export function invalidateExcludeCache() { _cache = null; _cacheTs = 0 }

/* ─── CSV 파싱 ─── */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], error: '데이터가 없습니다 (헤더 + 1행 이상 필요)' }

  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''))

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
      guest_id: guestId,
      user_id: userIdx >= 0 ? cols[userIdx] || null : null,
      email: emailIdx >= 0 ? cols[emailIdx] || null : null,
    })
  }

  return { rows, error: null }
}

const fmtNum = v => Math.round(v).toLocaleString()

export default function ExcludeUsers({ dark }) {
  const [excludeList, setExcludeList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const t = dark
    ? { bg: 'bg-[#1D2125]', card: 'bg-[#22272B]', border: 'border-[#A1BDD914]', text: 'text-white', sub: 'text-slate-400', muted: 'text-slate-500',
        input: 'bg-[#2C333A] border-[#A1BDD914] text-white', inputFocus: 'focus:border-blue-500' }
    : { bg: 'bg-slate-50', card: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', sub: 'text-slate-600', muted: 'text-slate-400',
        input: 'bg-white border-slate-200 text-slate-800', inputFocus: 'focus:border-blue-500' }

  // DB에서 로드
  const loadList = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false })
    if (!error && data) setExcludeList(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadList() }, [loadList])

  // CSV 파일 처리 → DB upsert
  const handleFile = useCallback(async (file) => {
    if (!file || !supabase) return
    setUploadResult(null)
    setUploading(true)

    const text = await file.text()
    const { rows, error } = parseCSV(text)
    if (error) {
      setUploadResult({ success: false, message: error })
      setUploading(false)
      return
    }

    // upsert (guest_id UNIQUE 제약 활용)
    const { data, error: dbErr } = await supabase
      .from(TABLE)
      .upsert(rows, { onConflict: 'guest_id', ignoreDuplicates: true })
      .select()

    if (dbErr) {
      setUploadResult({ success: false, message: `DB 오류: ${dbErr.message}` })
    } else {
      const inserted = data?.length || 0
      setUploadResult({
        success: true,
        message: `${fmtNum(rows.length)}건 처리 → ${fmtNum(inserted)}건 추가 (${fmtNum(rows.length - inserted)}건 중복)`,
      })
      invalidateExcludeCache()
      loadList()
    }
    setUploading(false)
  }, [loadList])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv'))) handleFile(file)
  }

  const removeItem = async (id) => {
    if (!supabase) return
    await supabase.from(TABLE).delete().eq('id', id)
    invalidateExcludeCache()
    loadList()
  }

  const clearAll = async () => {
    if (!confirm('제외 목록을 전체 초기화하시겠습니까?')) return
    if (!supabase) return
    // 전체 삭제: guest_id IS NOT NULL (= 전체)
    await supabase.from(TABLE).delete().neq('guest_id', '')
    invalidateExcludeCache()
    setUploadResult(null)
    loadList()
  }

  // 필터
  const filtered = search
    ? excludeList.filter(x =>
        x.guest_id?.includes(search) ||
        (x.user_id && x.user_id.includes(search)) ||
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
        <div className="px-6 pt-4 pb-2.5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-red-400" />
            <h1 className={`text-lg font-bold ${t.text}`}>유저 제외 관리</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${dark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-500'}`}>
              {fmtNum(excludeList.length)}명 제외 중
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${t.muted}`}>
            내부 임직원 등 분석 대상에서 제외할 유저를 관리합니다. guestId 기준으로 유저분석 전체에 적용됩니다.
          </p>
        </div>
      </div>

      <div className="px-6 pt-5 pb-8 space-y-5">
        {/* ── CSV 업로드 ── */}
        <div className={`rounded-xl border p-4 ${t.card} ${t.border}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-semibold ${t.text}`}>📤 CSV 업로드</h3>
            <button onClick={downloadSample}
              className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Download size={10} /> 샘플 CSV
            </button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all
              ${dragOver
                ? 'border-blue-400 bg-blue-500/10'
                : dark ? 'border-[#A1BDD914] hover:border-slate-500' : 'border-slate-200 hover:border-slate-400'}`}>
            {uploading ? (
              <RefreshCw size={20} className={`mx-auto mb-1.5 animate-spin ${t.muted}`} />
            ) : (
              <Upload size={20} className={`mx-auto mb-1.5 ${dragOver ? 'text-blue-400' : t.muted}`} />
            )}
            <p className={`text-xs ${t.sub}`}>CSV/TSV 파일을 드래그하거나 클릭하여 업로드</p>
            <p className={`text-xs mt-0.5 ${t.muted}`}>필수 컬럼: guestId · 선택: userId, email</p>
            <input ref={fileRef} type="file" accept=".csv,.tsv" className="hidden"
              onChange={(e) => handleFile(e.target.files[0])} />
          </div>

          {uploadResult && (
            <div className={`mt-2 flex items-center gap-1.5 text-xs ${uploadResult.success ? 'text-emerald-500' : 'text-red-500'}`}>
              {uploadResult.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {uploadResult.message}
            </div>
          )}
        </div>

        {/* ── 제외 목록 ── */}
        <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
          <div className={`px-5 py-3 border-b ${t.border} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Users size={16} className={t.muted} />
              <h3 className={`text-sm font-semibold ${t.text}`}>제외 유저 목록</h3>
              <span className={`text-xs ${t.muted}`}>{fmtNum(filtered.length)}명</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 rounded px-2 py-0.5 ${dark ? 'bg-[#2C333A]' : 'bg-slate-100'}`}>
                <Search size={14} className={t.muted} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="검색..." className={`bg-transparent outline-none text-sm w-24 ${t.text}`} />
              </div>
              {excludeList.length > 0 && (
                <button onClick={clearAll}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">
                  <Trash2 size={10} /> 전체 초기화
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className={`p-6 text-center ${t.muted}`}>
              <RefreshCw size={16} className="mx-auto mb-1 animate-spin" />
              <p className="text-xs">로딩 중...</p>
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto" style={{ maxHeight: 400 }}>
              <table className="w-full text-xs">
                <thead className={`sticky top-0 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'}`}>
                  <tr>
                    {['Guest ID', 'User ID', 'Email', '등록일', ''].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-left font-semibold ${t.sub}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((item) => (
                    <tr key={item.id} className={`border-t ${t.border} ${dark ? 'hover:bg-[#2C333A]' : 'hover:bg-slate-50'}`}>
                      <td className={`px-4 py-2.5 font-mono font-medium ${t.text}`}>{item.guest_id}</td>
                      <td className={`px-4 py-2.5 font-mono ${t.muted}`}>{item.user_id || '—'}</td>
                      <td className={`px-4 py-2.5 ${t.muted}`}>{item.email || '—'}</td>
                      <td className={`px-4 py-2.5 ${t.muted}`}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR') : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => removeItem(item.id)}
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
              <p className="text-xs mt-0.5">CSV 파일을 업로드하여 내부 임직원을 추가하세요</p>
            </div>
          )}
        </div>

        {/* ── 안내 ── */}
        <div className={`rounded-xl border p-4 ${t.card} ${t.border}`}>
          <h3 className={`text-sm font-semibold mb-1.5 ${t.text}`}>ℹ️ 적용 범위</h3>
          <ul className={`text-sm space-y-0.5 ${t.muted}`}>
            <li>• 지점별 분석, 유저 세그먼트, 이용 패턴 등 유저분석 전체에 적용</li>
            <li>• guestId 기준으로 해당 유저의 모든 예약 데이터가 분석에서 제외됩니다</li>
            <li>• <strong className={t.sub}>DB에 저장</strong>되어 모든 사용자에게 동일하게 적용됩니다</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
