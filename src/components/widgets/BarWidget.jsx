import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { METRICS } from '../../store/useConfig'
import { groupData, fmtW, CHART_COLORS } from './widgetUtils'

function Tip({ active, payload, label, dark }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`rounded-xl px-4 py-3 shadow-xl text-xs border ${dark ? 'bg-[#1A1D27] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-0.5">
          <span style={{ color: p.color }}>●</span>
          <span className="font-bold">{fmtW(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function BarWidget({ data, config, dark }) {
  const { metric = 'cost', groupBy = 'Channel', title = '채널별 성과' } = config

  const chartData = useMemo(() => {
    const grouped = groupData(data, groupBy, [metric])
    return grouped.sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).slice(0, 10)
  }, [data, metric, groupBy])

  const tick = dark ? '#64748B' : '#94A3B8'
  const grid = dark ? '#1E2130' : '#F1F5F9'
  const meta = METRICS.find(x => x.id === metric)

  return (
    <div className={`rounded-xl p-5 border h-full flex flex-col ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-xs font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top:5, right:10, left:0, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid}/>
            <XAxis dataKey="name" tick={{ fill:tick, fontSize:9 }} tickLine={false}/>
            <YAxis tick={{ fill:tick, fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={v => fmtW(v)} width={44}/>
            <Tooltip content={<Tip dark={dark}/>}/>
            <Bar dataKey={metric} name={meta?.label || metric} fill={CHART_COLORS[0]} radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
