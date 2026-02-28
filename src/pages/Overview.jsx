import { useMemo } from 'react'
import {
  DollarSign, Users, ShoppingCart, TrendingUp,
  Megaphone, Target
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import KPICard from '../components/UI/KPICard'
import Spinner from '../components/UI/Spinner'
import { useMarketingData } from '../hooks/useMarketingData'

/* ────────────── helpers ────────────── */
const fmt = n => n == null ? '—' : n.toLocaleString('ko-KR')
const fmtW = n => {
  if (n == null) return '—'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 100_000_000)   return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000)        return (n / 10_000).toFixed(1) + '만'
  return n.toLocaleString('ko-KR')
}
const sum = (arr, key) => arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0)

const CHANNEL_COLORS = {
  Meta:        '#4267B2',
  Google:      '#EA4335',
  Naver:       '#03C75A',
  Naver_PL:    '#03C75A',
  Naver_Brand: '#00A0B0',
}

/* ────────────── 커스텀 툴팁 ────────────── */
function CustomTooltip({ active, payload, label, dark }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`
      rounded-xl px-4 py-3 shadow-xl text-xs border
      ${dark ? 'bg-[#1A1D27] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}
    `}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mt-0.5">
          <span style={{ color: p.color }}>●</span>
          <span className={dark ? 'text-slate-400' : 'text-slate-500'}>{p.name}</span>
          <span className="font-bold ml-1">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ────────────── 메인 컴포넌트 ────────────── */
