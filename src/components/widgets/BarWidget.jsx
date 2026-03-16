import { useMemo, memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { groupData, fmtAxis, fmtMetric, CHART_COLORS } from './widgetUtils'

function Tip({ active, payload, label, dark, metric, metricsProp }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`rounded-xl px-4 py-3 shadow-xl text-xs border ${dark ? 'bg-[#22272B] border-[#A1BDD914] text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-0.5">
          <span style={{ color: p.color }}>●</span>
          <span className="font-bold">{typeof p.value === 'number' ? fmtMetric(metric, p.value, metricsProp) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function BarWidget({ data, config, dark, metrics: metricsProp }) {
  const { metric = 'cost', groupBy = 'channel', title = '채널별 성과' } = config

  const chartData = useMemo(() => {
    const grouped = groupData(data, groupBy, [metric], metricsProp)
    return grouped.sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).slice(0, 10)
  }, [data, metric, groupBy, metricsProp])

  const tick = dark ? '#64748B' : '#475569'
  const grid = dark ? '#1E2130' : '#F1F5F9'
  const meta = metricsProp?.find(x => x.id === metric)

  const fmtYAxis = v => fmtAxis(v, metric, metricsProp)

  return (
    <div className={`rounded-xl p-5 border h-full flex flex-col ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-xs font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top:5, right:10, left:5, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid}/>
            <XAxis dataKey="name" tick={{ fill:tick, fontSize:9 }} tickLine={false}/>
            <YAxis tick={{ fill:tick, fontSize:10 }} tickLine={false} axisLine={false} tickFormatter={fmtYAxis} width={90}/>
            <Tooltip content={<Tip dark={dark} metric={metric} metricsProp={metricsProp}/>}/>
            <Bar dataKey={metric} name={meta?.label || metric} fill={CHART_COLORS[0]} radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default memo(BarWidget)
