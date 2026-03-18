import { useState, useEffect, useMemo } from 'react'
import { fetchProductData } from './fetchData'
import FilterBar, { applyFilters } from './FilterBar'
import { RefreshCw, TrendingUp, Clock, AlertTriangle, DollarSign } from 'lucide-react'

const fmtNum = v => Math.round(v).toLocaleString()
const fmtPct = v => v.toFixed(1) + '%'
const fmtKRW = v => {
  if (v >= 100000000) return (v / 100000000).toFixed(1) + '억'
  if (v >= 10000) return Math.round(v / 10000).toLocaleString() + '만'
  return Math.round(v).toLocaleString() + '원'
}

/** 세그먼트 정의 */
const SEGMENTS = [
  { id: 'vip', label: 'VIP', min: 10, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { id: 'loyal', label: '충성', min: 5, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  { id: 'regular', label: '일반', min: 2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { id: 'new', label: '신규', min: 1, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
]

function getSegment(count) {
  for (const s of SEGMENTS) if (count >= s.min) return s
  return SEGMENTS[SEGMENTS.length - 1]
}

export default function LtvAnalysis({ dark, dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAreas, setSelectedAreas] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [churnDays, setChurnDays] = useState(90)

  useEffect(() => {
    setLoading(true)
    fetchProductData(dateRange)
      .then(rows => { setData(rows); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [dateRange?.start, dateRange?.end])

  const filtered = useMemo(() =>
    applyFilters(data, { selectedAreas, selectedBranch, selectedChannel })
  , [data, selectedAreas, selectedBranch, selectedChannel])

  // 유저별 집계
  const guestMap = useMemo(() => {
    const map = {}
    filtered.forEach(r => {
      const gid = r.guest_id
      if (!gid) return
      if (!map[gid]) map[gid] = { count: 0, revenue: 0, dates: [], lastDate: null }
      map[gid].count += 1
      map[gid].revenue += Number(r.payment_amount) || 0
      if (r.reservation_date) {
        map[gid].dates.push(r.reservation_date)
        if (!map[gid].lastDate || r.reservation_date > map[gid].lastDate) {
          map[gid].lastDate = r.reservation_date
        }
      }
    })
    return map
  }, [filtered])

  // 세그먼트별 LTV
  const segmentLtv = useMemo(() => {
    const result = SEGMENTS.map(s => ({ ...s, users: 0, totalRev: 0, totalCount: 0 }))
    for (const g of Object.values(guestMap)) {
      const seg = getSegment(g.count)
      const entry = result.find(r => r.id === seg.id)
      if (entry) {
        entry.users += 1
        entry.totalRev += g.revenue
        entry.totalCount += g.count
      }
    }
    return result
  }, [guestMap])

  // 구매주기 분석
  const purchaseCycle = useMemo(() => {
    const intervals = []
    const first2second = []
    const second2third = []

    for (const g of Object.values(guestMap)) {
      const sorted = [...new Set(g.dates)].sort()
      if (sorted.length < 2) continue
      for (let i = 1; i < sorted.length; i++) {
        const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000
        if (diff > 0 && diff < 365) intervals.push(diff)
        if (i === 1) first2second.push(diff)
        if (i === 2) second2third.push(diff)
      }
    }

    const avg = intervals.length > 0 ? intervals.reduce((s, v) => s + v, 0) / intervals.length : 0
    const sorted = [...intervals].sort((a, b) => a - b)
    const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
    const avg12 = first2second.length > 0 ? first2second.reduce((s, v) => s + v, 0) / first2second.length : 0
    const avg23 = second2third.length > 0 ? second2third.reduce((s, v) => s + v, 0) / second2third.length : 0

    // 구간 분포
    const buckets = [
      { label: '1-7일', min: 1, max: 7, count: 0 },
      { label: '8-14일', min: 8, max: 14, count: 0 },
      { label: '15-30일', min: 15, max: 30, count: 0 },
      { label: '31-60일', min: 31, max: 60, count: 0 },
      { label: '61-90일', min: 61, max: 90, count: 0 },
      { label: '91일+', min: 91, max: 999, count: 0 },
    ]
    intervals.forEach(d => {
      const b = buckets.find(b => d >= b.min && d <= b.max)
      if (b) b.count += 1
    })

    return { avg, median, avg12, avg23, buckets, totalIntervals: intervals.length }
  }, [guestMap])

  // 전환율
  const conversionRates = useMemo(() => {
    const total = Object.keys(guestMap).length
    const buy2 = Object.values(guestMap).filter(g => g.count >= 2).length
    const buy3 = Object.values(guestMap).filter(g => g.count >= 3).length
    return {
      rate12: total > 0 ? buy2 / total * 100 : 0,
      rate23: buy2 > 0 ? buy3 / buy2 * 100 : 0,
    }
  }, [guestMap])

  // 이탈 위험 유저
  const churnRisk = useMemo(() => {
    const today = new Date()
    const riskers = []
    for (const [gid, g] of Object.entries(guestMap)) {
      if (!g.lastDate || g.count < 2) continue
      const daysSince = (today - new Date(g.lastDate)) / 86400000
      if (daysSince >= churnDays) {
        riskers.push({ guestId: gid, ...g, daysSince: Math.round(daysSince) })
      }
    }
    return riskers.sort((a, b) => b.revenue - a.revenue).slice(0, 20)
  }, [guestMap, churnDays])

  const t = dark
    ? { bg: 'bg-[#1D2125]', card: 'bg-[#22272B]', border: 'border-[#A1BDD914]', text: 'text-white', sub: 'text-slate-400', muted: 'text-slate-500' }
    : { bg: 'bg-slate-50', card: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', sub: 'text-slate-600', muted: 'text-slate-400' }

  if (loading) return (
    <div className={`flex items-center justify-center h-96 ${t.text}`}>
      <RefreshCw size={20} className="animate-spin mr-2" /> 데이터 로딩 중...
    </div>
  )
  if (error) return <div className="text-red-500 p-6">에러: {error}</div>

  return (
    <div className={`min-h-screen ${t.bg}`}>
      {/* Sticky 헤더 */}
      <div className={`sticky top-0 z-20 ${dark ? 'bg-[#1D2125]/95' : 'bg-slate-50/95'} backdrop-blur-sm border-b ${t.border}`}>
        <div className="px-4 pt-3 pb-1.5">
          <h1 className={`text-base font-bold ${t.text}`}>💰 LTV · 구매주기 분석</h1>
          <p className={`text-[11px] ${t.muted}`}>세그먼트별 고객생애가치 · 구매 전환 · 이탈 위험</p>
        </div>
        <div className="px-4 pb-2.5">
          <FilterBar dark={dark} data={data}
            selectedAreas={selectedAreas} setSelectedAreas={setSelectedAreas}
            selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch}
            selectedChannel={selectedChannel} setSelectedChannel={setSelectedChannel}
            showChannel totalCount={filtered.length} />
        </div>
      </div>

      <div className="px-4 pt-3 pb-6 space-y-4">
        {/* 세그먼트별 LTV 카드 */}
        <div className="grid grid-cols-4 gap-2">
          {segmentLtv.map(seg => {
            const avgLtv = seg.users > 0 ? seg.totalRev / seg.users : 0
            const avgFreq = seg.users > 0 ? seg.totalCount / seg.users : 0
            return (
              <div key={seg.id} className={`rounded-xl p-3.5 border ${t.card} ${t.border}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${seg.bg}`}>
                    <DollarSign size={11} className={seg.color} />
                  </div>
                  <span className={`text-[11px] font-semibold ${seg.color}`}>{seg.label}</span>
                  <span className={`text-[10px] ml-auto ${t.muted}`}>{fmtNum(seg.users)}명</span>
                </div>
                <div className={`text-lg font-bold ${t.text}`}>{fmtKRW(avgLtv)}</div>
                <div className={`text-[10px] ${t.muted}`}>평균 {avgFreq.toFixed(1)}회 구매</div>
              </div>
            )
          })}
        </div>

        {/* 구매주기 + 전환율 (2컬럼) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 구매주기 */}
          <div className={`rounded-xl border p-4 ${t.card} ${t.border}`}>
            <h2 className={`text-sm font-bold mb-3 ${t.text}`}>⏱️ 구매주기 분포</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className={`rounded p-2 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'}`}>
                <div className={`text-[10px] ${t.muted}`}>평균 주기</div>
                <div className={`text-lg font-bold ${t.text}`}>{Math.round(purchaseCycle.avg)}일</div>
              </div>
              <div className={`rounded p-2 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'}`}>
                <div className={`text-[10px] ${t.muted}`}>중앙값</div>
                <div className={`text-lg font-bold ${t.text}`}>{Math.round(purchaseCycle.median)}일</div>
              </div>
            </div>
            <div className="space-y-2.5">
              {purchaseCycle.buckets.map((b, i) => {
                const maxCount = Math.max(...purchaseCycle.buckets.map(x => x.count))
                const pct = purchaseCycle.totalIntervals > 0 ? b.count / purchaseCycle.totalIntervals * 100 : 0
                const barW = maxCount > 0 ? b.count / maxCount * 100 : 0
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-xs font-semibold w-14 ${t.text}`}>{b.label}</span>
                    <div className="flex-1 h-5 rounded-full overflow-hidden bg-slate-200/20">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                        style={{ width: `${barW}%` }} />
                    </div>
                    <span className={`text-[11px] font-bold w-10 text-right ${t.text}`}>{fmtNum(b.count)}</span>
                    <span className={`text-[10px] w-10 text-right ${t.muted}`}>{fmtPct(pct)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 전환율 퍼널 */}
          <div className={`rounded-xl border p-4 ${t.card} ${t.border}`}>
            <h2 className={`text-sm font-bold mb-3 ${t.text}`}>🔄 구매 전환 퍼널</h2>
            <div className="space-y-3">
              {/* 1→2 전환 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] ${t.sub}`}>1회 → 2회 전환</span>
                  <span className={`text-sm font-bold ${conversionRates.rate12 > 20 ? 'text-emerald-400' : t.text}`}>{fmtPct(conversionRates.rate12)}</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden bg-slate-200/20">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    style={{ width: `${Math.min(conversionRates.rate12, 100)}%` }} />
                </div>
                <div className={`text-[10px] mt-0.5 ${t.muted}`}>평균 {Math.round(purchaseCycle.avg12)}일 소요</div>
              </div>
              {/* 2→3 전환 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] ${t.sub}`}>2회 → 3회 전환</span>
                  <span className={`text-sm font-bold ${conversionRates.rate23 > 30 ? 'text-emerald-400' : t.text}`}>{fmtPct(conversionRates.rate23)}</span>
                </div>
                <div className="h-4 rounded-full overflow-hidden bg-slate-200/20">
                  <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                    style={{ width: `${Math.min(conversionRates.rate23, 100)}%` }} />
                </div>
                <div className={`text-[10px] mt-0.5 ${t.muted}`}>평균 {Math.round(purchaseCycle.avg23)}일 소요</div>
              </div>
            </div>

            {/* 세그먼트 비중 도넛식 바 */}
            <div className={`mt-4 pt-3 border-t ${t.border}`}>
              <div className={`text-[11px] font-semibold mb-1.5 ${t.text}`}>세그먼트 구성</div>
              <div className="flex h-3 rounded-full overflow-hidden">
                {segmentLtv.filter(s => s.users > 0).map(seg => {
                  const total = segmentLtv.reduce((s, x) => s + x.users, 0)
                  const pct = total > 0 ? seg.users / total * 100 : 0
                  const bgColor = seg.id === 'vip' ? 'bg-amber-500' : seg.id === 'loyal' ? 'bg-violet-500' : seg.id === 'regular' ? 'bg-blue-500' : 'bg-emerald-500'
                  return <div key={seg.id} className={`${bgColor} transition-all`} style={{ width: `${pct}%` }} title={`${seg.label}: ${fmtPct(pct)}`} />
                })}
              </div>
              <div className="flex gap-3 mt-1.5">
                {segmentLtv.filter(s => s.users > 0).map(seg => {
                  const total = segmentLtv.reduce((s, x) => s + x.users, 0)
                  const pct = total > 0 ? seg.users / total * 100 : 0
                  return (
                    <div key={seg.id} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${seg.id === 'vip' ? 'bg-amber-500' : seg.id === 'loyal' ? 'bg-violet-500' : seg.id === 'regular' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                      <span className={`text-[10px] ${t.muted}`}>{seg.label} {fmtPct(pct)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 이탈 위험 유저 */}
        <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
          <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-red-400" />
              <h2 className={`text-xs font-semibold ${t.text}`}>이탈 위험 유저 (재구매 고객 중)</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] ${t.muted}`}>기준:</span>
              {[60, 90, 120, 180].map(d => (
                <button key={d} onClick={() => setChurnDays(d)}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${churnDays === d ? 'bg-red-500/20 text-red-400' : t.muted}`}>
                  {d}일
                </button>
              ))}
            </div>
          </div>
          {churnRisk.length > 0 ? (
            <div className="overflow-x-auto" style={{ maxHeight: 300 }}>
              <table className="w-full text-[11px]">
                <thead className={`sticky top-0 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'}`}>
                  <tr>
                    {['Guest ID', '세그먼트', '구매횟수', '총 매출', '마지막 구매', '경과일'].map(h => (
                      <th key={h} className={`px-2 py-1.5 text-left font-semibold ${t.sub}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {churnRisk.map(r => {
                    const seg = getSegment(r.count)
                    return (
                      <tr key={r.guestId} className={`border-t ${t.border}`}>
                        <td className={`px-2 py-1.5 font-mono ${t.text}`}>{r.guestId}</td>
                        <td className="px-2 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${seg.bg} ${seg.color}`}>{seg.label}</span>
                        </td>
                        <td className={`px-2 py-1.5 ${t.text}`}>{r.count}회</td>
                        <td className={`px-2 py-1.5 font-medium ${t.text}`}>{fmtKRW(r.revenue)}</td>
                        <td className={`px-2 py-1.5 ${t.muted}`}>{r.lastDate}</td>
                        <td className="px-2 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold
                            ${r.daysSince > 180 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {r.daysSince}일
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`p-4 text-center text-xs ${t.muted}`}>
              {churnDays}일 이상 미구매 재구매 고객이 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
