import { useMemo, memo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { dailyData, fmtAxis, fmtMetric, CHART_COLORS } from './widgetUtils'

function Tip({ active, payload, label, dark, metricsProp, isDual, rightSet }) {
  if (!active || !payload?.length) return null
  return (
    <div className={`rounded-xl px-4 py-3 shadow-xl text-xs border ${dark ? 'bg-[#22272B] border-[#A1BDD914] text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mt-0.5">
          <span style={{ color: p.color }}>●</span>
          <span className={dark ? 'text-slate-400' : 'text-slate-700'}>
            {p.name}
            {isDual && <span className="ml-1 text-[10px] opacity-60">({rightSet?.has(p.dataKey) ? '우' : '좌'})</span>}
          </span>
          <span className="font-bold">{typeof p.value === 'number' ? fmtMetric(p.dataKey, p.value, metricsProp) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function LineWidget({ data, config, dark, metrics: metricsProp, dateColumn }) {
  const {
    metrics = ['cost','revenue'],
    title = '일별 트렌드',
    axisMode = 'single',
    rightMetrics = [],
  } = config

  const chartData = useMemo(() => dailyData(data, metrics, metricsProp, dateColumn), [data, metrics, metricsProp, dateColumn])
  const tick  = dark ? '#64748B' : '#475569'
  const grid  = dark ? '#1E2130' : '#F1F5F9'

  /* 이중 축 */
  const rightSet = useMemo(() => new Set(rightMetrics), [rightMetrics])
  const leftMets = useMemo(() => metrics.filter(m => !rightSet.has(m)), [metrics, rightSet])
  const isDual = axisMode === 'dual' && rightMetrics.length > 0 && leftMets.length > 0

  /* 축별 포맷터 — primary metric의 fmt 기반 */
  const fmtLeft = v => fmtAxis(v, leftMets[0] || metrics[0], metricsProp)
  const fmtRight = v => fmtAxis(v, rightMetrics[0], metricsProp)

  return (
    <div className={`rounded-xl p-5 border h-full flex flex-col ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-xs font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top:5, right: isDual ? 10 : 10, left:5, bottom:0 }}>
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
            <YAxis yAxisId="left" tick={{ fill:tick, fontSize:10 }} tickLine={false} axisLine={false}
              tickFormatter={fmtLeft} width={90}/>
            {isDual && (
              <YAxis yAxisId="right" orientation="right" tick={{ fill:tick, fontSize:10 }} tickLine={false}
                axisLine={false} tickFormatter={fmtRight} width={90}/>
            )}
            <Tooltip content={<Tip dark={dark} metricsProp={metricsProp} isDual={isDual} rightSet={rightSet}/>}/>
            <Legend wrapperStyle={{ fontSize:11, color:tick }}/>
            {metrics.map((m, i) => {
              const meta = metricsProp?.find(x => x.id === m)
              return (
                <Area key={m} type="monotone" dataKey={m} name={meta?.label || m}
                  yAxisId={isDual && rightSet.has(m) ? 'right' : 'left'}
                  stroke={CHART_COLORS[i]} fill={`url(#grad_${m})`} strokeWidth={2} dot={false}/>
              )
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default memo(LineWidget)
