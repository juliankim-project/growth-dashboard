import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Crown, Users, Star, UserPlus, RefreshCw, Search, Filter } from 'lucide-react'

/* ─── 데이터 fetch ─── */
async function fetchProductData(dateRange) {
  if (!supabase) return []
  const cols = 'guest_id,user_id,branch_name,area,channel_group,reservation_date,check_in_date,nights,peoples,payment_amount,room_type2'
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

/* ─── RFM 세그먼트 분류 ─── */
function calcSegments(data) {
  const guestMap = {}
  data.forEach(r => {
    const g = r.guest_id
    if (!guestMap[g]) guestMap[g] = {
      guest_id: g, user_id: r.user_id,
      count: 0, revenue: 0, nights: 0,
      firstDate: r.reservation_date, lastDate: r.reservation_date,
      branches: new Set(), areas: new Set(),
    }
    guestMap[g].count += 1
    guestMap[g].revenue += Number(r.payment_amount) || 0
    guestMap[g].nights += Number(r.nights) || 0
    guestMap[g].branches.add(r.branch_name)
    guestMap[g].areas.add(r.area)
    if (r.reservation_date < guestMap[g].firstDate) guestMap[g].firstDate = r.reservation_date
    if (r.reservation_date > guestMap[g].lastDate) guestMap[g].lastDate = r.reservation_date
  })

  const guests = Object.values(guestMap).map(g => {
    const segment =
      g.count >= 10 ? 'VIP' :
      g.count >= 5  ? '충성' :
      g.count >= 2  ? '일반' : '신규'
    return {
      ...g,
      segment,
      branches: g.branches.size,
      areas: g.areas.size,
      avgRevenue: g.count > 0 ? g.revenue / g.count : 0,
      avgNights: g.count > 0 ? g.nights / g.count : 0,
    }
  })

  return guests
}

/* ─── 세그먼트별 요약 ─── */
function calcSegmentSummary(guests) {
  const segments = ['VIP', '충성', '일반', '신규']
  const colors = { VIP: 'purple', '충성': 'amber', '일반': 'blue', '신규': 'emerald' }
  const icons = { VIP: '💎', '충성': '🥇', '일반': '🥈', '신규': '🆕' }

  return segments.map(seg => {
    const g = guests.filter(x => x.segment === seg)
    const totalRev = g.reduce((s, x) => s + x.revenue, 0)
    return {
      segment: seg,
      icon: icons[seg],
      color: colors[seg],
      count: g.length,
      revenue: totalRev,
      avgRevenue: g.length > 0 ? totalRev / g.length : 0,
      avgCount: g.length > 0 ? g.reduce((s, x) => s + x.count, 0) / g.length : 0,
    }
  })
}

/* ─── 구매 주기 분석 ─── */
function calcPurchaseCycle(data) {
  const guestDates = {}
  data.forEach(r => {
    const g = r.guest_id
    if (!guestDates[g]) guestDates[g] = []
    guestDates[g].push(r.reservation_date)
  })

  const intervals = []
  Object.values(guestDates).forEach(dates => {
    if (dates.length < 2) return
    const sorted = [...new Set(dates)].sort()
    for (let i = 1; i < sorted.length; i++) {
      const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / (1000 * 60 * 60 * 24)
      if (diff > 0) intervals.push(diff)
    }
  })

  const avg = intervals.length > 0 ? intervals.reduce((s, v) => s + v, 0) / intervals.length : 0
  const median = intervals.length > 0 ? intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)] : 0

  const countMap = {}
  Object.values(guestDates).forEach(dates => {
    const n = new Set(dates).size
    countMap[n] = (countMap[n] || 0) + 1
  })
  const total = Object.values(countMap).reduce((s, v) => s + v, 0)
  const oneTime = countMap[1] || 0
  const twoPlus = total - oneTime
  const threePlus = Object.entries(countMap).filter(([k]) => Number(k) >= 3).reduce((s, [, v]) => s + v, 0)

  return {
    avgDays: Math.round(avg),
    medianDays: Math.round(median),
    totalGuests: total,
    convRate1to2: total > 0 ? (twoPlus / total * 100) : 0,
    convRate2to3: twoPlus > 0 ? (threePlus / twoPlus * 100) : 0,
  }
}

