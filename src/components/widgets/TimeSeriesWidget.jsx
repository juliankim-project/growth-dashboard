import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { METRICS } from '../../store/useConfig'
import { dailyData, fmtW, CHART_COLORS } from './widgetUtils'

function Tip({ active, payload, label, dark }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`rounded-xl px-4 py-3 shadow-xl text-xs border ${dark ? 'bg-[#1A1D27] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-0.5">
          <span style={{ color: p.color }}>●</span>
          <span className={dark ? 'text-slate-400' : 'text-slate-500'}>{p.name}</span>
          <span className="font-bold">{typeof p.value === 'number' ? fmtW(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function TimeSeriesWidget({ data, config, dark }) {
  const { metrics = ['cost','revenue'], title = '일별 트렌드' } = config

  const chartData = useMemo(() => dailyData(data, metrics), [data, metrics])
  const tick  = dark ? '#64748B' : '#94A3B8'
  const grid  = dark ? '#1E2130' : '#F1F5F9'

  return (
    <div className={`rounded-xl p-5 border h-full flex flex-col ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-xs font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top:5, right:10, left:0, bottom:0 }}>
            <defs>
              {metrics.map((m, i) => (
                <linearGradient key={m} id={`grad_${m}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CHART_COLORS[i]} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid}/>
            <XAxis dataKey="label" tick={{ fill:tick, fontSize:10 }} tickLine={false}/>
            <YAxis tick={{ fill:tick, fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={v => fmtW(v)} width={44}/>
            <Tooltip content={<Tip dark={dark}/>}/>
            <Legend wrapperStyle={{ fontSize:11, color:tick }}/>
            {metrics.map((m, i) => {
              const meta = METRICS.find(x => x.id === m)
              return (
                <Area key={m} type="monotone" dataKey={m} name={meta?.label || m}
                  stroke={CHART_COLORS[i]} fill={`url(#grad_${m})`} strokeWidth={2} dot={false}/>
              )
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
