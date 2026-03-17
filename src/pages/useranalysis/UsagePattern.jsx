import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Calendar, Clock, Home, Bed, Filter } from 'lucide-react'

/* ─── 데이터 fetch ─── */
async function fetchProductData(dateRange) {
  if (!supabase) return []
  const cols = 'guest_id,branch_name,area,reservation_date,check_in_date,nights,peoples,payment_amount,room_type2,room_type_name,lead_time,channel_group'
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

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토']

/* ─── 체크인 요일 히트맵 ─── */
function calcCheckinHeatmap(data) {
  const branches = [...new Set(data.map(r => r.branch_name).filter(Boolean))].sort()
  const map = {}
  branches.forEach(b => { map[b] = Array(7).fill(0) })

  data.forEach(r => {
    if (!r.check_in_date || !r.branch_name) return
    const day = new Date(r.check_in_date).getDay()
    if (map[r.branch_name]) map[r.branch_name][day] += 1
  })

  return { branches, map }
}

/* ─── 예약일 기준 체크인 시점 분석 ─── */
function calcReservationToCheckin(data) {
  const byDay = Array(7).fill(0)
  const byMonth = Array(12).fill(0)

  data.forEach(r => {
    if (!r.reservation_date) return
    const d = new Date(r.reservation_date)
    byDay[d.getDay()] += 1
    byMonth[d.getMonth()] += 1
  })

  return { byDay, byMonth }
}

/* ─── 숙박일수 분포 ─── */
function calcNightsDistribution(data) {
  const dist = {}
  data.forEach(r => {
    const n = Number(r.nights) || 0
    const key = n >= 7 ? '7+' : String(n)
    dist[key] = (dist[key] || 0) + 1
  })
  const keys = ['0', '1', '2', '3', '4', '5', '6', '7+']
  return keys.map(k => ({ nights: k + '박', count: dist[k] || 0 }))
}

/* ─── 리드타임 분포 ─── */
function calcLeadtimeDistribution(data) {
  const buckets = [
    { label: '당일', min: 0, max: 0, count: 0 },
    { label: '1-3일', min: 1, max: 3, count: 0 },
    { label: '4-7일', min: 4, max: 7, count: 0 },
    { label: '8-14일', min: 8, max: 14, count: 0 },
    { label: '15-30일', min: 15, max: 30, count: 0 },
    { label: '31일+', min: 31, max: Infinity, count: 0 },
  ]
  data.forEach(r => {
    const lt = Number(r.lead_time)
    if (isNaN(lt) || lt < 0) return
    const bucket = buckets.find(b => lt >= b.min && lt <= b.max)
    if (bucket) bucket.count += 1
  })
  return buckets
}

/* ─── 객실 타입 선호도 ─── */
function calcRoomTypePreference(data) {
  const map = {}
  data.forEach(r => {
    const rt = r.room_type2 || r.room_type_name || '(알 수 없음)'
    if (!map[rt]) map[rt] = { type: rt, count: 0, revenue: 0 }
    map[rt].count += 1
    map[rt].revenue += Number(r.payment_amount) || 0
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

/* ─── 권역별 체크인 요일 분석 ─── */
function calcAreaDayPattern(data) {
  const areas = [...new Set(data.map(r => r.area).filter(Boolean))].sort()
  const map = {}
  areas.forEach(a => { map[a] = Array(7).fill(0) })
  data.forEach(r => {
    if (!r.check_in_date || !r.area) return
    const day = new Date(r.check_in_date).getDay()
    if (map[r.area]) map[r.area][day] += 1
  })
  return { areas, map }
}

/* ─── 포맷 ─── */
const fmtKRW = v => Math.round(v).toLocaleString() + '원'
const fmtNum = v => Math.round(v).toLocaleString()
const fmtPct = v => v.toFixed(1) + '%'

export default function UsagePattern({ dark, dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchProductData(dateRange)
      .then(rows => { setData(rows); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [dateRange?.start, dateRange?.end])

  // 권역/지점 목록
  const areaList = useMemo(() => [...new Set(data.map(r => r.area).filter(Boolean))].sort(), [data])
  const branchList = useMemo(() => {
    const filtered = selectedArea ? data.filter(r => r.area === selectedArea) : data
    return [...new Set(filtered.map(r => r.branch_name).filter(Boolean))].sort()
  }, [data, selectedArea])

  // 권역 변경시 지점 초기화
  useEffect(() => { setSelectedBranch('') }, [selectedArea])

  // 필터된 데이터
  const filteredData = useMemo(() => {
    let d = data
    if (selectedArea) d = d.filter(r => r.area === selectedArea)
    if (selectedBranch) d = d.filter(r => r.branch_name === selectedBranch)
    return d
  }, [data, selectedArea, selectedBranch])

  const heatmap = useMemo(() => calcCheckinHeatmap(filteredData), [filteredData])
  const resvPattern = useMemo(() => calcReservationToCheckin(filteredData), [filteredData])
  const nightsDist = useMemo(() => calcNightsDistribution(filteredData), [filteredData])
  const leadtimeDist = useMemo(() => calcLeadtimeDistribution(filteredData), [filteredData])
  const roomTypes = useMemo(() => calcRoomTypePreference(filteredData), [filteredData])
  const areaDays = useMemo(() => calcAreaDayPattern(filteredData), [filteredData])

  const totalCount = filteredData.length
  const avgNights = useMemo(() => {
    const sum = filteredData.reduce((s, r) => s + (Number(r.nights) || 0), 0)
    return totalCount > 0 ? sum / totalCount : 0
  }, [filteredData, totalCount])
  const avgLeadTime = useMemo(() => {
    const valid = filteredData.filter(r => r.lead_time != null && r.lead_time >= 0)
    return valid.length > 0 ? valid.reduce((s, r) => s + Number(r.lead_time), 0) / valid.length : 0
  }, [filteredData])
  const avgPeoples = useMemo(() => {
    const sum = filteredData.reduce((s, r) => s + (Number(r.peoples) || 0), 0)
    return totalCount > 0 ? sum / totalCount : 0
  }, [filteredData, totalCount])

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
        <h1 className={`text-xl font-bold ${t.text}`}>📊 이용 패턴 분석</h1>
        <p className={`text-sm mt-1 ${t.sub}`}>체크인 요일, 숙박일수, 예약 리드타임, 객실 선호도 분석</p>
      </div>

      {/* 필터 바 */}
      <div className={`rounded-xl border p-4 ${t.card} ${t.border}`}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} className={t.muted} />
            <span className={`text-xs font-semibold ${t.sub}`}>필터</span>
          </div>
          {/* 권역 */}
          <div className="flex items-center gap-2">
            <label className={`text-xs ${t.sub}`}>권역</label>
            <select
              value={selectedArea}
              onChange={e => setSelectedArea(e.target.value)}
              className={`text-sm rounded-lg px-3 py-1.5 border outline-none ${t.input} ${t.inputFocus}`}
            >
              <option value="">전체 권역</option>
              {areaList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {/* 지점 */}
          <div className="flex items-center gap-2">
            <label className={`text-xs ${t.sub}`}>지점</label>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className={`text-sm rounded-lg px-3 py-1.5 border outline-none ${t.input} ${t.inputFocus}`}
            >
              <option value="">전체 지점</option>
              {branchList.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {/* 필터 초기화 */}
          {(selectedArea || selectedBranch) && (
            <button
              onClick={() => { setSelectedArea(''); setSelectedBranch('') }}
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
          { label: '총 예약건', value: fmtNum(totalCount) + '건', icon: <Calendar size={16}/>, color: 'text-blue-500 bg-blue-500/10' },
          { label: '평균 숙박', value: avgNights.toFixed(1) + '박', icon: <Bed size={16}/>, color: 'text-violet-500 bg-violet-500/10' },
          { label: '평균 리드타임', value: Math.round(avgLeadTime) + '일', icon: <Clock size={16}/>, color: 'text-amber-500 bg-amber-500/10' },
          { label: '평균 투숙객', value: avgPeoples.toFixed(1) + '명', icon: <Home size={16}/>, color: 'text-emerald-500 bg-emerald-500/10' },
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

      {/* 체크인 요일 히트맵 (지점별) */}
      <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
        <div className={`px-4 py-3 border-b ${t.border}`}>
          <h2 className={`text-sm font-semibold ${t.text}`}>
            📅 지점별 체크인 요일 히트맵
            {selectedArea && <span className={`ml-2 text-xs font-normal ${t.muted}`}>({selectedArea})</span>}
          </h2>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="text-xs">
            <thead>
              <tr>
                <th className={`px-3 py-2 text-left ${t.sub}`}>지점</th>
                {DAYS_KR.map(d => (
                  <th key={d} className={`px-3 py-2 text-center w-12 ${t.sub}`}>{d}</th>
                ))}
                <th className={`px-3 py-2 text-center ${t.sub}`}>합계</th>
              </tr>
            </thead>
            <tbody>
              {heatmap.branches.slice(0, 20).map(branch => {
                const row = heatmap.map[branch]
                const rowMax = Math.max(...row)
                const total = row.reduce((s, v) => s + v, 0)
                return (
                  <tr key={branch}>
                    <td className={`px-3 py-1.5 font-medium whitespace-nowrap ${t.text}`}>{branch}</td>
                    {row.map((v, di) => {
                      const intensity = rowMax > 0 ? v / rowMax : 0
                      const bg = intensity > 0.8 ? 'bg-blue-600 text-white'
                        : intensity > 0.6 ? 'bg-blue-500 text-white'
                        : intensity > 0.3 ? dark ? 'bg-blue-500/30' : 'bg-blue-200'
                        : intensity > 0 ? dark ? 'bg-blue-500/10' : 'bg-blue-50'
                        : ''
                      return (
                        <td key={di} className={`px-3 py-1.5 text-center font-medium rounded ${bg}`}>
                          {v || ''}
                        </td>
                      )
                    })}
                    <td className={`px-3 py-1.5 text-center font-bold ${t.sub}`}>{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 권역별 체크인 요일 */}
      <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
        <div className={`px-4 py-3 border-b ${t.border}`}>
          <h2 className={`text-sm font-semibold ${t.text}`}>📍 권역별 체크인 요일 패턴</h2>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="text-xs">
            <thead>
              <tr>
                <th className={`px-3 py-2 text-left ${t.sub}`}>권역</th>
                {DAYS_KR.map(d => (
                  <th key={d} className={`px-3 py-2 text-center w-12 ${t.sub}`}>{d}</th>
                ))}
                <th className={`px-3 py-2 text-center ${t.sub}`}>합계</th>
              </tr>
            </thead>
            <tbody>
              {areaDays.areas.map(area => {
                const row = areaDays.map[area]
                const rowMax = Math.max(...row)
                const total = row.reduce((s, v) => s + v, 0)
                return (
                  <tr key={area}>
                    <td className={`px-3 py-1.5 font-medium whitespace-nowrap ${t.text}`}>{area}</td>
                    {row.map((v, di) => {
                      const intensity = rowMax > 0 ? v / rowMax : 0
                      const bg = intensity > 0.8 ? 'bg-emerald-600 text-white'
                        : intensity > 0.6 ? 'bg-emerald-500 text-white'
                        : intensity > 0.3 ? dark ? 'bg-emerald-500/30' : 'bg-emerald-200'
                        : intensity > 0 ? dark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                        : ''
                      return (
                        <td key={di} className={`px-3 py-1.5 text-center font-medium rounded ${bg}`}>
                          {v || ''}
                        </td>
                      )
                    })}
                    <td className={`px-3 py-1.5 text-center font-bold ${t.sub}`}>{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 숙박일수 분포 */}
        <div className={`rounded-xl border p-4 ${t.card} ${t.border}`}>
          <h2 className={`text-sm font-semibold mb-3 ${t.text}`}>🛏️ 숙박일수 분포</h2>
          <div className="space-y-2">
            {nightsDist.map((row, i) => {
              const maxCount = Math.max(...nightsDist.map(r => r.count))
              const pct = maxCount > 0 ? row.count / maxCount * 100 : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-xs font-medium w-10 ${t.text}`}>{row.nights}</span>
                  <div className="flex-1 h-5 rounded-full overflow-hidden bg-slate-200/20">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-xs font-bold w-16 text-right ${t.text}`}>{fmtNum(row.count)}</span>
                  <span className={`text-xs w-12 text-right ${t.muted}`}>{fmtPct(totalCount > 0 ? row.count / totalCount * 100 : 0)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 리드타임 분포 */}
        <div className={`rounded-xl border p-4 ${t.card} ${t.border}`}>
          <h2 className={`text-sm font-semibold mb-3 ${t.text}`}>⏱️ 예약 리드타임 분포</h2>
          <div className="space-y-2">
            {leadtimeDist.map((row, i) => {
              const maxCount = Math.max(...leadtimeDist.map(r => r.count))
              const pct = maxCount > 0 ? row.count / maxCount * 100 : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-xs font-medium w-16 ${t.text}`}>{row.label}</span>
                  <div className="flex-1 h-5 rounded-full overflow-hidden bg-slate-200/20">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className={`text-xs font-bold w-16 text-right ${t.text}`}>{fmtNum(row.count)}</span>
                  <span className={`text-xs w-12 text-right ${t.muted}`}>{fmtPct(totalCount > 0 ? row.count / totalCount * 100 : 0)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 객실 타입 선호도 */}
      <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
        <div className={`px-4 py-3 border-b ${t.border}`}>
          <h2 className={`text-sm font-semibold ${t.text}`}>🏨 객실 타입 선호도</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                {['객실 타입', '예약건', '비중', '매출', '건당 매출'].map(h => (
                  <th key={h} className={`px-4 py-2.5 text-left text-xs font-semibold ${t.sub}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomTypes.slice(0, 15).map((row, i) => (
                <tr key={i} className={`border-t ${t.border} ${dark ? 'hover:bg-[#2C333A]' : 'hover:bg-slate-50'}`}>
                  <td className={`px-4 py-2.5 font-medium ${t.text}`}>{row.type}</td>
                  <td className={`px-4 py-2.5 ${t.text}`}>{fmtNum(row.count)}</td>
                  <td className={`px-4 py-2.5 ${t.text}`}>{fmtPct(totalCount > 0 ? row.count / totalCount * 100 : 0)}</td>
                  <td className={`px-4 py-2.5 font-medium ${t.text}`}>{fmtKRW(row.revenue)}</td>
                  <td className={`px-4 py-2.5 ${t.text}`}>{fmtKRW(row.count > 0 ? row.revenue / row.count : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
