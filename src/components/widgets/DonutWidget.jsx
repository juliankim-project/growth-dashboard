import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { METRICS } from '../../store/useConfig'
import { groupData, fmtW, CHART_COLORS } from './widgetUtils'

export default function DonutWidget({ data, config, dark }) {
  const { metric = 'cost', groupBy = 'Channel', title = '구성 비율' } = config

  const chartData = useMemo(() => {
    const grouped = groupData(data, groupBy, [metric])
    return grouped
      .filter(r => (r[metric] || 0) > 0)
      .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
      .slice(0, 6)
  }, [data, metric, groupBy])

  const meta = METRICS.find(x => x.id === metric)

  return (
    <div className={`rounded-xl p-5 border h-full flex flex-col ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-xs font-semibold mb-2 ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey={metric} nameKey="name"
              cx="50%" cy="50%" innerRadius="40%" outerRadius="70%"
              paddingAngle={3}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]}/>
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n) => [fmtW(v), n]}
              contentStyle={{
                background: dark ? '#1A1D27' : '#fff',
                border: dark ? '1px solid #252836' : '1px solid #e2e8f0',
                borderRadius: 10, fontSize: 11, color: dark ? '#e2e8f0' : '#334155'
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: dark ? '#64748B' : '#94A3B8' }}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
