import { useState, useEffect, useMemo } from 'react'
import { fetchProductData } from './fetchData'
import { RefreshCw, Filter, Calendar, Clock, BarChart3 } from 'lucide-react'

const fmtNum = v => Math.round(v).toLocaleString()
const fmtKRW = v => {
  if (v >= 1e8) return (v / 1e8).toFixed(1) + '억'
  if (v >= 1e4) return (v / 1e4).toFixed(0) + '만'
  return Math.round(v).toLocaleString()
}

/* ─── 날짜 유틸 ─── */
function toDateStr(d) { return d.toISOString().slice(0, 10) }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function getWeekKey(dateStr) {
  const d = new Date(dateStr)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
function getMonthKey(dateStr) { return dateStr.slice(0, 7) }

/* ─── 매트릭스 계산: 예약일(row) × 체크인일(col) ─── */
function buildPaceMatrix(data, unit) {
  const getKey = unit === 'day' ? (d => d) : unit === 'week' ? getWeekKey : getMonthKey

  const matrix = {} // { reservationKey: { checkinKey: { count, revenue } } }
  const checkinKeys = new Set()
  const reservationKeys = new Set()

  data.forEach(r => {
    if (!r.reservation_date || !r.check_in_date) return
    const resKey = getKey(r.reservation_date.slice(0, 10))
    const ciKey = getKey(r.check_in_date.slice(0, 10))
    reservationKeys.add(resKey)
    checkinKeys.add(ciKey)
    if (!matrix[resKey]) matrix[resKey] = {}
    if (!matrix[resKey][ciKey]) matrix[resKey][ciKey] = { count: 0, revenue: 0 }
    matrix[resKey][ciKey].count += 1
    matrix[resKey][ciKey].revenue += Number(r.payment_amount) || 0
  })

  const sortedCheckinKeys = [...checkinKeys].sort()
  const sortedReservationKeys = [...reservationKeys].sort()

  return { matrix, checkinKeys: sortedCheckinKeys, reservationKeys: sortedReservationKeys }
}

/* ─── 리드타임 매트릭스: 체크인일(row) × 리드타임 구간(col) ─── */
const LT_BUCKETS = [
  { label: '당일', min: 0, max: 0 },
  { label: '1-3일', min: 1, max: 3 },
  { label: '4-7일', min: 4, max: 7 },
  { label: '8-14일', min: 8, max: 14 },
  { label: '15-30일', min: 15, max: 30 },
  { label: '31-60일', min: 31, max: 60 },
  { label: '61일+', min: 61, max: Infinity },
]

function buildLeadtimeMatrix(data, unit) {
  const getKey = unit === 'day' ? (d => d) : unit === 'week' ? getWeekKey : getMonthKey

  const matrix = {} // { checkinKey: { bucketIdx: { count, revenue } } }
  const checkinKeys = new Set()

  data.forEach(r => {
    if (!r.check_in_date) return
    const lt = Number(r.lead_time)
    if (isNaN(lt) || lt < 0) return
    const ciKey = getKey(r.check_in_date.slice(0, 10))
    checkinKeys.add(ciKey)
    const bi = LT_BUCKETS.findIndex(b => lt >= b.min && lt <= b.max)
    if (bi < 0) return
    if (!matrix[ciKey]) matrix[ciKey] = {}
    if (!matrix[ciKey][bi]) matrix[ciKey][bi] = { count: 0, revenue: 0 }
    matrix[ciKey][bi].count += 1
    matrix[ciKey][bi].revenue += Number(r.payment_amount) || 0
  })

  return { matrix, checkinKeys: [...checkinKeys].sort() }
}

/* ─── 히트맵 셀 색상 ─── */
function getCellBg(value, maxValue, dark) {
  if (!value || value === 0) return ''
  const intensity = maxValue > 0 ? value / maxValue : 0
  if (intensity > 0.8) return 'bg-blue-600 text-white'
  if (intensity > 0.6) return 'bg-blue-500 text-white'
  if (intensity > 0.4) return dark ? 'bg-blue-500/40 text-blue-200' : 'bg-blue-300 text-blue-900'
  if (intensity > 0.2) return dark ? 'bg-blue-500/25 text-blue-300' : 'bg-blue-200 text-blue-800'
  if (intensity > 0) return dark ? 'bg-blue-500/10' : 'bg-blue-50'
  return ''
}

export default function CheckinPace({ dark, dateRange }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedArea, setSelectedArea] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [unit, setUnit] = useState('month') // day | week | month
  const [viewMode, setViewMode] = useState('pace') // pace | leadtime
  const [cellValue, setCellValue] = useState('count') // count | revenue

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

  // 매트릭스 데이터
  const paceData = useMemo(() => buildPaceMatrix(filteredData, unit), [filteredData, unit])
  const ltData = useMemo(() => buildLeadtimeMatrix(filteredData, unit), [filteredData, unit])

  // 전체 최대값 (히트맵 색상용)
  const paceMax = useMemo(() => {
    let max = 0
    const { matrix, reservationKeys, checkinKeys } = paceData
    reservationKeys.forEach(rk => {
      checkinKeys.forEach(ck => {
        const cell = matrix[rk]?.[ck]
        const v = cellValue === 'count' ? cell?.count : cell?.revenue
        if (v > max) max = v
      })
    })
    return max
  }, [paceData, cellValue])

  const ltMax = useMemo(() => {
    let max = 0
    const { matrix, checkinKeys } = ltData
    checkinKeys.forEach(ck => {
      LT_BUCKETS.forEach((_, bi) => {
        const cell = matrix[ck]?.[bi]
        const v = cellValue === 'count' ? cell?.count : cell?.revenue
        if (v > max) max = v
      })
    })
    return max
  }, [ltData, cellValue])

  // KPI
  const totalCount = filteredData.length
  const totalRevenue = useMemo(() => filteredData.reduce((s, r) => s + (Number(r.payment_amount) || 0), 0), [filteredData])
  const avgLeadTime = useMemo(() => {
    const valid = filteredData.filter(r => r.lead_time != null && r.lead_time >= 0)
    return valid.length > 0 ? valid.reduce((s, r) => s + Number(r.lead_time), 0) / valid.length : 0
  }, [filteredData])

  const t = dark
    ? { bg: 'bg-[#1D2125]', card: 'bg-[#22272B]', border: 'border-[#A1BDD914]', text: 'text-white', sub: 'text-slate-400', muted: 'text-slate-500',
        input: 'bg-[#2C333A] border-[#A1BDD914] text-white', inputFocus: 'focus:border-blue-500',
        headerBg: dark ? 'bg-[#2C333A]' : 'bg-slate-50' }
    : { bg: 'bg-slate-50', card: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', sub: 'text-slate-600', muted: 'text-slate-400',
        input: 'bg-white border-slate-200 text-slate-800', inputFocus: 'focus:border-blue-500',
        headerBg: 'bg-slate-50' }

  if (loading) return (
    <div className={`flex items-center justify-center h-96 ${t.text}`}>
      <RefreshCw size={20} className="animate-spin mr-2" /> 데이터 로딩 중...
    </div>
  )
  if (error) return <div className="text-red-500 p-6">에러: {error}</div>

  const unitLabels = { day: '일', week: '주', month: '월' }
  const viewLabels = { pace: '예약×체크인', leadtime: '리드타임' }

  return (
    <div className={`min-h-screen ${t.bg}`}>
      {/* ── Sticky 헤더 + 필터 ── */}
      <div className={`sticky top-0 z-20 ${dark ? 'bg-[#1D2125]/95' : 'bg-slate-50/95'} backdrop-blur-sm border-b ${t.border}`}>
        <div className="px-4 pt-3 pb-1.5">
          <h1 className={`text-base font-bold ${t.text}`}>📅 체크인 페이스</h1>
        </div>
        <div className="px-4 pb-2.5 flex items-center gap-2 flex-wrap">
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

          <div className="ml-auto flex items-center gap-1.5">
            {/* 뷰 모드 */}
            {Object.entries(viewLabels).map(([k, v]) => (
              <button key={k} onClick={() => setViewMode(k)}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-all
                  ${viewMode === k ? 'bg-blue-500 text-white' : dark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                {v}
              </button>
            ))}
            <div className={`w-px h-4 mx-1 ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
            {/* 단위 */}
            {Object.entries(unitLabels).map(([k, v]) => (
              <button key={k} onClick={() => setUnit(k)}
                className={`text-[11px] px-2 py-0.5 rounded font-medium transition-all
                  ${unit === k ? 'bg-blue-500 text-white' : dark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>
                {v}
              </button>
            ))}
            <div className={`w-px h-4 mx-1 ${dark ? 'bg-slate-600' : 'bg-slate-300'}`} />
            {/* 건수/매출 */}
            <button onClick={() => setCellValue(cellValue === 'count' ? 'revenue' : 'count')}
              className={`text-[11px] px-2 py-0.5 rounded font-medium ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
              {cellValue === 'count' ? '건수' : '매출'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 pb-6 space-y-3">
        {/* ── KPI ── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '총 예약건', value: fmtNum(totalCount) + '건', icon: <Calendar size={13} />, color: 'text-blue-500 bg-blue-500/10' },
            { label: '총 매출', value: fmtKRW(totalRevenue), icon: <BarChart3 size={13} />, color: 'text-emerald-500 bg-emerald-500/10' },
            { label: '평균 리드타임', value: Math.round(avgLeadTime) + '일', icon: <Clock size={13} />, color: 'text-amber-500 bg-amber-500/10' },
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

        {/* ── 매트릭스 ── */}
        {viewMode === 'pace' ? (
          <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
            <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
              <h2 className={`text-xs font-semibold ${t.text}`}>
                예약일(↓) × 체크인일(→) — {unitLabels[unit]}단위
              </h2>
              <span className={`text-[10px] ${t.muted}`}>
                {cellValue === 'count' ? '건수' : '매출'} 기준
              </span>
            </div>
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              <table className="text-[10px]">
                <thead className={`sticky top-0 z-10 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'}`}>
                  <tr>
                    <th className={`px-2 py-1.5 text-left font-semibold ${t.sub} sticky left-0 z-20 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'} min-w-[80px]`}>
                      예약일 ＼ 체크인
                    </th>
                    {paceData.checkinKeys.map(ck => (
                      <th key={ck} className={`px-1 py-1.5 text-center font-semibold ${t.sub} whitespace-nowrap min-w-[52px]`}>
                        {unit === 'month' ? ck.slice(2) : unit === 'week' ? ck.slice(5) : ck.slice(5)}
                      </th>
                    ))}
                    <th className={`px-2 py-1.5 text-center font-bold ${t.sub} min-w-[52px]`}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {paceData.reservationKeys.map(rk => {
                    const rowTotal = paceData.checkinKeys.reduce((s, ck) => {
                      const cell = paceData.matrix[rk]?.[ck]
                      return s + (cellValue === 'count' ? (cell?.count || 0) : (cell?.revenue || 0))
                    }, 0)
                    return (
                      <tr key={rk} className={`border-t ${t.border}`}>
                        <td className={`px-2 py-1 font-semibold whitespace-nowrap sticky left-0 ${dark ? 'bg-[#22272B]' : 'bg-white'} ${t.text}`}>
                          {unit === 'month' ? rk.slice(2) : unit === 'week' ? rk.slice(5) : rk.slice(5)}
                        </td>
                        {paceData.checkinKeys.map(ck => {
                          const cell = paceData.matrix[rk]?.[ck]
                          const v = cellValue === 'count' ? (cell?.count || 0) : (cell?.revenue || 0)
                          const bg = getCellBg(v, paceMax, dark)
                          return (
                            <td key={ck} className={`px-1 py-1 text-center font-medium ${bg}`}
                              title={cell ? `${fmtNum(cell.count)}건 / ${fmtKRW(cell.revenue)}` : ''}>
                              {v > 0 ? (cellValue === 'count' ? fmtNum(v) : fmtKRW(v)) : ''}
                            </td>
                          )
                        })}
                        <td className={`px-2 py-1 text-center font-bold ${t.sub}`}>
                          {cellValue === 'count' ? fmtNum(rowTotal) : fmtKRW(rowTotal)}
                        </td>
                      </tr>
                    )
                  })}
                  {/* 합계 행 */}
                  <tr className={`border-t-2 ${t.border} font-bold`}>
                    <td className={`px-2 py-1.5 sticky left-0 ${dark ? 'bg-[#22272B]' : 'bg-white'} ${t.text}`}>합계</td>
                    {paceData.checkinKeys.map(ck => {
                      const colTotal = paceData.reservationKeys.reduce((s, rk) => {
                        const cell = paceData.matrix[rk]?.[ck]
                        return s + (cellValue === 'count' ? (cell?.count || 0) : (cell?.revenue || 0))
                      }, 0)
                      return (
                        <td key={ck} className={`px-1 py-1.5 text-center ${t.sub}`}>
                          {colTotal > 0 ? (cellValue === 'count' ? fmtNum(colTotal) : fmtKRW(colTotal)) : ''}
                        </td>
                      )
                    })}
                    <td className={`px-2 py-1.5 text-center ${t.text}`}>
                      {cellValue === 'count' ? fmtNum(totalCount) : fmtKRW(totalRevenue)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── 리드타임 뷰 ── */
          <div className={`rounded-lg border overflow-hidden ${t.card} ${t.border}`}>
            <div className={`px-3 py-2 border-b ${t.border} flex items-center justify-between`}>
              <h2 className={`text-xs font-semibold ${t.text}`}>
                체크인일(↓) × 리드타임 구간(→) — {unitLabels[unit]}단위
              </h2>
              <span className={`text-[10px] ${t.muted}`}>
                {cellValue === 'count' ? '건수' : '매출'} 기준
              </span>
            </div>
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              <table className="text-[10px]">
                <thead className={`sticky top-0 z-10 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'}`}>
                  <tr>
                    <th className={`px-2 py-1.5 text-left font-semibold ${t.sub} sticky left-0 z-20 ${dark ? 'bg-[#2C333A]' : 'bg-slate-50'} min-w-[80px]`}>
                      체크인일
                    </th>
                    {LT_BUCKETS.map(b => (
                      <th key={b.label} className={`px-2 py-1.5 text-center font-semibold ${t.sub} min-w-[60px]`}>{b.label}</th>
                    ))}
                    <th className={`px-2 py-1.5 text-center font-bold ${t.sub} min-w-[52px]`}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {ltData.checkinKeys.map(ck => {
                    const rowTotal = LT_BUCKETS.reduce((s, _, bi) => {
                      const cell = ltData.matrix[ck]?.[bi]
                      return s + (cellValue === 'count' ? (cell?.count || 0) : (cell?.revenue || 0))
                    }, 0)
                    return (
                      <tr key={ck} className={`border-t ${t.border}`}>
                        <td className={`px-2 py-1 font-semibold whitespace-nowrap sticky left-0 ${dark ? 'bg-[#22272B]' : 'bg-white'} ${t.text}`}>
                          {unit === 'month' ? ck.slice(2) : unit === 'week' ? ck.slice(5) : ck.slice(5)}
                        </td>
                        {LT_BUCKETS.map((_, bi) => {
                          const cell = ltData.matrix[ck]?.[bi]
                          const v = cellValue === 'count' ? (cell?.count || 0) : (cell?.revenue || 0)
                          const bg = getCellBg(v, ltMax, dark)
                          return (
                            <td key={bi} className={`px-2 py-1 text-center font-medium ${bg}`}
                              title={cell ? `${fmtNum(cell.count)}건 / ${fmtKRW(cell.revenue)}` : ''}>
                              {v > 0 ? (cellValue === 'count' ? fmtNum(v) : fmtKRW(v)) : ''}
                            </td>
                          )
                        })}
                        <td className={`px-2 py-1 text-center font-bold ${t.sub}`}>
                          {cellValue === 'count' ? fmtNum(rowTotal) : fmtKRW(rowTotal)}
                        </td>
                      </tr>
                    )
                  })}
                  {/* 합계 행 */}
                  <tr className={`border-t-2 ${t.border} font-bold`}>
                    <td className={`px-2 py-1.5 sticky left-0 ${dark ? 'bg-[#22272B]' : 'bg-white'} ${t.text}`}>합계</td>
                    {LT_BUCKETS.map((_, bi) => {
                      const colTotal = ltData.checkinKeys.reduce((s, ck) => {
                        const cell = ltData.matrix[ck]?.[bi]
                        return s + (cellValue === 'count' ? (cell?.count || 0) : (cell?.revenue || 0))
                      }, 0)
                      return (
                        <td key={bi} className={`px-2 py-1.5 text-center ${t.sub}`}>
                          {colTotal > 0 ? (cellValue === 'count' ? fmtNum(colTotal) : fmtKRW(colTotal)) : ''}
                        </td>
                      )
                    })}
                    <td className={`px-2 py-1.5 text-center ${t.text}`}>
                      {cellValue === 'count' ? fmtNum(totalCount) : fmtKRW(totalRevenue)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 범례 ── */}
        <div className={`rounded-lg border p-3 ${t.card} ${t.border}`}>
          <div className="flex items-center gap-4 flex-wrap">
            <span className={`text-[11px] font-semibold ${t.sub}`}>범례:</span>
            {[
              { label: '상위', bg: 'bg-blue-600', text: 'text-white' },
              { label: '중상', bg: 'bg-blue-500', text: 'text-white' },
              { label: '중', bg: dark ? 'bg-blue-500/40' : 'bg-blue-300' },
              { label: '중하', bg: dark ? 'bg-blue-500/25' : 'bg-blue-200' },
              { label: '하', bg: dark ? 'bg-blue-500/10' : 'bg-blue-50' },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`w-4 h-3 rounded ${l.bg}`} />
                <span className={`text-[10px] ${t.muted}`}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