/* ─── 포맷 ─── */
const fmtKRW = v => v == null ? '—' : Math.round(v).toLocaleString() + '원'
const fmtNum = v => v == null ? '—' : Math.round(v).toLocaleString()
const fmtPct = v => v == null ? '—' : v.toFixed(1) + '%'

const SEGMENT_LIST = ['VIP', '충성', '일반', '신규']
const SEGMENT_COLORS = {
  VIP: { active: 'bg-purple-500 text-white', inactive: 'text-purple-500' },
  '충성': { active: 'bg-amber-500 text-white', inactive: 'text-amber-500' },
  '일반': { active: 'bg-blue-500 text-white', inactive: 'text-blue-500' },
  '신규': { active: 'bg-emerald-500 text-white', inactive: 'text-emerald-500' },
}

export default function UserSegment({ dark, dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('revenue')
  const [sortDir, setSortDir] = useState('desc')
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedSegments, setSelectedSegments] = useState(new Set()) // empty = all

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

  const guests = useMemo(() => calcSegments(filteredData), [filteredData])
  const summary = useMemo(() => calcSegmentSummary(guests), [guests])
  const cycle = useMemo(() => calcPurchaseCycle(filteredData), [filteredData])
  const totalRevenue = useMemo(() => guests.reduce((s, g) => s + g.revenue, 0), [guests])

  // 세그먼트 필터 적용된 게스트
  const segmentFilteredGuests = useMemo(() => {
    if (selectedSegments.size === 0) return guests
    return guests.filter(g => selectedSegments.has(g.segment))
  }, [guests, selectedSegments])

  const sortedGuests = useMemo(() => {
    let list = [...segmentFilteredGuests]
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(g =>
        String(g.guest_id).includes(s) ||
        String(g.user_id || '').includes(s)
      )
    }
    list.sort((a, b) => sortDir === 'desc' ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy])
    return list.slice(0, 100)
  }, [segmentFilteredGuests, search, sortBy, sortDir])

  const toggleSegment = (seg) => {
    setSelectedSegments(prev => {
      const next = new Set(prev)
      if (next.has(seg)) next.delete(seg)
      else next.add(seg)
      return next
    })
  }

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
        <h1 className={`text-xl font-bold ${t.text}`}>👤 유저 세그먼트</h1>
        <p className={`text-sm mt-1 ${t.sub}`}>RFM 기반 유저 등급 분류, Top 구매자 랭킹, 구매 주기 분석</p>
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
          {/* 세그먼트 토글 */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={`text-xs ${t.sub} mr-1`}>등급</span>
            {SEGMENT_LIST.map(seg => {
              const isActive = selectedSegments.size === 0 || selectedSegments.has(seg)
              const colors = SEGMENT_COLORS[seg]
              return (
                <button
                  key={seg}
                  onClick={() => toggleSegment(seg)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border
                    ${isActive
                      ? `${colors.active} border-transparent`
                      : dark
                        ? `bg-[#2C333A] ${colors.inactive} border-[#A1BDD914] opacity-50`
                        : `bg-white ${colors.inactive} border-slate-200 opacity-50`
                    }`}
                >
                  {seg}
                </button>
              )
            })}
            {selectedSegments.size > 0 && (
              <button
                onClick={() => setSelectedSegments(new Set())}
                className={`text-xs px-2 py-1 rounded-lg ${dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
              >
                전체
              </button>
            )}
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

      {/* 세그먼트 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summary.map((seg, i) => (
          <div key={i} className={`rounded-xl p-4 border ${t.card} ${t.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{seg.icon}</span>
              <span className={`text-sm font-bold ${t.text}`}>{seg.segment}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-slate-700' : 'bg-slate-100'} ${t.sub}`}>
                {seg.count}명
              </span>
            </div>
            <div className={`text-base font-bold ${t.text}`}>{fmtKRW(seg.revenue)}</div>
            <div className={`text-xs mt-1 ${t.muted}`}>
              매출 비중 {fmtPct(totalRevenue > 0 ? seg.revenue / totalRevenue * 100 : 0)} · 평균 {seg.avgCount.toFixed(1)}회
            </div>
          </div>
        ))}
      </div>

      {/* 구매 주기 분석 */}
      <div className={`rounded-xl border p-4 ${t.card} ${t.border}`}>
        <h2 className={`text-sm font-semibold mb-3 ${t.text}`}>🔄 구매 주기 분석</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: '평균 재구매 주기', value: cycle.avgDays + '일' },
            { label: '중앙값 주기', value: cycle.medianDays + '일' },
            { label: '전체 게스트', value: fmtNum(cycle.totalGuests) + '명' },
            { label: '1회→2회 전환율', value: fmtPct(cycle.convRate1to2) },
            { label: '2회→3회 전환율', value: fmtPct(cycle.convRate2to3) },
          ].map((item, i) => (
            <div key={i}>
              <div className={`text-xs ${t.muted}`}>{item.label}</div>
              <div className={`text-lg font-bold ${t.text}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top 구매자 랭킹 */}
      <div className={`rounded-xl border overflow-hidden ${t.card} ${t.border}`}>
        <div className={`px-4 py-3 border-b ${t.border} flex items-center justify-between`}>
          <h2 className={`text-sm font-semibold ${t.text}`}>
            🏆 Top 구매자 랭킹
            {selectedSegments.size > 0 && (
              <span className={`ml-2 text-xs font-normal ${t.muted}`}>
                ({[...selectedSegments].join(', ')})
              </span>
            )}
          </h2>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${dark ? 'bg-[#2C333A]' : 'bg-slate-100'}`}>
            <Search size={14} className={t.muted} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ID 검색..."
              className={`bg-transparent outline-none text-xs w-24 ${t.text}`}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                {[
                  { key: 'rank', label: '#' },
                  { key: 'guest_id', label: 'Guest ID' },
                  { key: 'user_id', label: 'User ID' },
                  { key: 'segment', label: '등급' },
                  { key: 'count', label: '구매횟수' },
                  { key: 'revenue', label: '총 매출' },
                  { key: 'avgRevenue', label: '건당 매출' },
                  { key: 'branches', label: '지점수' },
                  { key: 'areas', label: '권역수' },
                  { key: 'avgNights', label: '평균숙박' },
                ].map(col => (
                  <th key={col.key}
                    onClick={() => { if (col.key !== 'rank') { setSortBy(col.key); setSortDir(d => d === 'desc' ? 'asc' : 'desc') } }}
                    className={`px-3 py-2.5 text-left text-xs font-semibold cursor-pointer select-none ${t.sub} ${sortBy === col.key ? 'text-blue-500' : ''}`}>
                    {col.label} {sortBy === col.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedGuests.map((g, i) => {
                const segColor = g.segment === 'VIP' ? 'text-purple-500' : g.segment === '충성' ? 'text-amber-500' : g.segment === '일반' ? 'text-blue-500' : 'text-emerald-500'
                return (
                  <tr key={g.guest_id} className={`border-t ${t.border} ${dark ? 'hover:bg-[#2C333A]' : 'hover:bg-slate-50'}`}>
                    <td className={`px-3 py-2.5 text-xs font-bold ${t.muted}`}>
                      {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                    </td>
                    <td className={`px-3 py-2.5 font-mono text-xs ${t.text}`}>{g.guest_id}</td>
                    <td className={`px-3 py-2.5 font-mono text-xs ${t.sub}`}>{g.user_id || '—'}</td>
                    <td className={`px-3 py-2.5 font-semibold text-xs ${segColor}`}>{g.segment}</td>
                    <td className={`px-3 py-2.5 ${t.text}`}>{g.count}회</td>
                    <td className={`px-3 py-2.5 font-medium ${t.text}`}>{fmtKRW(g.revenue)}</td>
                    <td className={`px-3 py-2.5 ${t.text}`}>{fmtKRW(g.avgRevenue)}</td>
                    <td className={`px-3 py-2.5 ${t.text}`}>{g.branches}</td>
                    <td className={`px-3 py-2.5 ${t.text}`}>{g.areas}</td>
                    <td className={`px-3 py-2.5 ${t.text}`}>{g.avgNights.toFixed(1)}박</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
