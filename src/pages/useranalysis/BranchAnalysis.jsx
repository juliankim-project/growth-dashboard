import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Building2, Users, MapPin, ArrowRightLeft, RefreshCw, TrendingUp, ChevronDown, CalendarDays, Filter } from 'lucide-react'

/* ─── 데이터 fetch ─── */
async function fetchProductData(dateRange) {
  if (!supabase) return []
  const cols = 'guest_id,user_id,branch_name,area,channel_group,channel_name,reservation_date,check_in_date,nights,peoples,payment_amount,original_price,room_type_name,room_type2,brand_name,lead_time'
  let q = supabase.from('product_revenue_raw').select(cols)
  if (dateRange?.start) q = q.gte('reservation_date', dateRange.start)
  if (dateRange?.end)   q = q.lte('reservation_date', dateRange.end)
  const PAGE = 5000
  let from = 0, all = []
  while (true) {
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
    q = supabase.from('product_revenue_raw').select(cols)
    if (dateRange?.start) q = q.gte('reservation_date', dateRange.start)
    if (dateRange?.end)   q = q.lte('reservation_date', dateRange.end)
  }
  return all
}

/* ─── 지점별 집계 ─── */
function calcBranchStats(data) {
  const map = {}
  data.forEach(r => {
    const b = r.branch_name || '(알 수 없음)'
    if (!map[b]) map[b] = { branch: b, area: r.area || '', guests: new Set(), revenue: 0, count: 0, nights: 0, peoples: 0 }
    map[b].guests.add(r.guest_id)
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
    map[a].guests.add(r.guest_id)
    map[a].revenue += Number(r.payment_amount) || 0
    map[a].count += 1
  })
  return Object.values(map)
    .map(v => ({ ...v, guests: v.guests.size }))
    .sort((a, b) => b.revenue - a.revenue)
}

