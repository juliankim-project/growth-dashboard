import { useState, useEffect, useMemo } from 'react'
import { fetchProductData } from './fetchData'
import FilterBar, { applyFilters } from './FilterBar'
import { RefreshCw, TrendingUp, Clock, AlertTriangle, DollarSign, ArrowRight, Users } from 'lucide-react'

const fmtNum = v => Math.round(v).toLocaleString()
const fmtPct = v => v.toFixed(1) + '%'
const fmtKRW = v => {
  if (v >= 100000000) return (v / 100000000).toFixed(1) + '억'
  if (v >= 10000) return Math.round(v / 10000).toLocaleString() + '만'
  return Math.round(v).toLocaleString() + '원'
}

const SEGMENTS = [
  { id: 'vip', label: 'VIP', min: 10, color: 'text-amber-400', bg: 'bg-amber-500/10', bar: 'bg-amber-500', border: 'border-amber-500/20', glow: 'shadow-amber-500/5' },
  { id: 'loyal', label: '충성', min: 5, color: 'text-violet-400', bg: 'bg-violet-500/10', bar: 'bg-violet-500', border: 'border-violet-500/20', glow: 'shadow-violet-500/5' },
  { id: 'regular', label: '일반', min: 2, color: 'text-blue-400', bg: 'bg-blue-500/10', bar: 'bg-blue-500', border: 'border-blue-500/20', glow: 'shadow-blue-500/5' },
  { id: 'new', label: '신규', min: 1, color: 'text-emerald-400', bg: 'bg-emerald-500/10', bar: 'bg-emerald-500', border: 'border-emerald-500/20', glow: 'shadow-emerald-500/5' },
]

function getSegment(count) {
  for (const s of SEGMENTS) if (count >= s.min) return s
  return SEGMENTS[SEGMENTS.length - 1]
}

