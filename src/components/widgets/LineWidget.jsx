import { useMemo, useState, memo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { dailyData, fmtAxis, fmtMetric, CHART_COLORS } from './widgetUtils'

const TIME_GROUPS = [
  { id: 'day', label: '일' },
  { id: 'week', label: '주' },
  { id: 'month', label: '월' },
]

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
            {isDual && <span className="ml-1 text-xs opacity-60">({rightSet?.has(p.dataKey) ? '우' : '좌'})</span>}
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
    title = '트렌드',
    axisMode = 'single',
    rightMetrics = [],
    timeGroup: cfgTimeGroup,
  } = config

  const [timeGroup, setTimeGroup] = useState(cfgTimeGroup || 'day')
  const chartData = useMemo(() => dailyData(data, metrics, metricsProp, dateColumn, timeGroup), [data, metrics, metricsProp, dateColumn, timeGroup])
  const tick  = dark ? '#64748B' : '#475569'
  const grid  = dark ? '#1E2130' : '#F1F5F9'

  // 최적화: rightSet 계산을 한 번만, 메모이제이션 개선
  const rightSet = useMemo(() => new Set(rightMetrics), [rightMetrics])
  const leftMets = useMemo(() => metrics.filter(m => !rightSet.has(m)), [metrics, rightSet])
  const isDual = useMemo(
    () => axisMode === 'dual' && rightMetrics.length > 0 && leftMets.length > 0,
    [axisMode, rightMetrics.length, leftMets.length]
  )

  /* 축별 포맷터 — primary metric의 fmt 기반 (메모이제이션) */
  const fmtLeft = useMemo(
    () => v => fmtAxis(v, leftMets[0] || metrics[0], metricsProp),
    [leftMets, metrics, metricsProp]
  )
  const fmtRight = useMemo(
    () => v => fmtAxis(v, rightMetrics[0], metricsProp),
    [rightMetrics, metricsProp]
  )

  return (
    <div className={`rounded-xl p-4 border h-full overflow-hidden flex flex-col ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
        <div className={`flex items-center rounded-md p-0.5 ${dark ? 'bg-[#1D2125]' : 'bg-slate-100'}`}>
          {TIME_GROUPS.map(tg => (
            <button key={tg.id} onClick={(e) => { e.stopPropagation(); setTimeGroup(tg.id) }}
              className={`text-[10px] px-2 py-0.5 rounded font-medium transition-all
                ${timeGroup === tg.id
                  ? `${dark ? 'bg-[#22272B] text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm'}`
                  : `${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}`}>
              {tg.label}
            </button>
          ))}
        </div>
      </div>
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
