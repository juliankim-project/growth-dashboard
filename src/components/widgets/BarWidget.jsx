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

  // 최적화: groupData와 정렬 분리
  const grouped = useMemo(() => {
    return groupData(data, groupBy, [metric], metricsProp)
  }, [data, metric, groupBy, metricsProp])

  const chartData = useMemo(() => {
    return grouped.sort((a, b) => (b[metric] || 0) - (a[metric] || 0)).slice(0, 10)
  }, [grouped, metric])

  const tick = dark ? '#64748B' : '#475569'
  const grid = dark ? '#1E2130' : '#F1F5F9'
  const meta = useMemo(
    () => metricsProp?.find(x => x.id === metric),
    [metric, metricsProp]
  )

  const fmtYAxis = useMemo(
    () => v => fmtAxis(v, metric, metricsProp),
    [metric, metricsProp]
  )

  return (
    <div className={`rounded-xl p-4 border h-full overflow-hidden flex flex-col ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-sm font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
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
