import { useState, useEffect, useMemo } from 'react'
import { fetchProductData } from './fetchData'
import { RefreshCw, Calendar, Clock, Home, Bed, Filter, BarChart3, Percent } from 'lucide-react'

const DAYS_KR = ['일', '월', '화', '수', '목', '금', '토']
const DAYS_COLOR = ['text-red-400', '', '', '', '', '', 'text-blue-400']

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

/* ─── 숙박일수 분포 ─── */
function calcNightsDistribution(data) {
  const dist = {}
  data.forEach(r => {
    const n = Number(r.nights) || 0
    const key = n >= 7 ? '7+' : String(n)
    dist[key] = (dist[key] || 0) + 1
  })
  const keys = ['1', '2', '3', '4', '5', '6', '7+']
  return keys.map(k => ({ nights: k + '박', count: dist[k] || 0 }))
}

/* ─── 리드타임 분포 ─── */
function calcLeadtimeDistribution(data) {
  const buckets = [
    { label: '당일', min: 0, max: 0, count: 0, revenue: 0 },
    { label: '1-3일', min: 1, max: 3, count: 0, revenue: 0 },
    { label: '4-7일', min: 4, max: 7, count: 0, revenue: 0 },
    { label: '8-14일', min: 8, max: 14, count: 0, revenue: 0 },
    { label: '15-30일', min: 15, max: 30, count: 0, revenue: 0 },
    { label: '31일+', min: 31, max: Infinity, count: 0, revenue: 0 },
  ]
  data.forEach(r => {
    const lt = Number(r.lead_time)
    if (isNaN(lt) || lt < 0) return
    const bucket = buckets.find(b => lt >= b.min && lt <= b.max)
    if (bucket) {
      bucket.count += 1
      bucket.revenue += Number(r.payment_amount) || 0
    }
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

/* ─── 채널별 분포 ─── */
function calcChannelDistribution(data) {
  const map = {}
  data.forEach(r => {
    const ch = r.channel_group || '(알 수 없음)'
    if (!map[ch]) map[ch] = { channel: ch, count: 0, revenue: 0 }
    map[ch].count += 1
    map[ch].revenue += Number(r.payment_amount) || 0
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

/* ─── 포맷 ─── */
const fmtKRW = v => Math.round(v).toLocaleString() + '원'
const fmtNum = v => Math.round(v).toLocaleString()
const fmtPct = v => v.toFixed(1) + '%'

/* ─── 미니 도넛 차트 (SVG) ─── */
function MiniDonut({ segments, size = 48, thickness = 6 }) {
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-slate-200/20" />
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0
        const dash = pct * circ
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            className="transition-all duration-300"
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

/* ─── 수평 퍼센트 바 ─── */
function PctBar({ value, max, color = 'from-blue-500 to-blue-400', height = 'h-4' }) {
  const pct = max > 0 ? value / max * 100 : 0
  return (
    <div className={`flex-1 ${height} rounded-full overflow-hidden bg-slate-200/20`}>
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-300`}
        style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ─── 히트맵 셀 (건수 + 비율 토글) ─── */
function HeatCell({ value, rowTotal, rowMax, showPct, colorScheme = 'blue', dark }) {
  const intensity = rowMax > 0 ? value / rowMax : 0
  const pct = rowTotal > 0 ? value / rowTotal * 100 : 0
  const colors = {
    blue: {
      high: 'bg-blue-600 text-white',
      mid: 'bg-blue-500 text-white',
      low: dark ? 'bg-blue-500/30 text-blue-300' : 'bg-blue-200 text-blue-800',
      faint: dark ? 'bg-blue-500/10' : 'bg-blue-50',
    },
    emerald: {
      high: 'bg-emerald-600 text-white',
      mid: 'bg-emerald-500 text-white',
      low: dark ? 'bg-emerald-500/30 text-emerald-300' : 'bg-emerald-200 text-emerald-800',
      faint: dark ? 'bg-emerald-500/10' : 'bg-emerald-50',
    },
  }
  const c = colors[colorScheme]
  const bg = intensity > 0.8 ? c.high
    : intensity > 0.6 ? c.mid
    : intensity > 0.3 ? c.low
    : intensity > 0 ? c.faint
    : ''
  return (
    <td className={`px-1.5 py-1 text-center text-[11px] font-medium rounded ${bg}`}>
      {value > 0 ? (showPct ? fmtPct(pct) : value) : ''}
    </td>
  )
}

export default function UsagePattern({ dark, dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [heatmapMode, setHeatmapMode] = useState('count') // count | pct
  const [heatmapView, setHeatmapView] = useState('branch') // branch | area

  useEffect(() => {
    setLoading(true)
    fetchProductData(dateRange)
      .then(rows => { setData(rows); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [dateRange?.start, dateRange?.end])

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

  const heatmap = useMemo(() => calcCheckinHeatmap(filteredData), [filteredData])
  const nightsDist = useMemo(() => calcNightsDistribution(filteredData), [filteredData])
  const leadtimeDist = useMemo(() => calcLeadtimeDistribution(filteredData), [filteredData])
  const roomTypes = useMemo(() => calcRoomTypePreference(filteredData), [filteredData])
  const areaDays = useMemo(() => calcAreaDayPattern(filteredData), [filteredData])
  const channels = useMemo(() => calcChannelDistribution(filteredData), [filteredData])

  const totalCount = filteredData.length
  const totalRevenue = useMemo(() => filteredData.reduce((s, r) => s + (Number(r.payment_amount) || 0), 0), [filteredData])
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

  // 요일별 전체 합산
  const dayTotals = useMemo(() => {
    const totals = Array(7).fill(0)
    filteredData.forEach(r => {
      if (!r.check_in_date) return
      totals[new Date(r.check_in_date).getDay()] += 1
    })
    return totals
  }, [filteredData])

  // 도넛용 채널 색상
  const channelColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899', '#14b8a6']

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

  const showPct = heatmapMode === 'pct'
  const currentHeatmap = heatmapView === 'branch' ? heatmap : areaDays
  const heatmapItems = heatmapView === 'branch' ? heatmap.branches : areaDays.areas
  const heatmapMap = heatmapView === 'branch' ? heatmap.map : areaDays.map
  const heatmapColor = heatmapView === 'branch' ? 'blue' : 'emerald'

  return (
    <div className={`min-h-screen ${t.bg}`}>
      {/* ── Sticky 필터 + 헤더 ── */}
      <div className={`sticky top-0 z-20 ${dark ? 'bg-[#1D2125]/95' : 'bg-slate-50/95'} backdrop-blur-sm border-b ${t.border}`}>
        <div className="px-4 pt-3 pb-2">
          <h1 className={`text-base font-bold ${t.text}`}>📊 이용 패턴 분석</h1>
        </div>
        <div className="px-4 pb-2.5 flex items-center gap-3 flex-wrap">
          <Filter size={13} className={t.muted} />
          <select value={selectedArea} onChange={e => setSelectedArea(e.target.value)}
            className={`text-xs rounded-lg px-2.5 py-1 border outline-none ${t.input} ${t.inputFocus}`}>
            <option value="">전체 권역</option>
            {areaList.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
            className={`text-xs rounded-lg px-2.5 py-1 border outline-none ${t.input} ${t.inputFocus}`}>
            <option value="">전체 지점</option>
            {branchList.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {(selectedArea || selectedBranch) && (
            <button onClick={() => { setSelectedArea(''); setSelectedBranch('') }}
              className={`text-[11px] px-2 py-0.5 rounded ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
              초기화
            </button>
          )}
          <span className={`text-[11px] ml-auto ${t.muted}`}>{fmtNum(totalCount)}건</span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-6 space-y-3">
        {/* ── KPI 요약 ── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: '예약건', value: fmtNum(totalCount), sub: '건', icon: <Calendar size={13}/>, color: 'text-blue-500 bg-blue-500/10' },
            { label: '평균숙박', value: avgNights.toFixed(1), sub: '박', icon: <Bed size={13}/>, color: 'text-violet-500 bg-violet-500/10' },
            { label: '리드타임', value: Math.round(avgLeadTime), sub: '일', icon: <Clock size={13}/>, color: 'text-amber-500 bg-amber-500/10' },
            { label: '투숙객', value: avgPeoples.toFixed(1), sub: '명', icon: <Home size={13}/>, color: 'text-emerald-500 bg-emerald-500/10' },
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

        {/* ── 요일별 전체 분포 (미니 바) ── */}
        <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className={`text-xs font-semibold ${t.text}`}>요일별 체크인 분포</h2>
            <span className={`text-[11px] ${t.muted}`}>전체 {fmtNum(totalCount)}건</span>
          </div>
          <div className="flex items-end gap-1" style={{ height: 60 }}>
            {dayTotals.map((v, i) => {
              const maxD = Math.max(...dayTotals)
              const h = maxD > 0 ? (v / maxD * 100) : 0
              const pct = totalCount > 0 ? (v / totalCount * 100) : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className={`text-[9px] font-bold ${t.text}`}>{fmtPct(pct)}</span>
                  <div className="w-full rounded-t" style={{ height: `${h}%`, minHeight: v > 0 ? 4 : 0 }}>
                    <div className={`w-full h-full rounded-t ${i === 0 ? 'bg-red-400' : i === 6 ? 'bg-blue-400' : 'bg-slate-400'} opacity-70`} />
                  </div>
                  <span className={`text-[10px] font-semibold ${DAYS_COLOR[i] || t.sub}`}>{DAYS_KR[i]}</span>
                  <span className={`text-[9px] ${t.muted}`}>{fmtNum(v)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 체크인 요일 히트맵 (지점/권역 토글 + 건수/비율 토글) ── */}
        <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
          <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              {['branch', 'area'].map(m => (
                <button key={m} onClick={() => setHeatmapView(m)}
                  className={`text-[11px] px-2 py-0.5 rounded font-medium transition-all
                    ${heatmapView === m
                      ? 'bg-[#0C66E4] text-white'
                      : dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                  {m === 'branch' ? '지점별' : '권역별'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setHeatmapMode('count')}
                className={`p-1 rounded transition-all ${heatmapMode === 'count' ? 'bg-blue-500/20 text-blue-400' : t.muted}`}
                title="건수">
                <BarChart3 size={12} />
              </button>
              <button onClick={() => setHeatmapMode('pct')}
                className={`p-1 rounded transition-all ${heatmapMode === 'pct' ? 'bg-blue-500/20 text-blue-400' : t.muted}`}
                title="비율">
                <Percent size={12} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                  <th className={`px-2 py-1.5 text-left font-semibold ${t.sub} min-w-[100px]`}>
                    {heatmapView === 'branch' ? '지점' : '권역'}
                  </th>
                  {DAYS_KR.map((d, i) => (
                    <th key={d} className={`px-1.5 py-1.5 text-center font-semibold w-10 ${DAYS_COLOR[i] || t.sub}`}>{d}</th>
                  ))}
                  <th className={`px-2 py-1.5 text-center font-semibold ${t.sub} w-14`}>합계</th>
                </tr>
              </thead>
              <tbody>
                {heatmapItems.slice(0, 25).map(item => {
                  const row = heatmapMap[item]
                  const rowMax = Math.max(...row)
                  const rowTotal = row.reduce((s, v) => s + v, 0)
                  return (
                    <tr key={item} className={`border-t ${t.border}`}>
                      <td className={`px-2 py-1 font-medium whitespace-nowrap truncate max-w-[140px] ${t.text}`}>{item}</td>
                      {row.map((v, di) => (
                        <HeatCell key={di} value={v} rowTotal={rowTotal} rowMax={rowMax}
                          showPct={showPct} colorScheme={heatmapColor} dark={dark} />
                      ))}
                      <td className={`px-2 py-1 text-center font-bold text-[11px] ${t.sub}`}>{fmtNum(rowTotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 숙박일수 + 리드타임 (2컬럼) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 숙박일수 */}
          <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
            <h2 className={`text-xs font-semibold mb-2 ${t.text}`}>🛏️ 숙박일수 분포</h2>
            <div className="space-y-1.5">
              {nightsDist.map((row, i) => {
                const maxCount = Math.max(...nightsDist.map(r => r.count))
                const pct = totalCount > 0 ? row.count / totalCount * 100 : 0
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold w-7 ${t.text}`}>{row.nights}</span>
                    <PctBar value={row.count} max={maxCount} color="from-violet-500 to-violet-400" height="h-3.5" />
                    <span className={`text-[11px] font-bold w-12 text-right ${t.text}`}>{fmtNum(row.count)}</span>
                    <span className={`text-[10px] w-10 text-right font-medium ${pct > 30 ? 'text-violet-400' : t.muted}`}>{fmtPct(pct)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 리드타임 */}
          <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
            <h2 className={`text-xs font-semibold mb-2 ${t.text}`}>⏱️ 예약 리드타임</h2>
            <div className="space-y-1.5">
              {leadtimeDist.map((row, i) => {
                const maxCount = Math.max(...leadtimeDist.map(r => r.count))
                const pct = totalCount > 0 ? row.count / totalCount * 100 : 0
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[11px] font-semibold w-12 ${t.text}`}>{row.label}</span>
                    <PctBar value={row.count} max={maxCount} color="from-amber-500 to-amber-400" height="h-3.5" />
                    <span className={`text-[11px] font-bold w-12 text-right ${t.text}`}>{fmtNum(row.count)}</span>
                    <span className={`text-[10px] w-10 text-right font-medium ${pct > 25 ? 'text-amber-400' : t.muted}`}>{fmtPct(pct)}</span>
                  </div>
                )
              })}
            </div>
            {/* 리드타임별 매출 요약 */}
            <div className={`mt-2 pt-2 border-t ${t.border} grid grid-cols-3 gap-1`}>
              {leadtimeDist.filter(b => b.count > 0).slice(0, 3).map((b, i) => (
                <div key={i} className="text-center">
                  <div className={`text-[10px] ${t.muted}`}>{b.label}</div>
                  <div className={`text-[11px] font-bold ${t.text}`}>{fmtKRW(b.count > 0 ? b.revenue / b.count : 0)}</div>
                  <div className={`text-[9px] ${t.muted}`}>건당 매출</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 채널 분포 + 객실 타입 (2컬럼) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 채널 분포 (도넛 + 리스트) */}
          <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
            <h2 className={`text-xs font-semibold mb-2 ${t.text}`}>📡 채널 분포</h2>
            <div className="flex items-start gap-3">
              <MiniDonut
                size={64}
                thickness={8}
                segments={channels.slice(0, 6).map((ch, i) => ({
                  value: ch.count,
                  color: channelColors[i % channelColors.length],
                }))}
              />
              <div className="flex-1 space-y-1">
                {channels.slice(0, 6).map((ch, i) => {
                  const pct = totalCount > 0 ? ch.count / totalCount * 100 : 0
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: channelColors[i % channelColors.length] }} />
                      <span className={`text-[11px] truncate flex-1 ${t.text}`}>{ch.channel}</span>
                      <span className={`text-[10px] font-bold ${t.text}`}>{fmtPct(pct)}</span>
                      <span className={`text-[10px] ${t.muted}`}>{fmtNum(ch.count)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 객실 타입 Top 8 */}
          <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
            <div className={`px-3 py-2 border-b ${t.border}`}>
              <h2 className={`text-xs font-semibold ${t.text}`}>🏨 객실 타입 Top 8</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className={dark ? 'bg-[#2C333A]' : 'bg-slate-50'}>
                    {['객실', '건수', '비중', '매출', '건당'].map(h => (
                      <th key={h} className={`px-2 py-1.5 text-left font-semibold ${t.sub}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roomTypes.slice(0, 8).map((row, i) => {
                    const pct = totalCount > 0 ? row.count / totalCount * 100 : 0
                    const totalRev = roomTypes.reduce((s, r) => s + r.revenue, 0)
                    const revPct = totalRev > 0 ? row.revenue / totalRev * 100 : 0
                    return (
                      <tr key={i} className={`border-t ${t.border}`}>
                        <td className={`px-2 py-1.5 font-medium truncate max-w-[120px] ${t.text}`}>{row.type}</td>
                        <td className={`px-2 py-1.5 ${t.text}`}>{fmtNum(row.count)}</td>
                        <td className={`px-2 py-1.5`}>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold
                            ${pct > 20 ? 'bg-blue-500/20 text-blue-400' : dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            {fmtPct(pct)}
                          </span>
                        </td>
                        <td className={`px-2 py-1.5 ${t.text}`}>{fmtKRW(row.revenue)}</td>
                        <td className={`px-2 py-1.5 ${t.muted}`}>{fmtKRW(row.count > 0 ? row.revenue / row.count : 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