/* 경과일 색상 */
function daysColor(days) {
  if (days > 180) return 'bg-red-500/20 text-red-400 border border-red-500/20'
  if (days > 120) return 'bg-orange-500/20 text-orange-400 border border-orange-500/20'
  if (days > 90) return 'bg-amber-500/20 text-amber-400 border border-amber-500/20'
  return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
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
        if (!map[gid].lastDate || r.reservation_date > map[gid].lastDate) map[gid].lastDate = r.reservation_date
      }
    })
    return map
  }, [filtered])

  const segmentLtv = useMemo(() => {
    const result = SEGMENTS.map(s => ({ ...s, users: 0, totalRev: 0, totalCount: 0 }))
    for (const g of Object.values(guestMap)) {
      const seg = getSegment(g.count)
      const entry = result.find(r => r.id === seg.id)
      if (entry) { entry.users += 1; entry.totalRev += g.revenue; entry.totalCount += g.count }
    }
    return result
  }, [guestMap])

  const purchaseCycle = useMemo(() => {
    const intervals = [], first2second = [], second2third = []
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
    const buckets = [
      { label: '1-7일', min: 1, max: 7, count: 0 },
      { label: '8-14일', min: 8, max: 14, count: 0 },
      { label: '15-30일', min: 15, max: 30, count: 0 },
      { label: '31-60일', min: 31, max: 60, count: 0 },
      { label: '61-90일', min: 61, max: 90, count: 0 },
      { label: '91일+', min: 91, max: 999, count: 0 },
    ]
    intervals.forEach(d => { const b = buckets.find(b => d >= b.min && d <= b.max); if (b) b.count += 1 })
    return { avg, median, avg12, avg23, buckets, totalIntervals: intervals.length }
  }, [guestMap])

  const conversionRates = useMemo(() => {
    const total = Object.keys(guestMap).length
    const buy2 = Object.values(guestMap).filter(g => g.count >= 2).length
    const buy3 = Object.values(guestMap).filter(g => g.count >= 3).length
    return { rate12: total > 0 ? buy2 / total * 100 : 0, rate23: buy2 > 0 ? buy3 / buy2 * 100 : 0, total, buy2, buy3 }
  }, [guestMap])

  const churnRisk = useMemo(() => {
    const today = new Date()
    const riskers = []
    for (const [gid, g] of Object.entries(guestMap)) {
      if (!g.lastDate || g.count < 2) continue
      const daysSince = (today - new Date(g.lastDate)) / 86400000
      if (daysSince >= churnDays) riskers.push({ guestId: gid, ...g, daysSince: Math.round(daysSince) })
    }
    return riskers.sort((a, b) => b.revenue - a.revenue).slice(0, 20)
  }, [guestMap, churnDays])

  const churnRevenue = useMemo(() => churnRisk.reduce((s, r) => s + r.revenue, 0), [churnRisk])

  const t = dark
    ? { bg: 'bg-[#1D2125]', card: 'bg-[#22272B]', card2: 'bg-[#2C333A]', border: 'border-[#A6C5E229]', text: 'text-white', sub: 'text-slate-400', muted: 'text-slate-500' }
    : { bg: 'bg-slate-50', card: 'bg-white', card2: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', sub: 'text-slate-600', muted: 'text-slate-400' }

  if (loading) return <div className={`flex items-center justify-center h-96 ${t.text}`}><RefreshCw size={20} className="animate-spin mr-2" /> 데이터 로딩 중...</div>
  if (error) return <div className="text-red-500 p-6">에러: {error}</div>

  return (
    <div className={`min-h-screen ${t.bg}`}>
      {/* ── Sticky 헤더 ── */}
      <div className={`sticky top-0 z-20 backdrop-blur-md border-b ${t.border} ${dark ? 'bg-[#1D2125]/90' : 'bg-slate-50/90'}`}>
        <div className="px-5 pt-4 pb-1">
          <h1 className={`text-lg font-bold tracking-tight ${t.text}`}>LTV · 구매주기 분석</h1>
          <p className={`text-xs mt-0.5 ${t.muted}`}>세그먼트별 고객생애가치 · 구매 전환 · 이탈 위험</p>
        </div>
        <div className="px-5 pb-3">
          <FilterBar dark={dark} data={data}
            selectedAreas={selectedAreas} setSelectedAreas={setSelectedAreas}
            selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch}
            selectedChannel={selectedChannel} setSelectedChannel={setSelectedChannel}
            showChannel totalCount={filtered.length} />
        </div>
      </div>

      <div className="px-5 pt-4 pb-8 space-y-5">
        {/* ── 세그먼트별 LTV 카드 ── */}
        <div className="grid grid-cols-4 gap-3">
          {segmentLtv.map(seg => {
            const avgLtv = seg.users > 0 ? seg.totalRev / seg.users : 0
            const avgFreq = seg.users > 0 ? seg.totalCount / seg.users : 0
            const totalUsers = segmentLtv.reduce((s, x) => s + x.users, 0)
            const pct = totalUsers > 0 ? seg.users / totalUsers * 100 : 0
            return (
              <div key={seg.id} className={`rounded-xl p-4 border ${t.card} ${t.border} shadow-sm ${seg.glow} relative overflow-hidden`}>
                {/* 세그먼트 비율 배경 바 */}
                <div className={`absolute bottom-0 left-0 h-1 ${seg.bar} opacity-40`} style={{ width: `${pct}%` }} />
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${seg.bg}`}>
                      <DollarSign size={14} className={seg.color} />
                    </div>
                    <div>
                      <span className={`text-xs font-bold ${seg.color}`}>{seg.label}</span>
                      <div className={`text-[10px] ${t.muted}`}>{fmtNum(seg.users)}명 · {fmtPct(pct)}</div>
                    </div>
                  </div>
                </div>
                <div className={`text-xl font-bold tabular-nums ${t.text}`}>{fmtKRW(avgLtv)}</div>
                <div className={`text-xs mt-1 ${t.muted}`}>평균 {avgFreq.toFixed(1)}회 구매</div>
              </div>
            )
          })}
        </div>

        {/* ── 구매 전환 퍼널 (풀폭) ── */}
        <div className={`rounded-xl border p-5 ${t.card} ${t.border} shadow-sm`}>
          <h2 className={`text-sm font-bold mb-4 ${t.text}`}>구매 전환 퍼널</h2>
          <div className="flex items-center gap-3">
            {/* 1회 구매 */}
            <div className="flex-1">
              <div className={`rounded-xl p-4 ${dark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                <div className={`text-xs ${t.muted} mb-1`}>1회 구매</div>
                <div className={`text-2xl font-bold tabular-nums text-blue-400`}>{fmtNum(conversionRates.total)}<span className={`text-sm font-normal ml-1`}>명</span></div>
              </div>
            </div>
            {/* 화살표 + 전환율 */}
            <div className="flex flex-col items-center gap-1 w-20">
              <ArrowRight size={18} className="text-emerald-400" />
              <span className={`text-sm font-bold tabular-nums ${conversionRates.rate12 > 20 ? 'text-emerald-400' : t.text}`}>{fmtPct(conversionRates.rate12)}</span>
              <span className={`text-[10px] ${t.muted}`}>{Math.round(purchaseCycle.avg12)}일</span>
            </div>
            {/* 2회 구매 */}
            <div className="flex-1">
              <div className={`rounded-xl p-4 ${dark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                <div className={`text-xs ${t.muted} mb-1`}>2회 구매</div>
                <div className={`text-2xl font-bold tabular-nums text-emerald-400`}>{fmtNum(conversionRates.buy2)}<span className={`text-sm font-normal ml-1`}>명</span></div>
              </div>
            </div>
            {/* 화살표 + 전환율 */}
            <div className="flex flex-col items-center gap-1 w-20">
              <ArrowRight size={18} className="text-violet-400" />
              <span className={`text-sm font-bold tabular-nums ${conversionRates.rate23 > 30 ? 'text-violet-400' : t.text}`}>{fmtPct(conversionRates.rate23)}</span>
              <span className={`text-[10px] ${t.muted}`}>{Math.round(purchaseCycle.avg23)}일</span>
            </div>
            {/* 3회+ 구매 */}
            <div className="flex-1">
              <div className={`rounded-xl p-4 ${dark ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-200'}`}>
                <div className={`text-xs ${t.muted} mb-1`}>3회+ 구매</div>
                <div className={`text-2xl font-bold tabular-nums text-violet-400`}>{fmtNum(conversionRates.buy3)}<span className={`text-sm font-normal ml-1`}>명</span></div>
              </div>
            </div>
          </div>
          {/* 세그먼트 분포 바 */}
          <div className="mt-4 pt-3 border-t border-dashed" style={{ borderColor: dark ? '#A6C5E229' : '#e2e8f0' }}>
            <div className={`text-xs font-medium mb-2 ${t.sub}`}>세그먼트 분포</div>
            <div className="flex h-4 rounded-full overflow-hidden">
              {segmentLtv.filter(s => s.users > 0).map(seg => {
                const total = segmentLtv.reduce((s, x) => s + x.users, 0)
                const pct = total > 0 ? seg.users / total * 100 : 0
                return <div key={seg.id} className={`${seg.bar} transition-all`} style={{ width: `${pct}%` }} />
              })}
            </div>
            <div className="flex gap-4 mt-2">
              {segmentLtv.filter(s => s.users > 0).map(seg => {
                const total = segmentLtv.reduce((s, x) => s + x.users, 0)
                const pct = total > 0 ? seg.users / total * 100 : 0
                return (
                  <div key={seg.id} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${seg.bar}`} />
                    <span className={`text-xs ${t.sub}`}>{seg.label}</span>
                    <span className={`text-xs font-bold tabular-nums ${seg.color}`}>{fmtPct(pct)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── 구매주기 분포 ── */}
        <div className={`rounded-xl border p-5 ${t.card} ${t.border} shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-bold ${t.text}`}>구매주기 분포</h2>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${dark ? 'bg-[#2C333A]' : 'bg-slate-100'}`}>
                <Clock size={12} className="text-blue-400" />
                <span className={`text-xs ${t.muted}`}>평균</span>
                <span className={`text-sm font-bold tabular-nums ${t.text}`}>{Math.round(purchaseCycle.avg)}일</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${dark ? 'bg-[#2C333A]' : 'bg-slate-100'}`}>
                <span className={`text-xs ${t.muted}`}>중앙값</span>
                <span className={`text-sm font-bold tabular-nums ${t.text}`}>{Math.round(purchaseCycle.median)}일</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {purchaseCycle.buckets.map((b, i) => {
              const maxCount = Math.max(...purchaseCycle.buckets.map(x => x.count))
              const pct = purchaseCycle.totalIntervals > 0 ? b.count / purchaseCycle.totalIntervals * 100 : 0
              const barW = maxCount > 0 ? b.count / maxCount * 100 : 0
              return (
                <div key={i} className={`flex items-center gap-3 group rounded-lg px-2 py-1 -mx-2 ${dark ? 'hover:bg-[#2C333A]/50' : 'hover:bg-slate-50'} transition-colors`}>
                  <span className={`text-xs font-semibold w-14 ${t.text}`}>{b.label}</span>
                  <div className={`flex-1 h-6 rounded-md overflow-hidden ${dark ? 'bg-slate-700/30' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-md bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
                      style={{ width: `${barW}%` }} />
                  </div>
                  <span className={`text-sm font-bold w-12 text-right tabular-nums ${t.text}`}>{fmtNum(b.count)}</span>
                  <span className={`text-xs w-12 text-right tabular-nums ${pct > 25 ? 'text-blue-400 font-bold' : t.muted}`}>{fmtPct(pct)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 이탈 위험 유저 ── */}
        <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border} shadow-sm`}>
          <div className={`px-5 py-3.5 border-b ${t.border} flex items-center justify-between`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10">
                <AlertTriangle size={15} className="text-red-400" />
              </div>
              <div>
                <h2 className={`text-sm font-bold ${t.text}`}>이탈 위험 유저</h2>
                <div className={`text-[11px] ${t.muted}`}>
                  {fmtNum(churnRisk.length)}명 · 위험 매출 {fmtKRW(churnRevenue)}
                </div>
              </div>
            </div>
            <div className={`flex items-center rounded-lg p-0.5 ${dark ? 'bg-[#2C333A]' : 'bg-slate-100'}`}>
              {[60, 90, 120, 180].map(d => (
                <button key={d} onClick={() => setChurnDays(d)}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all
                    ${churnDays === d
                      ? `${dark ? 'bg-[#22272B] text-red-400 shadow-sm' : 'bg-white text-red-500 shadow-sm'}`
                      : `${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}`}>
                  {d}일+
                </button>
              ))}
            </div>
          </div>
          {churnRisk.length > 0 ? (
            <div className="overflow-x-auto" style={{ maxHeight: 360 }}>
              <table className="w-full text-xs tabular-nums">
                <thead className={`sticky top-0 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'}`}>
                  <tr>
                    {['Guest ID', '세그먼트', '구매횟수', '총 매출', '마지막 구매', '경과'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-left font-semibold ${t.sub}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {churnRisk.map(r => {
                    const seg = getSegment(r.count)
                    return (
                      <tr key={r.guestId} className={`border-t ${t.border} ${dark ? 'hover:bg-[#2C333A]/50' : 'hover:bg-slate-50'} transition-colors`}>
                        <td className={`px-4 py-2.5 font-mono font-medium ${t.text}`}>{r.guestId}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${seg.bg} ${seg.color} border ${seg.border}`}>{seg.label}</span>
                        </td>
                        <td className={`px-4 py-2.5 font-medium ${t.text}`}>{r.count}회</td>
                        <td className={`px-4 py-2.5 font-bold ${t.text}`}>{fmtKRW(r.revenue)}</td>
                        <td className={`px-4 py-2.5 font-mono ${t.muted}`}>{r.lastDate}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold tabular-nums ${daysColor(r.daysSince)}`}>
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
            <div className={`p-8 text-center ${t.muted}`}>
              <Users size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">{churnDays}일 이상 미구매 재구매 고객이 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
