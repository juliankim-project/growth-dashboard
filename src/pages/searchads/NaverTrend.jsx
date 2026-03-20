import { useState, useCallback, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { Plus, Trash2, Search, AlertCircle, Monitor, Smartphone, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Spinner from '../../components/UI/Spinner'

/* ── 색상 ── */
const COLORS = ['#579DFF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
const BAR_COLORS = { pc: '#579DFF', mobile: '#10B981' }

/* ── Supabase Edge Function 호출 (네이버 검색광고 keywordtool) ── */
async function fetchKeywordData(keywords) {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

  const res = await fetch(`${SUPABASE_URL}/functions/v1/naver-trend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({ keywords }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || '네이버 API 요청 실패')
  }

  return res.json()
}

/* ── 숫자 포맷 ── */
const fmt = n => {
  if (n == null || n === '< 10') return '< 10'
  if (typeof n !== 'number') return String(n)
  return n.toLocaleString()
}

/* ── 커스텀 Tooltip ── */
function ChartTooltip({ active, payload, label, dark }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`rounded-xl px-4 py-3 shadow-xl text-xs border
      ${dark ? 'bg-[#22272B] border-[#A1BDD914] text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-0.5">
          <span style={{ color: p.color }}>●</span>
          <span className={dark ? 'text-slate-400' : 'text-slate-600'}>{p.name}</span>
          <span className="font-bold ml-auto">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ── KPI 카드 ── */
function KpiCard({ label, value, icon, color, dark }) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3
      ${dark ? 'bg-[#1D2125] border-[#A1BDD914]' : 'bg-slate-50 border-slate-200'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
        <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
      </div>
    </div>
  )
}

export default function NaverTrend({ dark }) {
  const [keywords, setKeywords] = useState([''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)  // API 원본 결과

  /* ── 키워드 CRUD ── */
  const updateKw = useCallback((idx, val) => {
    setKeywords(prev => { const n = [...prev]; n[idx] = val; return n })
  }, [])
  const addKw = useCallback(() => setKeywords(prev => prev.length < 5 ? [...prev, ''] : prev), [])
  const removeKw = useCallback((idx) => setKeywords(prev => prev.filter((_, i) => i !== idx)), [])

  /* ── 조회 ── */
  const handleSearch = useCallback(async () => {
    const active = keywords.filter(k => k.trim())
    if (active.length === 0) { setError('키워드를 1개 이상 입력해주세요'); return }

    setLoading(true)
    setError(null)
    try {
      const data = await fetchKeywordData(active)
      if (data?.keywordList) {
        setResults(data)
      } else {
        throw new Error('예상하지 못한 API 응답 형식')
      }
    } catch (e) {
      setError(e.message)
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [keywords])

  /* ── 검색한 키워드만 필터링 + 관련 키워드 분리 ── */
  const activeKeywords = useMemo(() => keywords.filter(k => k.trim()), [keywords])

  const { searched, related } = useMemo(() => {
    if (!results?.keywordList) return { searched: [], related: [] }

    const inputSet = new Set(activeKeywords.map(k => k.replace(/\s+/g, '').toLowerCase()))
    const s = []
    const r = []

    results.keywordList.forEach(item => {
      const kw = (item.relKeyword || '').toLowerCase()
      const pcVol = typeof item.monthlyPcQcCnt === 'number' ? item.monthlyPcQcCnt : 0
      const mobileVol = typeof item.monthlyMobileQcCnt === 'number' ? item.monthlyMobileQcCnt : 0
      const totalVol = pcVol + mobileVol

      const row = {
        keyword: item.relKeyword,
        pc: pcVol,
        mobile: mobileVol,
        total: totalVol,
        pcStr: item.monthlyPcQcCnt,
        mobileStr: item.monthlyMobileQcCnt,
        compIdx: item.compIdx || '-',
      }

      if (inputSet.has(kw)) s.push(row)
      else r.push(row)
    })

    // 관련 키워드는 검색량 내림차순
    r.sort((a, b) => b.total - a.total)
    return { searched: s, related: r.slice(0, 30) }
  }, [results, activeKeywords])

  /* ── 바차트 데이터 (검색 키워드 PC vs 모바일) ── */
  const barData = useMemo(() =>
    searched.map(s => ({ name: s.keyword, PC: s.pc, 모바일: s.mobile })),
    [searched]
  )

  /* ── 관련 키워드 TOP 15 차트 ── */
  const relatedChartData = useMemo(() =>
    related.slice(0, 15).map(r => ({ name: r.keyword, 검색량: r.total })),
    [related]
  )

  /* ── KPI 집계 ── */
  const kpi = useMemo(() => {
    if (searched.length === 0) return null
    const totalAll = searched.reduce((s, r) => s + r.total, 0)
    const totalPc = searched.reduce((s, r) => s + r.pc, 0)
    const totalMobile = searched.reduce((s, r) => s + r.mobile, 0)
    const mobileShare = totalAll > 0 ? Math.round(totalMobile / totalAll * 100) : 0
    return { totalAll, totalPc, totalMobile, mobileShare }
  }, [searched])

  const tick = dark ? '#64748B' : '#475569'
  const grid = dark ? '#2C333A' : '#F1F5F9'

  return (
    <div className="space-y-5">

      {/* ══════ 입력 섹션 ══════ */}
      <div className={`rounded-xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <h2 className={`text-sm font-bold mb-4 ${dark ? 'text-white' : 'text-slate-800'}`}>
          키워드 검색량 조회
        </h2>
        <p className={`text-xs mb-4 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          네이버 검색광고 API 기준 · 월간 검색량 (PC + 모바일) · 최대 5개 키워드
        </p>

        {/* 키워드 입력 */}
        <div className="space-y-2.5 mb-4">
          {keywords.map((kw, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: COLORS[idx % COLORS.length] }}>{idx + 1}</div>
              <input
                type="text"
                placeholder={`키워드 ${idx + 1}`}
                value={kw}
                onChange={e => updateKw(idx, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className={`flex-1 px-3.5 py-2 rounded-lg text-sm border outline-none transition-colors
                  ${dark
                    ? 'bg-[#1D2125] border-[#A1BDD914] text-white placeholder-slate-500 focus:border-[#579DFF]'
                    : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#579DFF]'
                  }`}
              />
              {keywords.length > 1 && (
                <button onClick={() => removeKw(idx)}
                  className={`p-2 rounded-lg transition-colors ${dark ? 'text-slate-400 hover:bg-[#2C333A] hover:text-red-400' : 'text-slate-500 hover:bg-slate-100 hover:text-red-500'}`}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 버튼 */}
        <div className="flex items-center gap-2">
          {keywords.length < 5 && (
            <button onClick={addKw}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors
                ${dark ? 'bg-[#1D2125] border-[#A1BDD914] text-slate-300 hover:text-white hover:bg-[#2C333A]'
                       : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}>
              <Plus size={14} /> 추가
            </button>
          )}
          <button onClick={handleSearch} disabled={loading || activeKeywords.length === 0}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg font-medium transition-all
              ${loading || activeKeywords.length === 0
                ? 'bg-slate-300 text-white cursor-not-allowed opacity-50'
                : 'bg-[#0C66E4] text-white hover:bg-[#0A5BC2] shadow-sm'}`}>
            {loading ? <Spinner dark size={14} /> : <Search size={14} />}
            {loading ? '조회 중...' : '검색량 조회'}
          </button>
        </div>
      </div>

      {/* ══════ 에러 ══════ */}
      {error && (
        <div className={`flex items-start gap-3 rounded-xl border p-4
          ${dark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
          <AlertCircle size={16} className={`mt-0.5 flex-shrink-0 ${dark ? 'text-red-400' : 'text-red-600'}`} />
          <div>
            <p className={`text-sm font-medium ${dark ? 'text-red-400' : 'text-red-700'}`}>오류</p>
            <p className={`text-xs mt-1 ${dark ? 'text-red-300/70' : 'text-red-600'}`}>{error}</p>
          </div>
        </div>
      )}

      {/* ══════ KPI 카드 ══════ */}
      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard dark={dark} label="총 월간 검색량" value={fmt(kpi.totalAll)}
            icon={<TrendingUp size={16} className="text-white" />} color="bg-[#0C66E4]" />
          <KpiCard dark={dark} label="PC 검색량" value={fmt(kpi.totalPc)}
            icon={<Monitor size={16} className="text-white" />} color="bg-[#579DFF]" />
          <KpiCard dark={dark} label="모바일 검색량" value={fmt(kpi.totalMobile)}
            icon={<Smartphone size={16} className="text-white" />} color="bg-[#10B981]" />
          <KpiCard dark={dark} label="모바일 비중" value={`${kpi.mobileShare}%`}
            icon={<Smartphone size={16} className="text-white" />} color="bg-[#F59E0B]" />
        </div>
      )}

      {/* ══════ 검색 키워드 PC vs 모바일 바차트 ══════ */}
      {barData.length > 0 && (
        <div className={`rounded-xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-sm font-bold mb-4 ${dark ? 'text-white' : 'text-slate-800'}`}>
            키워드별 월간 검색량 (PC vs 모바일)
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(200, barData.length * 50 + 40)}>
            <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: tick, fontSize: 10 }} tickLine={false}
                tickFormatter={v => v >= 10000 ? Math.round(v / 10000) + '만' : v.toLocaleString()} />
              <YAxis type="category" dataKey="name" tick={{ fill: tick, fontSize: 11 }} width={100} tickLine={false} />
              <Tooltip content={<ChartTooltip dark={dark} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: tick }} />
              <Bar dataKey="PC" fill={BAR_COLORS.pc} radius={[0, 4, 4, 0]} barSize={16} />
              <Bar dataKey="모바일" fill={BAR_COLORS.mobile} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ══════ 검색 키워드 상세 테이블 ══════ */}
      {searched.length > 0 && (
        <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="p-4 pb-0">
            <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>검색 키워드 상세</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs mt-3">
              <thead>
                <tr className={dark ? 'bg-[#1D2125] text-slate-400' : 'bg-slate-50 text-slate-500'}>
                  <th className="text-left px-4 py-2.5 font-semibold">키워드</th>
                  <th className="text-right px-4 py-2.5 font-semibold">PC</th>
                  <th className="text-right px-4 py-2.5 font-semibold">모바일</th>
                  <th className="text-right px-4 py-2.5 font-semibold">합계</th>
                  <th className="text-center px-4 py-2.5 font-semibold">경쟁강도</th>
                </tr>
              </thead>
              <tbody>
                {searched.map((r, i) => (
                  <tr key={i} className={`border-t ${dark ? 'border-[#A1BDD914] hover:bg-[#1D2125]/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <td className={`px-4 py-2.5 font-medium ${dark ? 'text-white' : 'text-slate-800'}`}>{r.keyword}</td>
                    <td className={`text-right px-4 py-2.5 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{fmt(r.pcStr)}</td>
                    <td className={`text-right px-4 py-2.5 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{fmt(r.mobileStr)}</td>
                    <td className={`text-right px-4 py-2.5 font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{fmt(r.total)}</td>
                    <td className="text-center px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                        ${r.compIdx === '높음' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                          : r.compIdx === '중간' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                        {r.compIdx}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════ 관련 키워드 TOP 15 차트 ══════ */}
      {relatedChartData.length > 0 && (
        <div className={`rounded-xl border p-5 ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <h3 className={`text-sm font-bold mb-1 ${dark ? 'text-white' : 'text-slate-800'}`}>
            관련 키워드 TOP 15
          </h3>
          <p className={`text-[11px] mb-4 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            입력 키워드와 연관된 키워드의 월간 검색량
          </p>
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={relatedChartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: tick, fontSize: 10 }} tickLine={false}
                tickFormatter={v => v >= 10000 ? Math.round(v / 10000) + '만' : v.toLocaleString()} />
              <YAxis type="category" dataKey="name" tick={{ fill: tick, fontSize: 11 }} width={120} tickLine={false} />
              <Tooltip content={<ChartTooltip dark={dark} />} />
              <Bar dataKey="검색량" radius={[0, 4, 4, 0]} barSize={14}>
                {relatedChartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={1 - i * 0.04} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ══════ 관련 키워드 전체 테이블 ══════ */}
      {related.length > 0 && (
        <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="p-4 pb-0">
            <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>관련 키워드 ({related.length}개)</h3>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-xs mt-3">
              <thead className="sticky top-0 z-10">
                <tr className={dark ? 'bg-[#1D2125] text-slate-400' : 'bg-slate-50 text-slate-500'}>
                  <th className="text-left px-4 py-2.5 font-semibold">#</th>
                  <th className="text-left px-4 py-2.5 font-semibold">키워드</th>
                  <th className="text-right px-4 py-2.5 font-semibold">PC</th>
                  <th className="text-right px-4 py-2.5 font-semibold">모바일</th>
                  <th className="text-right px-4 py-2.5 font-semibold">합계</th>
                  <th className="text-center px-4 py-2.5 font-semibold">경쟁강도</th>
                </tr>
              </thead>
              <tbody>
                {related.map((r, i) => (
                  <tr key={i} className={`border-t ${dark ? 'border-[#A1BDD914] hover:bg-[#1D2125]/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <td className={`px-4 py-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{i + 1}</td>
                    <td className={`px-4 py-2 font-medium ${dark ? 'text-white' : 'text-slate-800'}`}>{r.keyword}</td>
                    <td className={`text-right px-4 py-2 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{fmt(r.pcStr)}</td>
                    <td className={`text-right px-4 py-2 ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{fmt(r.mobileStr)}</td>
                    <td className={`text-right px-4 py-2 font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{fmt(r.total)}</td>
                    <td className="text-center px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold
                        ${r.compIdx === '높음' ? (dark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')
                          : r.compIdx === '중간' ? (dark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
                          : (dark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')}`}>
                        {r.compIdx}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════ 빈 상태 ══════ */}
      {!loading && !results && !error && (
        <div className={`flex flex-col items-center justify-center rounded-xl border p-16
          ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200'}`}>
          <Search size={32} className={dark ? 'text-slate-600' : 'text-slate-300'} />
          <p className={`text-sm mt-3 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            키워드를 입력하고 검색량을 조회하세요
          </p>
          <p className={`text-[11px] mt-1 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
            네이버 검색광고 키워드 도구 기준 월간 검색량
          </p>
        </div>
      )}
    </div>
  )
}