export default function Overview({ dark, filterByDate }) {
  const { data: rawData, loading, error } = useMarketingData()

  /* filterByDate 적용 */
  const data = useMemo(
    () => (filterByDate ? filterByDate(rawData) : rawData),
    [rawData, filterByDate]
  )

  /* 날짜별 집계 */
  const { kpis, dailyData, channelData } = useMemo(() => {
    if (!data.length) return { kpis: {}, dailyData: [], channelData: [] }

    const totalCost    = sum(data, 'Cost (Channel)')
    const totalInstall = sum(data, 'Installs (App)')
    const totalConv    = sum(data, '구매 완료 (App+Web)')
    const totalRev     = sum(data, '구매액 (App+Web)')
    const totalSignup  = sum(data, '회원가입 (App+Web)')
    const roas         = totalCost > 0 ? (totalRev / totalCost) : 0

    /* 일별 집계 (filterByDate 이미 적용됐으므로 slice 불필요) */
    const byDate = {}
    data.forEach(r => {
      const d = r['Event Date']?.slice(0, 10)
      if (!d) return
      if (!byDate[d]) byDate[d] = { date: d, cost: 0, revenue: 0, installs: 0 }
      byDate[d].cost     += parseFloat(r['Cost (Channel)'])   || 0
      byDate[d].revenue  += parseFloat(r['구매액 (App+Web)']) || 0
      byDate[d].installs += parseFloat(r['Installs (App)'])   || 0
    })
    const dailyData = Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label:   d.date.slice(5),
        cost:    Math.round(d.cost),
        revenue: Math.round(d.revenue),
      }))

    /* 채널별 집계 */
    const byChan = {}
    data.forEach(r => {
      const ch = r['Channel'] || '기타'
      if (!byChan[ch]) byChan[ch] = { channel: ch, cost: 0, installs: 0, revenue: 0 }
      byChan[ch].cost     += parseFloat(r['Cost (Channel)'])   || 0
      byChan[ch].installs += parseFloat(r['Installs (App)'])   || 0
      byChan[ch].revenue  += parseFloat(r['구매액 (App+Web)']) || 0
    })
    const channelData = Object.values(byChan).sort((a, b) => b.cost - a.cost)

    return {
      kpis: { totalCost, totalInstall, totalConv, totalRev, totalSignup, roas },
      dailyData,
      channelData,
    }
  }, [data])

  const tick = dark ? '#64748B' : '#94A3B8'
  const grid = dark ? '#1E2130' : '#F1F5F9'

  if (loading) return <Spinner dark={dark} />
  if (error)   return (
    <div className="flex items-center justify-center h-full">
      <p className="text-red-400 text-sm">오류: {error}</p>
    </div>
  )

  return (
    <div className="p-6 flex flex-col gap-6">

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard dark={dark} label="총 광고비"    value={fmtW(kpis.totalCost)}      icon={DollarSign}   color="indigo" />
        <KPICard dark={dark} label="총 매출"      value={fmtW(kpis.totalRev)}       icon={TrendingUp}   color="green"  />
        <KPICard dark={dark} label="ROAS"         value={kpis.roas?.toFixed(2)+'x'} icon={Target}       color="purple" />
        <KPICard dark={dark} label="인스톨"       value={fmt(kpis.totalInstall)}    icon={Megaphone}    color="blue"   />
        <KPICard dark={dark} label="구매 완료"    value={fmt(kpis.totalConv)}       icon={ShoppingCart} color="orange" />
        <KPICard dark={dark} label="회원가입"     value={fmt(kpis.totalSignup)}     icon={Users}        color="indigo" />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* 일별 비용/매출 트렌드 */}
        <div className={`
          xl:col-span-2 rounded-xl p-5 border
          ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}
        `}>
          <p className={`text-sm font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>
            일별 광고비 vs 매출
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" tick={{ fill: tick, fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: tick, fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => fmtW(v)} width={48} />
              <Tooltip content={<CustomTooltip dark={dark} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: tick }} />
              <Area type="monotone" dataKey="cost"    name="광고비" stroke="#6366F1" fill="url(#gCost)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="revenue" name="매출"   stroke="#10B981" fill="url(#gRev)"  strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 채널별 비용 */}
        <div className={`
          rounded-xl p-5 border
          ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}
        `}>
          <p className={`text-sm font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>
            채널별 광고비
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={channelData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: tick, fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => fmtW(v)} />
              <YAxis type="category" dataKey="channel" tick={{ fill: tick, fontSize: 10 }} tickLine={false} width={70} />
              <Tooltip content={<CustomTooltip dark={dark} />} />
              <Bar dataKey="cost" name="광고비" fill="#6366F1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 채널 요약 테이블 */}
      <div className={`
        rounded-xl border overflow-hidden
        ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}
      `}>
        <div className={`px-5 py-4 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>
            채널별 성과 요약
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={dark ? 'bg-[#13151C]' : 'bg-slate-50'}>
                {['채널', '광고비', '인스톨', '구매', '매출', 'ROAS'].map(h => (
                  <th key={h} className={`
                    px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide
                    ${dark ? 'text-slate-500' : 'text-slate-400'}
                  `}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelData.map(ch => {
                const roas = ch.cost > 0 ? (ch.revenue / ch.cost).toFixed(2) : '—'
                return (
                  <tr key={ch.channel} className={`
                    border-t transition-colors
                    ${dark
                      ? 'border-[#252836] hover:bg-[#13151C]'
                      : 'border-slate-100 hover:bg-slate-50'}
                  `}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{
                          background: CHANNEL_COLORS[ch.channel] || '#6366F1'
                        }} />
                        <span className={`font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>
                          {ch.channel}
                        </span>
                      </div>
                    </td>
                    <td className={`px-5 py-3 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtW(ch.cost)}</td>
                    <td className={`px-5 py-3 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmt(ch.installs)}</td>
                    <td className={`px-5 py-3 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {fmt(ch.revenue > 0 ? Math.round(ch.revenue / 10000) : 0)}건
                    </td>
                    <td className={`px-5 py-3 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtW(ch.revenue)}</td>
                    <td className="px-5 py-3">
                      <span className={`
                        text-xs font-bold px-2 py-0.5 rounded-full
                        ${parseFloat(roas) >= 2
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-orange-500/10 text-orange-500'}
                      `}>{roas}x</span>
                    </td>
                  </tr>
                )
              })}
              {channelData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-xs">
                    선택한 기간에 데이터가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
