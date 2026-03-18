import { useState, useEffect, useMemo } from 'react'
import { fetchProductData } from './fetchData'
import FilterBar, { applyFilters } from './FilterBar'
import { RefreshCw, Activity, TrendingUp, Users } from 'lucide-react'

const fmtNum = v => Math.round(v).toLocaleString()
const fmtPct = v => v.toFixed(1) + '%'

/**
 * 코호트 분석 — 첫 구매 월 기준 리텐션
 */
export default function CohortAnalysis({ dark, dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAreas, setSelectedAreas] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [mode, setMode] = useState('retention') // retention | revenue

  useEffect(() => {
    setLoading(true)
    fetchProductData(dateRange)
      .then(rows => { setData(rows); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [dateRange?.start, dateRange?.end])

  const filtered = useMemo(() =>
    applyFilters(data, { selectedAreas, selectedBranch, selectedChannel })
  , [data, selectedAreas, selectedBranch, selectedChannel])

  // 코호트 계산: guest_id 기준, 첫 구매 월 = 코호트
  const cohortData = useMemo(() => {
    const guestFirst = {} // guest_id → 첫 구매 YYYY-MM
    const guestMonths = {} // guest_id → Set of YYYY-MM

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

    // 코호트별 정리
    const cohorts = {} // cohortMonth → { size, months: { 0: {users,revenue}, 1: {users,revenue}, ... } }
    const allMonths = [...new Set(Object.values(guestFirst))].sort()

    for (const [gid, firstMonth] of Object.entries(guestFirst)) {
      if (!cohorts[firstMonth]) cohorts[firstMonth] = { size: 0, months: {} }
      cohorts[firstMonth].size += 1

      for (const [actMonth, actData] of Object.entries(guestMonths[gid])) {
        const monthDiff = monthsBetween(firstMonth, actMonth)
        if (monthDiff < 0) continue
        if (!cohorts[firstMonth].months[monthDiff]) {
          cohorts[firstMonth].months[monthDiff] = { users: 0, revenue: 0 }
        }
        cohorts[firstMonth].months[monthDiff].users += 1
        cohorts[firstMonth].months[monthDiff].revenue += actData.revenue
      }
    }

    const cohortMonths = Object.keys(cohorts).sort()
    const maxOffset = Math.min(
      Math.max(...cohortMonths.map(cm => {
        const offsets = Object.keys(cohorts[cm].months).map(Number)
        return offsets.length > 0 ? Math.max(...offsets) : 0
      })),
      11 // 최대 12개월
    )

    return { cohorts, cohortMonths, maxOffset }
  }, [filtered])

  // KPI
  const kpis = useMemo(() => {
    const guests = new Set(filtered.map(r => r.guest_id).filter(Boolean))
    const repeatGuests = new Set()
    const guestCounts = {}
    filtered.forEach(r => {
      if (!r.guest_id) return
      guestCounts[r.guest_id] = (guestCounts[r.guest_id] || 0) + 1
    })
    for (const [gid, cnt] of Object.entries(guestCounts)) {
      if (cnt > 1) repeatGuests.add(gid)
    }
    const retentionRate = guests.size > 0 ? repeatGuests.size / guests.size * 100 : 0
    return {
      totalGuests: guests.size,
      repeatGuests: repeatGuests.size,
      retentionRate,
      cohortCount: cohortData.cohortMonths.length,
    }
  }, [filtered, cohortData])

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
      {/* Sticky 헤더 + 필터 */}
      <div className={`sticky top-0 z-20 ${dark ? 'bg-[#1D2125]/95' : 'bg-slate-50/95'} backdrop-blur-sm border-b ${t.border}`}>
        <div className="px-4 pt-3 pb-1.5">
          <h1 className={`text-base font-bold ${t.text}`}>📈 코호트 분석</h1>
          <p className={`text-[11px] ${t.muted}`}>첫 구매 월 기준 리텐션 · 매출 성장 추적</p>
        </div>
        <div className="px-4 pb-2.5">
          <FilterBar dark={dark} data={data}
            selectedAreas={selectedAreas} setSelectedAreas={setSelectedAreas}
            selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch}
            selectedChannel={selectedChannel} setSelectedChannel={setSelectedChannel}
            showChannel totalCount={filtered.length} />
        </div>
      </div>

      <div className="px-4 pt-3 pb-6 space-y-3">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '전체 유저', value: fmtNum(kpis.totalGuests), sub: '명', icon: <Users size={13}/>, color: 'text-blue-500 bg-blue-500/10' },
            { label: '재구매 유저', value: fmtNum(kpis.repeatGuests), sub: '명', icon: <Activity size={13}/>, color: 'text-emerald-500 bg-emerald-500/10' },
            { label: '재구매율', value: fmtPct(kpis.retentionRate), sub: '', icon: <TrendingUp size={13}/>, color: 'text-violet-500 bg-violet-500/10' },
            { label: '코호트 수', value: fmtNum(kpis.cohortCount), sub: '개월', icon: <Activity size={13}/>, color: 'text-amber-500 bg-amber-500/10' },
          ].map((kpi, i) => (
            <div key={i} className={`rounded-lg p-2.5 border ${t.card} ${t.border}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
                <span className={`text-[11px] ${t.muted}`}>{kpi.label}</span>
              </div>
              <div className={`text-base font-bold ${t.text}`}>{kpi.value}<span className={`text-xs font-normal ml-0.5 ${t.muted}`}>{kpi.sub}</span></div>
            </div>
          ))}
        </div>

        {/* 코호트 리텐션 테이블 */}
        <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
          <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
            <h2 className={`text-xs font-semibold ${t.text}`}>코호트 리텐션 테이블</h2>
            <div className="flex items-center gap-1">
              {['retention', 'revenue'].map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition-all
                    ${mode === m ? 'bg-blue-600 text-white' : dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {m === 'retention' ? '리텐션' : '매출'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="text-[11px]">
              <thead>
                <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                  <th className={`px-2 py-1.5 text-left font-semibold ${t.sub} sticky left-0 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'} min-w-[80px]`}>코호트</th>
                  <th className={`px-2 py-1.5 text-center font-semibold ${t.sub} w-12`}>유저</th>
                  {Array.from({ length: cohortData.maxOffset + 1 }, (_, i) => (
                    <th key={i} className={`px-1.5 py-1.5 text-center font-semibold ${t.sub} w-14`}>
                      {i === 0 ? 'M0' : `+${i}M`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortData.cohortMonths.slice(-12).map(cm => {
                  const cohort = cohortData.cohorts[cm]
                  return (
                    <tr key={cm} className={`border-t ${t.border}`}>
                      <td className={`px-2 py-1.5 font-medium whitespace-nowrap sticky left-0 ${dark ? 'bg-[#22272B]' : 'bg-white'} ${t.text}`}>{cm}</td>
                      <td className={`px-2 py-1.5 text-center font-bold ${t.sub}`}>{fmtNum(cohort.size)}</td>
                      {Array.from({ length: cohortData.maxOffset + 1 }, (_, i) => {
                        const cell = cohort.months[i]
                        if (!cell) return <td key={i} className="px-1.5 py-1.5" />

                        if (mode === 'retention') {
                          const pct = cohort.size > 0 ? cell.users / cohort.size * 100 : 0
                          const intensity = pct / 100
                          const bg = i === 0 ? 'bg-blue-600 text-white'
                            : intensity > 0.3 ? 'bg-emerald-600 text-white'
                            : intensity > 0.15 ? dark ? 'bg-emerald-500/40 text-emerald-300' : 'bg-emerald-200 text-emerald-800'
                            : intensity > 0.05 ? dark ? 'bg-emerald-500/15' : 'bg-emerald-50'
                            : ''
                          return (
                            <td key={i} className={`px-1.5 py-1.5 text-center font-medium rounded ${bg}`}>
                              {fmtPct(pct)}
                            </td>
                          )
                        } else {
                          const perUser = cell.users > 0 ? cell.revenue / cell.users : 0
                          return (
                            <td key={i} className={`px-1.5 py-1.5 text-center text-[10px] ${t.text}`}>
                              {perUser >= 1000000 ? `${(perUser / 10000).toFixed(0)}만` : `${Math.round(perUser / 1000)}천`}
                            </td>
                          )
                        }
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 코호트별 재구매율 추이 바 차트 */}
        <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
          <h2 className={`text-xs font-semibold mb-2 ${t.text}`}>코호트별 +1M 재구매율 추이</h2>
          <div className="space-y-1.5">
            {cohortData.cohortMonths.slice(-12).map(cm => {
              const cohort = cohortData.cohorts[cm]
              const m1 = cohort.months[1]
              const pct = m1 && cohort.size > 0 ? m1.users / cohort.size * 100 : 0
              const maxPct = 30 // 스케일
              const barW = Math.min(pct / maxPct * 100, 100)
              return (
                <div key={cm} className="flex items-center gap-2">
                  <span className={`text-[11px] font-mono w-14 ${t.text}`}>{cm}</span>
                  <div className="flex-1 h-3.5 rounded-full overflow-hidden bg-slate-200/20">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                      style={{ width: `${barW}%` }} />
                  </div>
                  <span className={`text-[11px] font-bold w-12 text-right ${pct > 10 ? 'text-emerald-400' : t.muted}`}>{fmtPct(pct)}</span>
                  <span className={`text-[10px] w-10 text-right ${t.muted}`}>{fmtNum(cohort.size)}명</span>
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
