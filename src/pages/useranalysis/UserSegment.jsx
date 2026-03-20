import { useState, useEffect, useMemo } from 'react'
import { fetchProductData } from './fetchData'
import { Users, RefreshCw, Search, Filter, X, MapPin, Building2, Bed, Calendar, CreditCard, Clock, Hash, TrendingUp, DollarSign } from 'lucide-react'

/* ─── RFM 세그먼트 분류 ─── */
function calcSegments(data) {
  const guestMap = {}
  data.forEach(r => {
    const g = r.guest_id
    if (!g) return
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

  return Object.values(guestMap).map(g => {
    const segment =
      g.count >= 10 ? 'VIP' :
      g.count >= 5  ? '충성' :
      g.count >= 2  ? '일반' : '신규'
    return {
      ...g, segment,
      branches: g.branches.size,
      areas: g.areas.size,
      avgRevenue: g.count > 0 ? g.revenue / g.count : 0,
      avgNights: g.count > 0 ? g.nights / g.count : 0,
    }
  })
}

/* ─── 세그먼트별 요약 ─── */
function calcSegmentSummary(guests) {
  const segments = ['VIP', '충성', '일반', '신규']
  const icons = { VIP: '💎', '충성': '🥇', '일반': '🥈', '신규': '🆕' }
  return segments.map(seg => {
    const g = guests.filter(x => x.segment === seg)
    const totalRev = g.reduce((s, x) => s + x.revenue, 0)
    return {
      segment: seg, icon: icons[seg],
      count: g.length, revenue: totalRev,
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
    if (!g) return
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
  const sorted = intervals.length > 0 ? [...intervals].sort((a, b) => a - b) : []
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0

  // 전환율: row count 기준 (calcSegments와 동일)
  const countMap = {}
  Object.values(guestDates).forEach(dates => {
    const n = dates.length
    countMap[n] = (countMap[n] || 0) + 1
  })
  const total = Object.values(countMap).reduce((s, v) => s + v, 0)
  const oneTime = countMap[1] || 0
  const twoPlus = total - oneTime
  const threePlus = Object.entries(countMap).filter(([k]) => Number(k) >= 3).reduce((s, [, v]) => s + v, 0)

  return {
    avgDays: Math.round(avg), medianDays: Math.round(median),
    totalGuests: total,
    convRate1to2: total > 0 ? (twoPlus / total * 100) : 0,
    convRate2to3: twoPlus > 0 ? (threePlus / twoPlus * 100) : 0,
  }
}

const fmtKRW = v => v == null ? '—' : Math.round(v).toLocaleString() + '원'
const fmtNum = v => v == null ? '—' : Math.round(v).toLocaleString()
const fmtPct = v => v == null ? '—' : v.toFixed(1) + '%'

const SEGMENT_LIST = ['VIP', '충성', '일반', '신규']
const SEGMENT_COLORS = {
  VIP: { active: 'bg-purple-500 text-white', inactive: 'text-purple-500', ring: 'ring-purple-500/30' },
  '충성': { active: 'bg-amber-500 text-white', inactive: 'text-amber-500', ring: 'ring-amber-500/30' },
  '일반': { active: 'bg-blue-500 text-white', inactive: 'text-blue-500', ring: 'ring-blue-500/30' },
  '신규': { active: 'bg-emerald-500 text-white', inactive: 'text-emerald-500', ring: 'ring-emerald-500/30' },
}

/* ─── 금액 포맷 (간결) ─── */
const fmtKRWShort = v => {
  if (v == null || isNaN(v)) return '—'
  if (v >= 1e8) return (v / 1e8).toFixed(1) + '억'
  if (v >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만'
  return Math.round(v).toLocaleString() + '원'
}

/* ─── 세그먼트 스타일 ─── */
const SEG_STYLE = {
  VIP:  { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', dot: 'bg-purple-500' },
  '충성': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  '일반': { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  '신규': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
}

/* ─── 게스트 상세 모달 ─── */
function GuestDetailModal({ dark, guestId, guestSummary, bookings, onClose }) {
  if (!guestId) return null

  const t = dark
    ? { bg: 'bg-[#1a1d21]', card: 'bg-[#22272B]', card2: 'bg-[#2C333A]', border: 'border-[#A6C5E229]',
        text: 'text-white', sub: 'text-slate-400', muted: 'text-slate-500', overlay: 'bg-black/70 backdrop-blur-sm' }
    : { bg: 'bg-white', card: 'bg-slate-50', card2: 'bg-slate-100', border: 'border-slate-200',
        text: 'text-slate-800', sub: 'text-slate-600', muted: 'text-slate-400', overlay: 'bg-black/40 backdrop-blur-sm' }

  const ss = SEG_STYLE[guestSummary.segment] || SEG_STYLE['신규']

  /* KPI 계산 */
  const totalNights = bookings.reduce((s, r) => s + (Number(r.nights) || 0), 0)
  const totalRevenue = guestSummary.revenue
  const bookingCount = guestSummary.count
  // LOS = 총 결제박수 / 결제건수
  const los = bookingCount > 0 ? totalNights / bookingCount : 0
  // 객단가 = 총매출 / 건수
  const avgPrice = bookingCount > 0 ? totalRevenue / bookingCount : 0
  // ADR = 총매출 / 총 박수
  const adr = totalNights > 0 ? totalRevenue / totalNights : 0
  // 리드타임
  const ltValid = bookings.filter(r => r.lead_time != null && Number(r.lead_time) >= 0)
  const avgLeadTime = ltValid.length > 0 ? ltValid.reduce((s, r) => s + Number(r.lead_time), 0) / ltValid.length : 0

  /* 선호도 집계 */
  const aggregate = (key) => {
    const map = {}
    bookings.forEach(r => { const v = r[key] || '(미지정)'; map[v] = (map[v] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }
  const topAreas = aggregate('area')
  const topBranches = aggregate('branch_name')
  const topRooms = aggregate('room_type2')
  const topChannels = aggregate('channel_group')

  const sorted = [...bookings].sort((a, b) => (b.reservation_date || '').localeCompare(a.reservation_date || ''))

  /* 선호도 바 컴포넌트 */
  const PreferBar = ({ items, color = 'bg-blue-500' }) => (
    <div className="space-y-1">
      {items.slice(0, 3).map(([name, cnt], j) => {
        const pct = bookings.length > 0 ? cnt / bookings.length * 100 : 0
        return (
          <div key={j} className="flex items-center gap-2">
            <span className={`text-[11px] truncate w-[72px] text-right ${t.text}`}>{name}</span>
            <div className={`flex-1 h-[6px] rounded-full overflow-hidden ${dark ? 'bg-slate-700/40' : 'bg-slate-200/60'}`}>
              <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`text-[10px] font-mono w-8 text-right ${t.muted}`}>{cnt}</span>
          </div>
        )
      })}
      {items.length === 0 && <span className={`text-[10px] ${t.muted}`}>데이터 없음</span>}
    </div>
  )

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${t.overlay}`} onClick={onClose}>
      <div className={`${t.bg} rounded-2xl shadow-2xl ring-1 ${dark ? 'ring-white/5' : 'ring-black/5'} w-[780px] max-h-[88vh] flex flex-col animate-in`}
        onClick={e => e.stopPropagation()} style={{ animation: 'modalIn .15s ease-out' }}>

        {/* ── 헤더 ── */}
        <div className={`px-6 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${ss.bg} border ${ss.border}`}>
              <span className="text-lg">{guestSummary.segment === 'VIP' ? '💎' : guestSummary.segment === '충성' ? '🥇' : guestSummary.segment === '일반' ? '🥈' : '🆕'}</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className={`text-lg font-bold font-mono tracking-tight ${t.text}`}>{guestId}</span>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${ss.color} ${ss.bg} border ${ss.border}`}>{guestSummary.segment}</span>
              </div>
              <div className={`text-xs ${t.muted} mt-0.5`}>
                {guestSummary.firstDate?.slice(0, 10)} ~ {guestSummary.lastDate?.slice(0, 10)} · {bookingCount}건
              </div>
            </div>
          </div>
          <button onClick={onClose} className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}>
            <X size={16} className={t.muted} />
          </button>
        </div>

        {/* ── KPI 카드 (6열) ── */}
        <div className={`px-6 pb-4 shrink-0`}>
          <div className="grid grid-cols-6 gap-2">
            {[
              { label: '예약건수', value: `${bookingCount}건`, accent: 'text-blue-400' },
              { label: '총매출', value: fmtKRWShort(totalRevenue), accent: 'text-emerald-400' },
              { label: '객단가', value: fmtKRWShort(avgPrice), accent: t.text },
              { label: 'ADR', value: fmtKRWShort(adr), accent: 'text-violet-400' },
              { label: 'LOS', value: `${los.toFixed(1)}박`, accent: 'text-amber-400' },
              { label: '리드타임', value: `${Math.round(avgLeadTime)}일`, accent: t.text },
            ].map((kpi, i) => (
              <div key={i} className={`rounded-xl p-3 ${t.card} border ${t.border}`}>
                <div className={`text-[10px] font-medium ${t.muted} mb-1`}>{kpi.label}</div>
                <div className={`text-sm font-bold tabular-nums ${kpi.accent}`}>{kpi.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 선호도 분석 (4열) ── */}
        <div className={`px-6 pb-4 shrink-0`}>
          <div className={`rounded-xl p-4 ${t.card} border ${t.border}`}>
            <div className="grid grid-cols-4 gap-5">
              {[
                { icon: <MapPin size={11}/>, label: '권역', items: topAreas, color: 'bg-blue-500' },
                { icon: <Building2 size={11}/>, label: '지점', items: topBranches, color: 'bg-violet-500' },
                { icon: <Bed size={11}/>, label: '객실타입', items: topRooms, color: 'bg-amber-500' },
                { icon: <CreditCard size={11}/>, label: '채널그룹', items: topChannels, color: 'bg-emerald-500' },
              ].map((cat, ci) => (
                <div key={ci}>
                  <div className={`flex items-center gap-1.5 mb-2 ${t.sub}`}>
                    {cat.icon}
                    <span className="text-[11px] font-semibold">{cat.label}</span>
                  </div>
                  <PreferBar items={cat.items} color={cat.color} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 예약 이력 테이블 ── */}
        <div className={`flex-1 overflow-hidden min-h-0 border-t ${t.border}`}>
          <div className={`px-6 py-2.5 flex items-center justify-between ${dark ? 'bg-[#1a1d21]' : 'bg-white'}`}>
            <h3 className={`text-xs font-bold ${t.sub}`}>예약 이력</h3>
            <span className={`text-[10px] ${t.muted}`}>{bookings.length}건</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(88vh - 380px)' }}>
            <table className="w-full text-[11px]">
              <thead className={`sticky top-0 z-10 ${dark ? 'bg-[#22272B]' : 'bg-slate-50'}`}>
                <tr>
                  {['예약일', '체크인', '권역', '지점', '객실', 'LOS', '채널', '채널명', '결제'].map(h => (
                    <th key={h} className={`px-3 py-2 text-left font-semibold whitespace-nowrap ${t.sub}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const rowNights = Number(r.nights) || 0
                  const rowAmt = Number(r.payment_amount) || 0
                  return (
                    <tr key={i} className={`border-t ${t.border} ${dark ? 'hover:bg-white/[.02]' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className={`px-3 py-2 font-mono ${t.text}`}>{r.reservation_date?.slice(2, 10)}</td>
                      <td className={`px-3 py-2 font-mono ${t.muted}`}>{r.check_in_date?.slice(2, 10) || '—'}</td>
                      <td className={`px-3 py-2 ${t.text}`}>{r.area || '—'}</td>
                      <td className={`px-3 py-2 truncate max-w-[90px] ${t.text}`} title={r.branch_name}>{r.branch_name || '—'}</td>
                      <td className={`px-3 py-2 truncate max-w-[70px] ${t.text}`} title={r.room_type2}>{r.room_type2 || '—'}</td>
                      <td className={`px-3 py-2 font-bold tabular-nums ${t.text}`}>{rowNights > 0 ? rowNights + '박' : '—'}</td>
                      <td className={`px-3 py-2 ${t.muted}`}>{r.channel_group || '—'}</td>
                      <td className={`px-3 py-2 truncate max-w-[80px] ${t.text}`} title={r.channel_name}>{r.channel_name || '—'}</td>
                      <td className={`px-3 py-2 font-medium tabular-nums ${t.text}`}>{fmtKRWShort(rowAmt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
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
  const [selectedSegments, setSelectedSegments] = useState(new Set())
  const [modalGuestId, setModalGuestId] = useState(null)

  const fetchKey = `${dateRange?.start || ''}_${dateRange?.end || ''}`
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchProductData(dateRange)
      .then(rows => { if (!cancelled) { setData(rows); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [fetchKey])

  const areaList = useMemo(() => [...new Set(data.map(r => r.area).filter(Boolean))].sort(), [data])
  const branchList = useMemo(() => {
    const filtered = selectedArea ? data.filter(r => r.area === selectedArea) : data
    return [...new Set(filtered.map(r => r.branch_name).filter(Boolean))].sort()
  }, [data, selectedArea])
  useEffect(() => { setSelectedBranch('') }, [selectedArea])

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

  const segmentFilteredGuests = useMemo(() => {
    if (selectedSegments.size === 0) return guests
    return guests.filter(g => selectedSegments.has(g.segment))
  }, [guests, selectedSegments])

  const sortedGuests = useMemo(() => {
    let list = [...segmentFilteredGuests]
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(g => String(g.guest_id).includes(s) || String(g.user_id || '').includes(s))
    }
    list.sort((a, b) => sortDir === 'desc' ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy])
    return list.slice(0, 100)
  }, [segmentFilteredGuests, search, sortBy, sortDir])

  const toggleSegment = (seg) => {
    setSelectedSegments(prev => {
      const next = new Set(prev)
      if (next.has(seg)) next.delete(seg); else next.add(seg)
      return next
    })
  }

  // 모달용: 선택된 게스트의 예약 이력
  const modalBookings = useMemo(() => {
    if (!modalGuestId) return []
    return data.filter(r => String(r.guest_id) === String(modalGuestId))
  }, [data, modalGuestId])

  const modalGuestSummary = useMemo(() => {
    if (!modalGuestId) return null
    return guests.find(g => String(g.guest_id) === String(modalGuestId))
  }, [guests, modalGuestId])

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!modalGuestId) return
    const handler = (e) => { if (e.key === 'Escape') setModalGuestId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [modalGuestId])

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
        <div className="px-4 pt-3 pb-1">
          <h1 className={`text-sm font-bold ${t.text}`}>👤 유저 세그먼트</h1>
        </div>
        <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
          <Filter size={14} className={t.muted} />
          <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
            className={`text-xs rounded-md px-2 py-1 border outline-none ${t.input} ${t.inputFocus}`}>
            <option value="">전체 권역</option>
            {areaList.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
            className={`text-xs rounded-md px-2 py-1 border outline-none ${t.input} ${t.inputFocus}`}>
            <option value="">전체 지점</option>
            {branchList.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {(selectedArea || selectedBranch) && (
            <button onClick={() => { setSelectedArea(''); setSelectedBranch('') }}
              className={`text-xs px-1.5 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
              초기화
            </button>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {SEGMENT_LIST.map(seg => {
              const isActive = selectedSegments.size === 0 || selectedSegments.has(seg)
              const c = SEGMENT_COLORS[seg]
              return (
                <button key={seg} onClick={() => toggleSegment(seg)}
                  className={`px-1.5 py-0.5 rounded text-xs font-semibold transition-all border
                    ${isActive ? `${c.active} border-transparent` : dark ? `bg-[#2C333A] ${c.inactive} border-[#A1BDD914] opacity-40` : `bg-white ${c.inactive} border-slate-200 opacity-40`}`}>
                  {seg}
                </button>
              )
            })}
            {selectedSegments.size > 0 && (
              <button onClick={() => setSelectedSegments(new Set())}
                className={`text-xs px-1.5 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                전체
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-6 space-y-3">
        {/* ── 세그먼트 요약 카드 ── */}
        <div className="grid grid-cols-4 gap-2">
          {summary.map((seg, i) => {
            const revPct = totalRevenue > 0 ? seg.revenue / totalRevenue * 100 : 0
            return (
              <div key={i} className={`rounded-lg px-3 py-2.5 border ${t.card} ${t.border}`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm">{seg.icon}</span>
                  <span className={`text-xs font-bold ${t.text}`}>{seg.segment}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto ${dark ? 'bg-slate-700' : 'bg-slate-100'} ${t.sub}`}>
                    {seg.count}명
                  </span>
                </div>
                <div className={`text-sm font-bold ${t.text}`}>{fmtKRW(seg.revenue)}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1 rounded-full bg-slate-200/20 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${revPct}%` }} />
                  </div>
                  <span className={`text-[10px] font-medium ${t.muted}`}>{fmtPct(revPct)}</span>
                </div>
                <div className={`text-[10px] mt-0.5 ${t.muted}`}>평균 {seg.avgCount.toFixed(1)}회 · {fmtKRW(seg.avgRevenue)}/인</div>
              </div>
            )
          })}
        </div>

        {/* ── 구매 주기 분석 ── */}
        <div className={`rounded-lg border px-4 py-2.5 ${t.card} ${t.border}`}>
          <div className="flex items-center gap-6">
            <h2 className={`text-xs font-semibold shrink-0 ${t.text}`}>🔄 구매 주기</h2>
            {[
              { label: '평균 재구매', value: cycle.avgDays + '일', highlight: cycle.avgDays < 60 },
              { label: '중앙값', value: cycle.medianDays + '일', highlight: false },
              { label: '전체 게스트', value: fmtNum(cycle.totalGuests) + '명', highlight: false },
              { label: '1→2회 전환', value: fmtPct(cycle.convRate1to2), highlight: cycle.convRate1to2 > 20 },
              { label: '2→3회 전환', value: fmtPct(cycle.convRate2to3), highlight: cycle.convRate2to3 > 30 },
            ].map((item, i) => (
              <div key={i} className="flex items-baseline gap-1.5">
                <span className={`text-[10px] ${t.muted}`}>{item.label}</span>
                <span className={`text-sm font-bold tabular-nums ${item.highlight ? 'text-blue-400' : t.text}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Top 구매자 랭킹 ── */}
        <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
          <div className={`px-4 py-2 border-b ${t.border} flex items-center justify-between`}>
            <h2 className={`text-xs font-semibold ${t.text}`}>
              🏆 Top 구매자
              {selectedSegments.size > 0 && <span className={`ml-1.5 font-normal ${t.muted}`}>({[...selectedSegments].join(', ')})</span>}
            </h2>
            <div className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${dark ? 'bg-[#2C333A]' : 'bg-slate-100'}`}>
              <Search size={12} className={t.muted} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ID 검색..." className={`bg-transparent outline-none text-xs w-20 ${t.text}`} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                  {[
                    { key: 'rank', label: '#', w: 'w-8' },
                    { key: 'guest_id', label: 'Guest', w: '' },
                    { key: 'segment', label: '등급', w: 'w-12' },
                    { key: 'count', label: '횟수', w: 'w-10' },
                    { key: 'revenue', label: '총매출', w: '' },
                    { key: 'avgRevenue', label: '건당', w: '' },
                    { key: 'areas', label: '권역', w: 'w-12' },
                    { key: 'branches', label: '지점', w: 'w-12' },
                    { key: 'avgNights', label: '박', w: 'w-10' },
                  ].map(col => (
                    <th key={col.key}
                      onClick={() => { if (col.key !== 'rank') { setSortBy(col.key); setSortDir(d => d === 'desc' ? 'asc' : 'desc') } }}
                      className={`px-3 py-2 text-left text-[11px] font-semibold cursor-pointer select-none whitespace-nowrap ${col.w} ${t.sub} ${sortBy === col.key ? 'text-blue-500' : ''}`}>
                      {col.label}{sortBy === col.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedGuests.map((g, i) => {
                  const segColor = g.segment === 'VIP' ? 'text-purple-500' : g.segment === '충성' ? 'text-amber-500' : g.segment === '일반' ? 'text-blue-500' : 'text-emerald-500'
                  return (
                    <tr key={g.guest_id} onClick={() => setModalGuestId(g.guest_id)}
                      className={`border-t ${t.border} cursor-pointer transition-colors ${dark ? 'hover:bg-[#2C333A]' : 'hover:bg-slate-50'}`}>
                      <td className={`px-3 py-1.5 font-bold ${t.muted}`}>{i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</td>
                      <td className={`px-3 py-1.5 font-mono ${t.text}`}>{g.guest_id}</td>
                      <td className={`px-3 py-1.5 font-semibold ${segColor}`}>{g.segment}</td>
                      <td className={`px-3 py-1.5 ${t.text}`}>{g.count}</td>
                      <td className={`px-3 py-1.5 font-medium ${t.text}`}>{fmtKRW(g.revenue)}</td>
                      <td className={`px-3 py-1.5 ${t.muted}`}>{fmtKRW(g.avgRevenue)}</td>
                      <td className={`px-3 py-1.5 ${t.text}`}>{g.areas}</td>
                      <td className={`px-3 py-1.5 ${t.text}`}>{g.branches}</td>
                      <td className={`px-3 py-1.5 ${t.text}`}>{g.avgNights.toFixed(1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 게스트 상세 모달 */}
      {modalGuestId && modalGuestSummary && (
        <GuestDetailModal
          dark={dark}
          guestId={modalGuestId}
          guestSummary={modalGuestSummary}
          bookings={modalBookings}
          onClose={() => setModalGuestId(null)}
        />
      )}
    </div>
  )
}
