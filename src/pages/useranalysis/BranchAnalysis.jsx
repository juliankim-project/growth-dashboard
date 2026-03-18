import { useState, useEffect, useMemo } from 'react'
import { fetchProductData } from './fetchData'
import { Building2, Users, MapPin, ArrowRightLeft, RefreshCw, TrendingUp, CalendarDays, Filter } from 'lucide-react'

/* ─── 지점별 집계 ─── */
function calcBranchStats(data) {
  const map = {}
  data.forEach(r => {
    const b = r.branch_name || '(알 수 없음)'
    if (!map[b]) map[b] = { branch: b, area: r.area || '', guests: new Set(), revenue: 0, count: 0, nights: 0, peoples: 0 }
    if (r.guest_id) map[b].guests.add(r.guest_id)
    map[b].revenue += Number(r.payment_amount) || 0
    map[b].count += 1
    map[b].nights += Number(r.nights) || 0
    map[b].peoples += Number(r.peoples) || 0
  })
  return Object.values(map)
    .map(v => ({ ...v, guests: v.guests.size, avgRevenue: v.count > 0 ? v.revenue / v.count : 0, avgNights: v.count > 0 ? v.nights / v.count : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

/* ─── 권역별 집계 ─── */
function calcAreaStats(data) {
  const map = {}
  data.forEach(r => {
    const a = r.area || '(알 수 없음)'
    if (!map[a]) map[a] = { area: a, guests: new Set(), revenue: 0, count: 0 }
    if (r.guest_id) map[a].guests.add(r.guest_id)
    map[a].revenue += Number(r.payment_amount) || 0
    map[a].count += 1
  })
  return Object.values(map)
    .map(v => ({ ...v, guests: v.guests.size }))
    .sort((a, b) => b.revenue - a.revenue)
}

/* ─── 크로스구매 히트맵 ─── */
function calcCrossPurchase(data) {
  const guestAreas = {}
  data.forEach(r => {
    const g = r.guest_id
    if (!g) return
    const a = r.area || '(알 수 없음)'
    if (!guestAreas[g]) guestAreas[g] = new Set()
    guestAreas[g].add(a)
  })

  const areas = [...new Set(data.map(r => r.area || '(알 수 없음)'))].sort()
  const matrix = {}
  areas.forEach(a => { matrix[a] = {}; areas.forEach(b => { matrix[a][b] = 0 }) })

  Object.values(guestAreas).forEach(areaSet => {
    if (areaSet.size < 2) return
    const arr = [...areaSet]
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i !== j) matrix[arr[i]][arr[j]] += 1
      }
    }
  })

  const multiAreaGuests = Object.values(guestAreas).filter(s => s.size >= 2).length
  return { areas, matrix, multiAreaGuests }
}

/* ─── 재방문율 ─── */
function calcRevisitRate(data) {
  const branchGuests = {}
  data.forEach(r => {
    if (!r.guest_id) return
    const b = r.branch_name || '(알 수 없음)'
    if (!branchGuests[b]) branchGuests[b] = {}
    branchGuests[b][r.guest_id] = (branchGuests[b][r.guest_id] || 0) + 1
  })
  return Object.entries(branchGuests).map(([branch, guests]) => {
    const total = Object.keys(guests).length
    const revisit = Object.values(guests).filter(c => c >= 2).length
    return { branch, total, revisit, rate: total > 0 ? (revisit / total * 100) : 0 }
  }).sort((a, b) => b.rate - a.rate)
}

/* ─── 예약 페이스 ─── */
function calcBookingPace(data, targetMonth) {
  if (!targetMonth) return null
  const [year, month] = targetMonth.split('-').map(Number)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const filtered = data.filter(r => {
    if (!r.check_in_date) return false
    const ci = new Date(r.check_in_date)
    return ci >= monthStart && ci <= monthEnd
  })

  const buckets = [
    { label: '0-3일', min: 0, max: 3, count: 0, revenue: 0 },
    { label: '4-7일', min: 4, max: 7, count: 0, revenue: 0 },
    { label: '8-14일', min: 8, max: 14, count: 0, revenue: 0 },
    { label: '15-30일', min: 15, max: 30, count: 0, revenue: 0 },
    { label: '31일+', min: 31, max: Infinity, count: 0, revenue: 0 },
  ]

  filtered.forEach(r => {
    const lt = Number(r.lead_time)
    if (isNaN(lt) || lt < 0) return
    const bucket = buckets.find(b => lt >= b.min && lt <= b.max)
    if (bucket) { bucket.count += 1; bucket.revenue += Number(r.payment_amount) || 0 }
  })

  return { buckets, totalCount: filtered.length }
}

function getAvailableMonths(data) {
  const months = new Set()
  data.forEach(r => { if (r.check_in_date) months.add(r.check_in_date.substring(0, 7)) })
  return [...months].sort().reverse()
}

const fmtKRW = v => v == null ? '—' : Math.round(v).toLocaleString() + '원'
const fmtNum = v => v == null ? '—' : Math.round(v).toLocaleString()
const fmtPct = v => v == null ? '—' : v.toFixed(1) + '%'

export default function BranchAnalysis({ dark, dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('branch')
  const [selectedArea, setSelectedArea] = useState('')
  const [paceMonth, setPaceMonth] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchProductData(dateRange)
      .then(rows => { setData(rows); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [dateRange?.start, dateRange?.end])

  const areaList = useMemo(() => [...new Set(data.map(r => r.area).filter(Boolean))].sort(), [data])
  const availableMonths = useMemo(() => getAvailableMonths(data), [data])

  useEffect(() => {
    if (availableMonths.length > 0 && !paceMonth) setPaceMonth(availableMonths[0])
  }, [availableMonths])

  const filteredData = useMemo(() => {
    if (!selectedArea) return data
    return data.filter(r => r.area === selectedArea)
  }, [data, selectedArea])

  const branchStats = useMemo(() => calcBranchStats(filteredData), [filteredData])
  const areaStats = useMemo(() => calcAreaStats(filteredData), [filteredData])
  const crossPurchase = useMemo(() => calcCrossPurchase(filteredData), [filteredData])
  const revisitRates = useMemo(() => calcRevisitRate(filteredData), [filteredData])
  const bookingPace = useMemo(() => calcBookingPace(filteredData, paceMonth), [filteredData, paceMonth])

  const totalRevenue = useMemo(() => filteredData.reduce((s, r) => s + (Number(r.payment_amount) || 0), 0), [filteredData])
  const totalGuests = useMemo(() => new Set(filteredData.map(r => r.guest_id)).size, [filteredData])
  const totalReservations = filteredData.length

  const t = dark
    ? { bg: 'bg-[#1D2125]', card: 'bg-[#22272B]', border: 'border-[#A1BDD914]', text: 'text-white', sub: 'text-slate-400', muted: 'text-slate-500',
        input: 'bg-[#2C333A] border-[#A1BDD914] text-white', inputFocus: 'focus:border-blue-500' }
    : { bg: 'bg-slate-50', card: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', sub: 'text-slate-600', muted: 'text-slate-400',
        input: 'bg-white border-slate-200 text-slate-800', inputFocus: 'focus:border-blue-500' }

  if (loading) return (
    <div className={`flex items-center justify-center h-96 ${t.text}`}>
      <RefreshCw size={20} className="animate-spin mr-2" /> 데이터 로딩 중...
    </div>
  )
  if (error) return <div className="text-red-500 p-6">에러: {error}</div>

  return (
    <div className={`min-h-screen ${t.bg}`}>
      {/* ── Sticky 필터 + 헤더 ── */}
      <div className={`sticky top-0 z-20 ${dark ? 'bg-[#1D2125]/95' : 'bg-slate-50/95'} backdrop-blur-sm border-b ${t.border}`}>
        <div className="px-4 pt-3 pb-1.5">
          <h1 className={`text-base font-bold ${t.text}`}>🏠 지점별 분석</h1>
        </div>
        <div className="px-4 pb-2.5 flex items-center gap-2.5 flex-wrap">
          <Filter size={13} className={t.muted} />
          <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
            className={`text-xs rounded-lg px-2.5 py-1 border outline-none ${t.input} ${t.inputFocus}`}>
            <option value="">전체 권역</option>
            {areaList.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {selectedArea && (
            <button onClick={() => setSelectedArea('')}
              className={`text-[11px] px-2 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
              초기화
            </button>
          )}
          {/* 뷰모드 토글 */}
          <div className="flex items-center gap-1 ml-auto">
            {['branch', 'area'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`text-[11px] px-2.5 py-0.5 rounded font-medium transition-all
                  ${viewMode === mode ? 'bg-[#0C66E4] text-white' : dark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                {mode === 'branch' ? '지점별' : '권역별'}
              </button>
            ))}
          </div>
          <span className={`text-[11px] ${t.muted}`}>{fmtNum(totalReservations)}건</span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-6 space-y-3">
        {/* ── KPI 요약 ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '총 매출', value: fmtKRW(totalRevenue), icon: <TrendingUp size={13}/>, color: 'text-emerald-500 bg-emerald-500/10' },
            { label: '게스트', value: fmtNum(totalGuests) + '명', icon: <Users size={13}/>, color: 'text-blue-500 bg-blue-500/10' },
            { label: '예약건', value: fmtNum(totalReservations) + '건', icon: <Building2 size={13}/>, color: 'text-violet-500 bg-violet-500/10' },
            { label: '크로스구매', value: fmtNum(crossPurchase.multiAreaGuests) + '명', icon: <ArrowRightLeft size={13}/>, color: 'text-orange-500 bg-orange-500/10' },
          ].map((kpi, i) => (
            <div key={i} className={`rounded-lg p-2.5 border ${t.card} ${t.border}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
                <span className={`text-[11px] ${t.muted}`}>{kpi.label}</span>
              </div>
              <div className={`text-base font-bold ${t.text}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* ── 지점/권역 테이블 ── */}
        <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
          <div className={`px-3 py-2 border-b ${t.border}`}>
            <h2 className={`text-xs font-semibold ${t.text}`}>
              {viewMode === 'branch' ? '🏢 지점별 현황' : '📍 권역별 현황'}
              {selectedArea && <span className={`ml-1.5 font-normal ${t.muted}`}>({selectedArea})</span>}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                  {viewMode === 'branch'
                    ? ['지점', '권역', '게스트', '예약', '매출', '건당', '비중', '숙박'].map(h => (
                        <th key={h} className={`px-2 py-1.5 text-left font-semibold ${t.sub}`}>{h}</th>
                      ))
                    : ['권역', '게스트', '예약', '매출', '비중'].map(h => (
                        <th key={h} className={`px-2 py-1.5 text-left font-semibold ${t.sub}`}>{h}</th>
                      ))
                  }
                </tr>
              </thead>
              <tbody>
                {(viewMode === 'branch' ? branchStats : areaStats).map((row, i) => {
                  const revPct = totalRevenue > 0 ? (row.revenue / totalRevenue * 100) : 0
                  return (
                    <tr key={i} className={`border-t ${t.border} ${dark ? 'hover:bg-[#2C333A]' : 'hover:bg-slate-50'}`}>
                      {viewMode === 'branch' ? (
                        <>
                          <td className={`px-2 py-1.5 font-medium truncate max-w-[140px] ${t.text}`}>{row.branch}</td>
                          <td className={`px-2 py-1.5 ${t.muted}`}>{row.area}</td>
                          <td className={`px-2 py-1.5 ${t.text}`}>{fmtNum(row.guests)}</td>
                          <td className={`px-2 py-1.5 ${t.text}`}>{fmtNum(row.count)}</td>
                          <td className={`px-2 py-1.5 font-medium ${t.text}`}>{fmtKRW(row.revenue)}</td>
                          <td className={`px-2 py-1.5 ${t.muted}`}>{fmtKRW(row.avgRevenue)}</td>
                          <td className={`px-2 py-1.5`}>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold
                              ${revPct > 10 ? 'bg-blue-500/20 text-blue-400' : dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                              {fmtPct(revPct)}
                            </span>
                          </td>
                          <td className={`px-2 py-1.5 ${t.text}`}>{row.avgNights.toFixed(1)}박</td>
                        </>
                      ) : (
                        <>
                          <td className={`px-2 py-1.5 font-medium ${t.text}`}>{row.area}</td>
                          <td className={`px-2 py-1.5 ${t.text}`}>{fmtNum(row.guests)}</td>
                          <td className={`px-2 py-1.5 ${t.text}`}>{fmtNum(row.count)}</td>
                          <td className={`px-2 py-1.5 font-medium ${t.text}`}>{fmtKRW(row.revenue)}</td>
                          <td className={`px-2 py-1.5`}>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold
                              ${revPct > 15 ? 'bg-blue-500/20 text-blue-400' : dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                              {fmtPct(revPct)}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 예약 페이스 ── */}
        <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
          <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
            <h2 className={`text-xs font-semibold ${t.text}`}>📈 예약 페이스</h2>
            <div className="flex items-center gap-1.5">
              <CalendarDays size={12} className={t.muted} />
              <select value={paceMonth} onChange={e => setPaceMonth(e.target.value)}
                className={`text-[11px] rounded px-2 py-0.5 border outline-none ${t.input} ${t.inputFocus}`}>
                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="p-3">
            {bookingPace && bookingPace.totalCount > 0 ? (
              <>
                <div className={`text-[10px] mb-2 ${t.muted}`}>
                  {paceMonth} 체크인 총 {fmtNum(bookingPace.totalCount)}건
                </div>
                <div className="space-y-1.5">
                  {bookingPace.buckets.map((bucket, i) => {
                    const maxCount = Math.max(...bookingPace.buckets.map(b => b.count))
                    const pct = maxCount > 0 ? bucket.count / maxCount * 100 : 0
                    const sharePct = bookingPace.totalCount > 0 ? bucket.count / bookingPace.totalCount * 100 : 0
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium w-12 ${t.text}`}>{bucket.label}</span>
                        <div className="flex-1 h-4 rounded-full overflow-hidden bg-slate-200/20 relative">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-all"
                            style={{ width: `${pct}%` }} />
                          {bucket.count > 0 && (
                            <span className="absolute inset-y-0 flex items-center ml-1.5 text-[9px] font-bold text-white drop-shadow">
                              {bucket.count}건
                            </span>
                          )}
                        </div>
                        <span className={`text-[11px] font-bold w-10 text-right ${sharePct > 25 ? 'text-blue-400' : t.text}`}>{fmtPct(sharePct)}</span>
                        <span className={`text-[10px] w-20 text-right ${t.muted}`}>{fmtKRW(bucket.revenue)}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className={`text-xs ${t.muted}`}>
                {paceMonth ? `${paceMonth}에 해당하는 데이터가 없습니다.` : '월을 선택해주세요.'}
              </p>
            )}
          </div>
        </div>

        {/* ── 크로스구매 + 재방문율 (2컬럼) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 크로스구매 히트맵 */}
          <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
            <div className={`px-3 py-2 border-b ${t.border}`}>
              <h2 className={`text-xs font-semibold ${t.text}`}>🔀 크로스구매</h2>
              <p className={`text-[10px] ${t.muted}`}>다른 권역도 이용한 게스트 수</p>
            </div>
            <div className="overflow-x-auto p-2">
              {crossPurchase.areas.length > 0 ? (
                <table className="text-[10px]">
                  <thead>
                    <tr>
                      <th className={`px-1.5 py-1 text-left ${t.sub}`}>↓/→</th>
                      {crossPurchase.areas.map(a => (
                        <th key={a} className={`px-1.5 py-1 text-center ${t.sub}`}>{a}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {crossPurchase.areas.map(from => {
                      const maxVal = Math.max(...crossPurchase.areas.map(to => crossPurchase.matrix[from][to]))
                      return (
                        <tr key={from}>
                          <td className={`px-1.5 py-1 font-medium whitespace-nowrap ${t.text}`}>{from}</td>
                          {crossPurchase.areas.map(to => {
                            const val = crossPurchase.matrix[from][to]
                            const intensity = maxVal > 0 ? val / maxVal : 0
                            const bg = from === to
                              ? dark ? 'bg-slate-700' : 'bg-slate-100'
                              : intensity > 0.7 ? 'bg-blue-500 text-white'
                              : intensity > 0.4 ? 'bg-blue-400/70 text-white'
                              : intensity > 0.1 ? dark ? 'bg-blue-500/20' : 'bg-blue-100'
                              : ''
                            return (
                              <td key={to} className={`px-1.5 py-1 text-center font-medium rounded ${bg}`}>
                                {from === to ? '—' : val || ''}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className={`text-xs p-2 ${t.muted}`}>데이터 없음</p>
              )}
            </div>
          </div>

          {/* 재방문율 */}
          <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
            <div className={`px-3 py-2 border-b ${t.border}`}>
              <h2 className={`text-xs font-semibold ${t.text}`}>🔄 재방문율</h2>
              <p className={`text-[10px] ${t.muted}`}>같은 지점 2회+ 방문 비율</p>
            </div>
            <div className="p-2 space-y-1.5">
              {revisitRates.slice(0, 12).map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`text-[11px] font-medium w-28 truncate ${t.text}`}>{row.branch}</span>
                  <div className="flex-1 h-3.5 rounded-full overflow-hidden bg-slate-200/20">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                      style={{ width: `${Math.min(row.rate, 100)}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold w-10 text-right ${row.rate > 20 ? 'text-blue-400' : t.text}`}>{fmtPct(row.rate)}</span>
                  <span className={`text-[9px] w-14 text-right ${t.muted}`}>{row.revisit}/{row.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
