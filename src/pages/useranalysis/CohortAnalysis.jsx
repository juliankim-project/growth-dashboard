import { useState, useEffect, useMemo } from 'react'
import { fetchProductData } from './fetchData'
import FilterBar, { applyFilters } from './FilterBar'
import { RefreshCw, Activity, TrendingUp, Users, BarChart3 } from 'lucide-react'

const fmtNum = v => Math.round(v).toLocaleString()
const fmtPct = v => v.toFixed(1) + '%'

/* ── 연속 그래디언트 색상 (opacity 기반 단일 hue) ── */
function retentionStyle(pct, isM0, dark) {
  if (isM0) return { backgroundColor: 'rgb(37,99,235)', color: '#fff' }
  const v = Math.min(pct / 100, 1)
  if (v <= 0) return {}
  return {
    backgroundColor: `rgba(52,211,153,${Math.max(0.08, v * 0.9)})`,
    color: v > 0.25 ? '#fff' : dark ? 'rgb(167,243,208)' : 'rgb(6,95,70)',
  }
}

export default function CohortAnalysis({ dark, dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAreas, setSelectedAreas] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [mode, setMode] = useState('retention')

  useEffect(() => {
    setLoading(true)
    fetchProductData(dateRange)
      .then(rows => { setData(rows); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [dateRange?.start, dateRange?.end])

  const filtered = useMemo(() =>
    applyFilters(data, { selectedAreas, selectedBranch, selectedChannel })
  , [data, selectedAreas, selectedBranch, selectedChannel])

  const cohortData = useMemo(() => {
    const guestFirst = {}
    const guestMonths = {}
    filtered.forEach(r => {
      const gid = r.guest_id
      if (!gid || !r.reservation_date) return
      const month = r.reservation_date.slice(0, 7)
      if (!guestFirst[gid] || month < guestFirst[gid]) guestFirst[gid] = month
      if (!guestMonths[gid]) guestMonths[gid] = {}
      if (!guestMonths[gid][month]) guestMonths[gid][month] = { count: 0, revenue: 0 }
      guestMonths[gid][month].count += 1
      guestMonths[gid][month].revenue += Number(r.payment_amount) || 0
    })
    const cohorts = {}
    for (const [gid, firstMonth] of Object.entries(guestFirst)) {
      if (!cohorts[firstMonth]) cohorts[firstMonth] = { size: 0, months: {} }
      cohorts[firstMonth].size += 1
      for (const [actMonth, actData] of Object.entries(guestMonths[gid])) {
        const monthDiff = monthsBetween(firstMonth, actMonth)
        if (monthDiff < 0) continue
        if (!cohorts[firstMonth].months[monthDiff]) cohorts[firstMonth].months[monthDiff] = { users: 0, revenue: 0 }
        cohorts[firstMonth].months[monthDiff].users += 1
        cohorts[firstMonth].months[monthDiff].revenue += actData.revenue
      }
    }
    const cohortMonths = Object.keys(cohorts).sort()
    const maxOffset = Math.min(
      Math.max(...cohortMonths.map(cm => {
        const offsets = Object.keys(cohorts[cm].months).map(Number)
        return offsets.length > 0 ? Math.max(...offsets) : 0
      }), 0),
      11
    )
    // 평균 리텐션 계산
    const avgRetention = {}
    for (let i = 0; i <= maxOffset; i++) {
      let totalUsers = 0, totalSize = 0
      cohortMonths.forEach(cm => {
        const cell = cohorts[cm].months[i]
        if (cell) { totalUsers += cell.users; totalSize += cohorts[cm].size }
      })
      avgRetention[i] = totalSize > 0 ? totalUsers / totalSize * 100 : 0
    }
    return { cohorts, cohortMonths, maxOffset, avgRetention }
  }, [filtered])

  const kpis = useMemo(() => {
    const guests = new Set(filtered.map(r => r.guest_id).filter(Boolean))
    const guestCounts = {}
    filtered.forEach(r => { if (r.guest_id) guestCounts[r.guest_id] = (guestCounts[r.guest_id] || 0) + 1 })
    const repeatGuests = Object.values(guestCounts).filter(c => c > 1).length
    const retentionRate = guests.size > 0 ? repeatGuests / guests.size * 100 : 0
    const totalRevenue = filtered.reduce((s, r) => s + (Number(r.payment_amount) || 0), 0)
    return { totalGuests: guests.size, repeatGuests, retentionRate, totalRevenue, cohortCount: cohortData.cohortMonths.length }
  }, [filtered, cohortData])

  const t = dark
    ? { bg: 'bg-[#1D2125]', card: 'bg-[#22272B]', card2: 'bg-[#2C333A]', border: 'border-[#A6C5E229]', text: 'text-white', sub: 'text-slate-400', muted: 'text-slate-500' }
    : { bg: 'bg-slate-50', card: 'bg-white', card2: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', sub: 'text-slate-600', muted: 'text-slate-400' }

  if (loading) return <div className={`flex items-center justify-center h-96 ${t.text}`}><RefreshCw size={20} className="animate-spin mr-2" /> 데이터 로딩 중...</div>
  if (error) return <div className="text-red-500 p-6">에러: {error}</div>

  const showPct = mode === 'retention'

  return (
    <div className={`min-h-screen ${t.bg}`}>
      {/* ── Sticky 헤더 ── */}
      <div className={`sticky top-0 z-20 backdrop-blur-md border-b ${t.border} ${dark ? 'bg-[#1D2125]/90' : 'bg-slate-50/90'}`}>
        <div className="px-5 pt-4 pb-1">
          <h1 className={`text-lg font-bold tracking-tight ${t.text}`}>코호트 분석</h1>
          <p className={`text-xs mt-0.5 ${t.muted}`}>첫 구매 월 기준 리텐션 · 매출 성장 추적</p>
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
        {/* ── KPI 카드 ── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: '전체 유저', value: fmtNum(kpis.totalGuests), sub: '명', icon: <Users size={16}/>, accent: 'text-blue-400', bg: 'bg-blue-500/10', glow: 'shadow-blue-500/5' },
            { label: '재구매 유저', value: fmtNum(kpis.repeatGuests), sub: '명', icon: <Activity size={16}/>, accent: 'text-emerald-400', bg: 'bg-emerald-500/10', glow: 'shadow-emerald-500/5' },
            { label: '재구매율', value: fmtPct(kpis.retentionRate), sub: '', icon: <TrendingUp size={16}/>, accent: 'text-violet-400', bg: 'bg-violet-500/10', glow: 'shadow-violet-500/5' },
            { label: '코호트', value: fmtNum(kpis.cohortCount), sub: '개월', icon: <BarChart3 size={16}/>, accent: 'text-amber-400', bg: 'bg-amber-500/10', glow: 'shadow-amber-500/5' },
          ].map((kpi, i) => (
            <div key={i} className={`rounded-xl p-4 border ${t.card} ${t.border} shadow-sm ${kpi.glow}`}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>{kpi.icon}</div>
                <span className={`text-xs font-medium ${t.sub}`}>{kpi.label}</span>
              </div>
              <div className={`text-2xl font-bold tabular-nums ${t.text}`}>
                {kpi.value}
                {kpi.sub && <span className={`text-sm font-normal ml-1 ${t.muted}`}>{kpi.sub}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* ── 코호트 리텐션 테이블 ── */}
        <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border} shadow-sm`}>
          <div className={`px-5 py-3.5 border-b ${t.border} flex items-center justify-between`}>
            <div>
              <h2 className={`text-sm font-bold ${t.text}`}>코호트 리텐션 테이블</h2>
              <p className={`text-[11px] mt-0.5 ${t.muted}`}>첫 구매 월 기준 · M0 = 첫 구매 월</p>
            </div>
            <div className={`flex items-center rounded-lg p-0.5 ${dark ? 'bg-[#2C333A]' : 'bg-slate-100'}`}>
              {['retention', 'revenue'].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`text-xs px-3.5 py-1.5 rounded-md font-medium transition-all
                    ${mode === m
                      ? `${dark ? 'bg-[#22272B] text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm'}`
                      : `${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}`}>
                  {m === 'retention' ? '리텐션' : '인당매출'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                  <th className={`px-4 py-2.5 text-left font-semibold ${t.sub} sticky left-0 z-10 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'} min-w-[100px]`}>코호트</th>
                  <th className={`px-3 py-2.5 text-center font-semibold ${t.sub}`}>유저</th>
                  {Array.from({ length: cohortData.maxOffset + 1 }, (_, i) => (
                    <th key={i} className={`px-2 py-2.5 text-center font-semibold ${i === 0 ? 'text-blue-400' : t.sub} min-w-[60px]`}>
                      {i === 0 ? 'M0' : `+${i}M`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortData.cohortMonths.slice(-12).map(cm => {
                  const cohort = cohortData.cohorts[cm]
                  return (
                    <tr key={cm} className={`border-t ${t.border} ${dark ? 'hover:bg-[#2C333A]/50' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className={`px-4 py-2 font-mono font-medium whitespace-nowrap sticky left-0 z-10 ${dark ? 'bg-[#22272B]' : 'bg-white'} ${t.text}`}>
                        {cm}
                        <span className={`ml-1.5 text-[10px] font-normal ${t.muted}`}>{fmtNum(cohort.size)}명</span>
                      </td>
                      <td className={`px-3 py-2 text-center font-bold ${t.sub}`}>{fmtNum(cohort.size)}</td>
                      {Array.from({ length: cohortData.maxOffset + 1 }, (_, i) => {
                        const cell = cohort.months[i]
                        if (!cell) return <td key={i} className={`px-2 py-2 ${dark ? 'bg-[#1D2125]/30' : ''}`} />
                        if (showPct) {
                          const pct = cohort.size > 0 ? cell.users / cohort.size * 100 : 0
                          return (
                            <td key={i} className="px-1 py-1">
                              <div className="rounded-md px-1.5 py-1.5 text-center text-xs font-medium" style={retentionStyle(pct, i === 0, dark)}>
                                {fmtPct(pct)}
                              </div>
                            </td>
                          )
                        } else {
                          const perUser = cell.users > 0 ? cell.revenue / cell.users : 0
                          return (
                            <td key={i} className={`px-2 py-2 text-center text-xs ${t.text}`}>
                              {perUser >= 1000000 ? `${(perUser / 10000).toFixed(0)}만` : `${Math.round(perUser / 1000)}천`}
                            </td>
                          )
                        }
                      })}
                    </tr>
                  )
                })}
                {/* 평균 행 */}
                {showPct && (
                  <tr className={`border-t-2 ${t.border} ${dark ? 'bg-[#2C333A]/50' : 'bg-slate-50'}`}>
                    <td className={`px-4 py-2 font-bold sticky left-0 z-10 ${dark ? 'bg-[#2C333A]/50' : 'bg-slate-50'} ${t.text}`}>평균</td>
                    <td className={`px-3 py-2 text-center font-bold ${t.sub}`}>—</td>
                    {Array.from({ length: cohortData.maxOffset + 1 }, (_, i) => (
                      <td key={i} className="px-1 py-1">
                        <div className={`rounded-md px-1.5 py-1.5 text-center text-xs font-bold ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}
                          style={{ backgroundColor: `rgba(52,211,153,${Math.max(0.05, (cohortData.avgRetention[i] || 0) / 100 * 0.4)})` }}>
                          {fmtPct(cohortData.avgRetention[i] || 0)}
                        </div>
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* 색상 범례 */}
          {showPct && (
            <div className={`px-5 py-2.5 border-t ${t.border} flex items-center gap-3`}>
              <span className={`text-[11px] ${t.muted}`}>범례:</span>
              {[5, 15, 30, 50].map(v => (
                <div key={v} className="flex items-center gap-1">
                  <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: `rgba(52,211,153,${v / 100 * 0.9})` }} />
                  <span className={`text-[10px] ${t.muted}`}>{v}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── +1M 재구매율 추이 ── */}
        <div className={`rounded-xl border p-5 ${t.card} ${t.border} shadow-sm`}>
          <h2 className={`text-sm font-bold mb-4 ${t.text}`}>코호트별 +1M 재구매율 추이</h2>
          <div className="space-y-2.5">
            {cohortData.cohortMonths.slice(-12).map(cm => {
              const cohort = cohortData.cohorts[cm]
              const m1 = cohort.months[1]
              const pct = m1 && cohort.size > 0 ? m1.users / cohort.size * 100 : 0
              const maxPct = 30
              const barW = Math.min(pct / maxPct * 100, 100)
              return (
                <div key={cm} className={`flex items-center gap-3 group rounded-lg px-2 py-1 -mx-2 ${dark ? 'hover:bg-[#2C333A]/50' : 'hover:bg-slate-50'} transition-colors`}>
                  <span className={`text-xs font-mono w-16 tabular-nums ${t.text}`}>{cm}</span>
                  <div className={`flex-1 h-6 rounded-md overflow-hidden ${dark ? 'bg-slate-700/30' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-md bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                      style={{ width: `${barW}%` }} />
                  </div>
                  <span className={`text-sm font-bold w-16 text-right tabular-nums ${pct > 10 ? 'text-emerald-400' : t.muted}`}>{fmtPct(pct)}</span>
                  <span className={`text-xs w-14 text-right tabular-nums ${t.muted}`}>{fmtNum(cohort.size)}명</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}
