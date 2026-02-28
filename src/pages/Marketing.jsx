import { useState, useMemo } from 'react'
import { ChevronRight, ChevronLeft, ArrowUpDown } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import Spinner from '../components/UI/Spinner'
import { useMarketingData } from '../hooks/useMarketingData'

/* ────────── helpers ────────── */
const fmtW = n => {
  if (n == null || isNaN(n)) return '—'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000)      return (n / 10_000).toFixed(1) + '만'
  return Math.round(n).toLocaleString()
}
const fmt = n => (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString()
const sum = (arr, key) => arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0)

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
          <span className="font-bold ml-1">{typeof p.value === 'number' ? fmtW(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ────────── 성과 테이블 ────────── */
function PerfTable({ rows, groupKey, dark, onDrill }) {
  const [sort, setSort] = useState({ key: 'cost', dir: -1 })

  const COLS = [
    { key: groupKey,      label: groupKey === 'Campaign' ? '캠페인' : groupKey === 'Ad Group' ? '광고그룹' : '크리에이티브' },
    { key: 'cost',        label: '광고비' },
    { key: 'impressions', label: '노출' },
    { key: 'clicks',      label: '클릭' },
    { key: 'installs',    label: '인스톨' },
    { key: 'conversions', label: '구매' },
    { key: 'revenue',     label: '매출' },
    { key: 'roas',        label: 'ROAS' },
    { key: 'ctr',         label: 'CTR' },
  ]

  const grouped = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      const k = r[groupKey] || '(없음)'
      if (!map[k]) map[k] = { name: k, cost: 0, impressions: 0, clicks: 0, installs: 0, conversions: 0, revenue: 0 }
      map[k].cost        += parseFloat(r['Cost (Channel)'])        || 0
      map[k].impressions += parseFloat(r['Impressions (Channel)']) || 0
      map[k].clicks      += parseFloat(r['Clicks (Channel)'])      || 0
      map[k].installs    += parseFloat(r['Installs (App)'])        || 0
      map[k].conversions += parseFloat(r['구매 완료 (App+Web)'])    || 0
      map[k].revenue     += parseFloat(r['구매액 (App+Web)'])       || 0
    })
    return Object.values(map).map(r => ({
      ...r,
      roas: r.cost > 0 ? r.revenue / r.cost : 0,
      ctr:  r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
    }))
  }, [rows, groupKey])

  const sorted = [...grouped].sort((a, b) => {
    const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0
    return typeof av === 'string'
      ? av.localeCompare(bv) * sort.dir
      : (bv - av) * -sort.dir
  })

  const toggleSort = key => setSort(s =>
    s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }
  )

  return (
    <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={dark ? 'bg-[#13151C]' : 'bg-slate-50'}>
              {COLS.map(c => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`
                    px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide cursor-pointer
                    select-none whitespace-nowrap
                    ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}
                  `}
                >
                  <span className="flex items-center gap-1">
                    {c.label}
                    <ArrowUpDown size={10} className="opacity-40" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr
                key={row.name}
                className={`
                  border-t transition-colors
                  ${dark ? 'border-[#252836] hover:bg-[#13151C]' : 'border-slate-100 hover:bg-slate-50'}
                  ${onDrill ? 'cursor-pointer' : ''}
                `}
                onClick={() => onDrill?.(row.name)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-medium text-xs ${dark ? 'text-white' : 'text-slate-700'}`}>
                      {row.name}
                    </span>
                    {onDrill && <ChevronRight size={12} className="text-indigo-400 opacity-60" />}
                  </div>
                </td>
                <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtW(row.cost)}</td>
                <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmt(row.impressions)}</td>
                <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmt(row.clicks)}</td>
                <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmt(row.installs)}</td>
                <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmt(row.conversions)}</td>
                <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtW(row.revenue)}</td>
                <td className="px-4 py-3">
                  <span className={`
                    text-xs font-bold px-1.5 py-0.5 rounded
                    ${row.roas >= 2 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}
                  `}>{row.roas.toFixed(2)}x</span>
                </td>
                <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {row.ctr.toFixed(2)}%
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs">
                  선택한 기간에 데이터가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ────────── 메인 ────────── */
export default function Marketing({ dark, filterByDate }) {
  const { data: rawData, loading, error } = useMarketingData()

  /* filterByDate 적용 */
  const data = useMemo(
    () => (filterByDate ? filterByDate(rawData) : rawData),
    [rawData, filterByDate]
  )

  /* 채널 목록 */
  const channels = useMemo(() =>
    [...new Set(data.map(r => r['Channel']).filter(Boolean))].sort()
  , [data])

  const [selChannel,  setSelChannel]  = useState(null)
  const [selCampaign, setSelCampaign] = useState(null)
  const [selAdgroup,  setSelAdgroup]  = useState(null)

  /* 자동으로 첫 채널 선택 */
  useMemo(() => {
    if (channels.length && !selChannel) setSelChannel(channels[0])
  }, [channels])

  /* 필터링 */
  const chanData = useMemo(() => data.filter(r => r['Channel'] === selChannel), [data, selChannel])
  const campData = useMemo(() =>
    selCampaign ? chanData.filter(r => r['Campaign'] === selCampaign) : chanData
  , [chanData, selCampaign])
  const agData   = useMemo(() =>
    selAdgroup ? campData.filter(r => r['Ad Group'] === selAdgroup) : campData
  , [campData, selAdgroup])

  /* 채널 KPI */
  const chanKpi = useMemo(() => ({
    cost:    sum(chanData, 'Cost (Channel)'),
    install: sum(chanData, 'Installs (App)'),
    conv:    sum(chanData, '구매 완료 (App+Web)'),
    revenue: sum(chanData, '구매액 (App+Web)'),
  }), [chanData])

  /* 일별 트렌드 (선택 채널, filterByDate 적용됐으므로 slice 불필요) */
  const trendData = useMemo(() => {
    const byDate = {}
    chanData.forEach(r => {
      const d = r['Event Date']?.slice(0, 10)
      if (!d) return
      if (!byDate[d]) byDate[d] = { label: d.slice(5), cost: 0, installs: 0 }
      byDate[d].cost     += parseFloat(r['Cost (Channel)']) || 0
      byDate[d].installs += parseFloat(r['Installs (App)']) || 0
    })
    return Object.values(byDate).sort((a, b) => a.label.localeCompare(b.label))
  }, [chanData])

  const tick = dark ? '#64748B' : '#94A3B8'
  const grid = dark ? '#1E2130' : '#F1F5F9'

  /* 드릴 레벨 */
  const drillLevel = selAdgroup ? 'adgroup' : selCampaign ? 'campaign' : 'overview'

  if (loading) return <Spinner dark={dark} />
  if (error)   return <div className="p-6 text-red-400 text-sm">오류: {error}</div>

  return (
    <div className="p-6 flex flex-col gap-5">

      {/* 채널 탭 */}
      <div className="flex items-center gap-2 flex-wrap">
        {channels.map(ch => (
          <button
            key={ch}
            onClick={() => { setSelChannel(ch); setSelCampaign(null); setSelAdgroup(null) }}
            className={`
              px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${selChannel === ch
                ? 'bg-indigo-600 text-white shadow-sm'
                : dark
                  ? 'bg-[#1A1D27] text-slate-400 hover:text-white border border-[#252836]'
                  : 'bg-white text-slate-500 hover:text-slate-700 border border-slate-200 shadow-sm'
              }
            `}
          >
            {ch}
          </button>
        ))}
        {channels.length === 0 && (
          <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            선택한 기간에 데이터가 없습니다
          </p>
        )}
      </div>

      {/* 브레드크럼 드릴다운 */}
      {(selCampaign || selAdgroup) && (
        <div className={`
          flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg border
          ${dark ? 'bg-[#1A1D27] border-[#252836] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}
        `}>
          <button onClick={() => { setSelCampaign(null); setSelAdgroup(null) }}
            className="text-indigo-500 hover:underline font-medium">{selChannel}</button>
          {selCampaign && <>
            <ChevronRight size={12} />
            <button onClick={() => setSelAdgroup(null)}
              className={selAdgroup ? 'text-indigo-500 hover:underline font-medium' : 'font-medium text-white'}>
              {selCampaign}
            </button>
          </>}
          {selAdgroup && <>
            <ChevronRight size={12} />
            <span className={`font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>{selAdgroup}</span>
          </>}
        </div>
      )}

      {/* 채널 KPI 칩 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '광고비', value: fmtW(chanKpi.cost) },
          { label: '인스톨', value: fmt(chanKpi.install) },
          { label: '구매',   value: fmt(chanKpi.conv) },
          { label: 'ROAS',   value: chanKpi.cost > 0 ? (chanKpi.revenue / chanKpi.cost).toFixed(2) + 'x' : '—' },
        ].map(k => (
          <div key={k.label} className={`
            rounded-xl px-4 py-3 border
            ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}
          `}>
            <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${dark ? 'text-white' : 'text-slate-800'}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* 트렌드 차트 (overview 레벨만) */}
      {drillLevel === 'overview' && trendData.length > 0 && (
        <div className={`rounded-xl p-5 border ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
          <p className={`text-sm font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>
            일별 트렌드 — {selChannel}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} />
              <XAxis dataKey="label" tick={{ fill: tick, fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: tick, fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => fmtW(v)} width={48} />
              <Tooltip content={<CustomTooltip dark={dark} />} />
              <Legend wrapperStyle={{ fontSize: 11, color: tick }} />
              <Line type="monotone" dataKey="cost"     name="광고비" stroke="#6366F1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="installs" name="인스톨" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 드릴다운 테이블 */}
      {drillLevel === 'overview' && (
        <>
          <h3 className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
            캠페인별 성과 <span className="text-indigo-400 text-xs ml-1">← 클릭해서 드릴다운</span>
          </h3>
          <PerfTable rows={chanData} groupKey="Campaign" dark={dark}
            onDrill={name => { setSelCampaign(name); setSelAdgroup(null) }} />
        </>
      )}

      {drillLevel === 'campaign' && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelCampaign(null); setSelAdgroup(null) }}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#13151C]' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              <ChevronLeft size={13} /> 채널로
            </button>
            <h3 className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              광고그룹별 성과 <span className="text-indigo-400 text-xs ml-1">← 클릭해서 드릴다운</span>
            </h3>
          </div>
          <PerfTable rows={campData} groupKey="Ad Group" dark={dark}
            onDrill={name => setSelAdgroup(name)} />
        </>
      )}

      {drillLevel === 'adgroup' && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelAdgroup(null)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#13151C]' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
              <ChevronLeft size={13} /> 광고그룹으로
            </button>
            <h3 className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              크리에이티브별 성과
            </h3>
          </div>
          <PerfTable rows={agData} groupKey="Ad Creative" dark={dark} onDrill={null} />
        </>
      )}
    </div>
  )
}