/* ─── 크로스구매 히트맵 데이터 ─── */
function calcCrossPurchase(data) {
  const guestAreas = {}
  data.forEach(r => {
    const g = r.guest_id
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

/* ─── 예약 페이스 (Booking Pace) ─── */
function calcBookingPace(data, targetMonth) {
  if (!targetMonth) return []
  // targetMonth format: "2025-03"
  const [year, month] = targetMonth.split('-').map(Number)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0) // last day of month

  // Filter reservations with check_in_date in target month
  const filtered = data.filter(r => {
    if (!r.check_in_date) return false
    const ci = new Date(r.check_in_date)
    return ci >= monthStart && ci <= monthEnd
  })

  // Group by lead_time buckets
  const buckets = [
    { label: '0-3일 전', min: 0, max: 3, count: 0, revenue: 0 },
    { label: '4-7일 전', min: 4, max: 7, count: 0, revenue: 0 },
    { label: '8-14일 전', min: 8, max: 14, count: 0, revenue: 0 },
    { label: '15-30일 전', min: 15, max: 30, count: 0, revenue: 0 },
    { label: '31일+ 전', min: 31, max: Infinity, count: 0, revenue: 0 },
  ]

  filtered.forEach(r => {
    const lt = Number(r.lead_time)
    if (isNaN(lt) || lt < 0) return
    const bucket = buckets.find(b => lt >= b.min && lt <= b.max)
    if (bucket) {
      bucket.count += 1
      bucket.revenue += Number(r.payment_amount) || 0
    }
  })

  const totalCount = filtered.length
  return { buckets, totalCount, totalReservations: filtered.length }
}

/* ─── 포맷 ─── */
const fmtKRW = v => v == null ? '—' : Math.round(v).toLocaleString() + '원'
const fmtNum = v => v == null ? '—' : Math.round(v).toLocaleString()
const fmtPct = v => v == null ? '—' : v.toFixed(1) + '%'

/* ─── 월 목록 생성 ─── */
function getAvailableMonths(data) {
  const months = new Set()
  data.forEach(r => {
    if (r.check_in_date) {
      const d = r.check_in_date.substring(0, 7)
      months.add(d)
    }
  })
  return [...months].sort().reverse()
}

/* ─── 컴포넌트 ─── */
export default function BranchAnalysis({ dark, dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('branch') // branch | area
  const [selectedArea, setSelectedArea] = useState('') // '' = 전체
  const [paceMonth, setPaceMonth] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchProductData(dateRange)
      .then(rows => { setData(rows); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [dateRange?.start, dateRange?.end])

  // 권역 목록
  const areaList = useMemo(() => {
    const areas = [...new Set(data.map(r => r.area).filter(Boolean))].sort()
    return areas
  }, [data])

  // 월 목록
  const availableMonths = useMemo(() => getAvailableMonths(data), [data])

  // 기본 페이스 월 설정
  useEffect(() => {
    if (availableMonths.length > 0 && !paceMonth) {
      setPaceMonth(availableMonths[0])
    }
  }, [availableMonths])

  // 필터된 데이터
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
    <div className={`p-6 space-y-6 min-h-screen ${t.bg}`}>
      {/* 헤더 */}
      <div>
        <h1 className={`text-xl font-bold ${t.text}`}>🏠 지점별 분석</h1>
        <p className={`text-sm mt-1 ${t.sub}`}>권역/지점별 이용 현황, 크로스구매, 재방문율 분석</p>
      </div>

      {/* 필터 바 */}
      <div className={`rounded-xl border p-4 ${t.card} ${t.border}`}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} className={t.muted} />
            <span className={`text-xs font-semibold ${t.sub}`}>필터</span>
          </div>
          <div className="flex items-center gap-2">
            <label className={`text-xs ${t.sub}`}>권역</label>
            <select
              value={selectedArea}
              onChange={e => setSelectedArea(e.target.value)}
              className={`text-sm rounded-lg px-3 py-1.5 border outline-none ${t.input} ${t.inputFocus}`}
            >
              <option value="">전체 권역</option>
              {areaList.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          {selectedArea && (
            <button
              onClick={() => setSelectedArea('')}
              className={`text-xs px-2 py-1 rounded-lg ${dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* KPI 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '총 매출', value: fmtKRW(totalRevenue), icon: <TrendingUp size={16}/>, color: 'text-emerald-500 bg-emerald-500/10' },
          { label: '총 게스트', value: fmtNum(totalGuests) + '명', icon: <Users size={16}/>, color: 'text-blue-500 bg-blue-500/10' },
          { label: '총 예약건', value: fmtNum(totalReservations) + '건', icon: <Building2 size={16}/>, color: 'text-violet-500 bg-violet-500/10' },
          { label: '크로스구매 게스트', value: fmtNum(crossPurchase.multiAreaGuests) + '명', icon: <ArrowRightLeft size={16}/>, color: 'text-orange-500 bg-orange-500/10' },
        ].map((kpi, i) => (
          <div key={i} className={`rounded-xl p-4 border ${t.card} ${t.border}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
              <span className={`text-xs font-semibold ${t.sub}`}>{kpi.label}</span>
            </div>
            <div className={`text-lg font-bold ${t.text}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* 뷰 모드 토글 */}
      <div className="flex gap-2">
        {['branch', 'area'].map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${viewMode === mode
                ? 'bg-[#0C66E4] text-white'
                : dark ? 'bg-[#22272B] text-slate-400 hover:bg-[#2C333A]' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}>
            {mode === 'branch' ? '🏢 지점별' : '📍 권역별'}
          </button>
        ))}
      </div>

      {/* 지점별/권역별 테이블 */}
      <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
        <div className={`px-4 py-3 border-b ${t.border}`}>
          <h2 className={`text-sm font-semibold ${t.text}`}>
            {viewMode === 'branch' ? '🏢 지점별 이용 현황' : '📍 권역별 이용 현황'}
            {selectedArea && <span className={`ml-2 text-xs font-normal ${t.muted}`}>({selectedArea})</span>}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                {viewMode === 'branch'
                  ? ['지점', '권역', '게스트', '예약건', '매출', '건당 매출', '평균 숙박'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-left text-xs font-semibold ${t.sub}`}>{h}</th>
                    ))
                  : ['권역', '게스트', '예약건', '매출', '매출 비중'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-left text-xs font-semibold ${t.sub}`}>{h}</th>
                    ))
                }
              </tr>
            </thead>
            <tbody>
              {(viewMode === 'branch' ? branchStats : areaStats).map((row, i) => (
                <tr key={i} className={`border-t ${t.border} ${dark ? 'hover:bg-[#2C333A]' : 'hover:bg-slate-50'}`}>
                  {viewMode === 'branch' ? (
                    <>
                      <td className={`px-4 py-2.5 font-medium ${t.text}`}>{row.branch}</td>
                      <td className={`px-4 py-2.5 ${t.sub}`}>{row.area}</td>
                      <td className={`px-4 py-2.5 ${t.text}`}>{fmtNum(row.guests)}</td>
                      <td className={`px-4 py-2.5 ${t.text}`}>{fmtNum(row.count)}</td>
                      <td className={`px-4 py-2.5 font-medium ${t.text}`}>{fmtKRW(row.revenue)}</td>
                      <td className={`px-4 py-2.5 ${t.text}`}>{fmtKRW(row.avgRevenue)}</td>
                      <td className={`px-4 py-2.5 ${t.text}`}>{row.avgNights.toFixed(1)}박</td>
                    </>
                  ) : (
                    <>
                      <td className={`px-4 py-2.5 font-medium ${t.text}`}>{row.area}</td>
                      <td className={`px-4 py-2.5 ${t.text}`}>{fmtNum(row.guests)}</td>
                      <td className={`px-4 py-2.5 ${t.text}`}>{fmtNum(row.count)}</td>
                      <td className={`px-4 py-2.5 font-medium ${t.text}`}>{fmtKRW(row.revenue)}</td>
                      <td className={`px-4 py-2.5 ${t.text}`}>{fmtPct(totalRevenue > 0 ? row.revenue / totalRevenue * 100 : 0)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 예약 페이스 (Booking Pace) */}
      <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
        <div className={`px-4 py-3 border-b ${t.border} flex items-center justify-between flex-wrap gap-2`}>
          <div>
            <h2 className={`text-sm font-semibold ${t.text}`}>📈 예약 페이스 (Booking Pace)</h2>
            <p className={`text-xs mt-0.5 ${t.muted}`}>선택한 체크인 월의 예약이 얼마 전에 이루어졌는지 분석</p>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className={t.muted} />
            <select
              value={paceMonth}
              onChange={e => setPaceMonth(e.target.value)}
              className={`text-sm rounded-lg px-3 py-1.5 border outline-none ${t.input} ${t.inputFocus}`}
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-4">
          {bookingPace.totalCount > 0 ? (
            <>
              <div className={`text-xs mb-3 ${t.muted}`}>
                {paceMonth} 체크인 예약 총 {fmtNum(bookingPace.totalCount)}건
                {selectedArea && ` (${selectedArea})`}
              </div>
              <div className="space-y-3">
                {bookingPace.buckets.map((bucket, i) => {
                  const maxCount = Math.max(...bookingPace.buckets.map(b => b.count))
                  const pct = maxCount > 0 ? bucket.count / maxCount * 100 : 0
                  const sharePct = bookingPace.totalCount > 0 ? bucket.count / bookingPace.totalCount * 100 : 0
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-20 ${t.text}`}>{bucket.label}</span>
                      <div className="flex-1 h-6 rounded-full overflow-hidden bg-slate-200/20 relative">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                        {bucket.count > 0 && (
                          <span className="absolute inset-y-0 flex items-center ml-2 text-[10px] font-bold text-white drop-shadow">
                            {bucket.count}건
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-bold w-12 text-right ${t.text}`}>{fmtPct(sharePct)}</span>
                      <span className={`text-xs w-24 text-right ${t.muted}`}>{fmtKRW(bucket.revenue)}</span>
                    </div>
                  )
                })}
              </div>
              {/* 페이스 요약 테이블 */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                      {['리드타임', '예약건', '비중', '매출', '건당 매출'].map(h => (
                        <th key={h} className={`px-3 py-2 text-left font-semibold ${t.sub}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookingPace.buckets.map((bucket, i) => (
                      <tr key={i} className={`border-t ${t.border}`}>
                        <td className={`px-3 py-2 font-medium ${t.text}`}>{bucket.label}</td>
                        <td className={`px-3 py-2 ${t.text}`}>{fmtNum(bucket.count)}건</td>
                        <td className={`px-3 py-2 ${t.text}`}>{fmtPct(bookingPace.totalCount > 0 ? bucket.count / bookingPace.totalCount * 100 : 0)}</td>
                        <td className={`px-3 py-2 font-medium ${t.text}`}>{fmtKRW(bucket.revenue)}</td>
                        <td className={`px-3 py-2 ${t.text}`}>{fmtKRW(bucket.count > 0 ? bucket.revenue / bucket.count : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className={`text-sm ${t.muted}`}>
              {paceMonth ? `${paceMonth}에 해당하는 체크인 예약 데이터가 없습니다.` : '월을 선택해주세요.'}
            </p>
          )}
        </div>
      </div>

      {/* 크로스구매 히트맵 */}
      <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
        <div className={`px-4 py-3 border-b ${t.border}`}>
          <h2 className={`text-sm font-semibold ${t.text}`}>🔀 권역 크로스구매 히트맵</h2>
          <p className={`text-xs mt-0.5 ${t.muted}`}>A 권역 게스트 중 B 권역도 이용한 게스트 수</p>
        </div>
        <div className="overflow-x-auto p-4">
          {crossPurchase.areas.length > 0 ? (
            <table className="text-xs">
              <thead>
                <tr>
                  <th className={`px-3 py-2 text-left ${t.sub}`}>From ↓ / To →</th>
                  {crossPurchase.areas.map(a => (
                    <th key={a} className={`px-3 py-2 text-center ${t.sub}`}>{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crossPurchase.areas.map(from => {
                  const maxVal = Math.max(...crossPurchase.areas.map(to => crossPurchase.matrix[from][to]))
                  return (
                    <tr key={from}>
                      <td className={`px-3 py-2 font-medium ${t.text}`}>{from}</td>
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
                          <td key={to} className={`px-3 py-2 text-center font-medium ${bg}`}>
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
            <p className={`text-sm ${t.muted}`}>크로스구매 데이터가 없습니다.</p>
          )}
        </div>
      </div>

      {/* 재방문율 */}
      <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
        <div className={`px-4 py-3 border-b ${t.border}`}>
          <h2 className={`text-sm font-semibold ${t.text}`}>🔄 지점별 재방문율</h2>
          <p className={`text-xs mt-0.5 ${t.muted}`}>같은 지점에 2회 이상 방문한 게스트 비율</p>
        </div>
        <div className="p-4 space-y-2">
          {revisitRates.slice(0, 15).map((row, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={`text-xs font-medium w-32 truncate ${t.text}`}>{row.branch}</span>
              <div className="flex-1 h-5 rounded-full overflow-hidden bg-slate-200/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                  style={{ width: `${Math.min(row.rate, 100)}%` }}
                />
              </div>
              <span className={`text-xs font-bold w-14 text-right ${t.text}`}>{fmtPct(row.rate)}</span>
              <span className={`text-xs w-20 text-right ${t.muted}`}>{row.revisit}/{row.total}명</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
