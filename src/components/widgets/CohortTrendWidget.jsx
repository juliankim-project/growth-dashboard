import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { buildCohortData } from './CohortHeatmapWidget'

/* ── CohortTrendWidget ── */
export default function CohortTrendWidget({ data, config, dark }) {
  const {
    granularity = 'week',
    cohortEvent = 'signup',
    retentionEvent = 'conv',
    periods = 8,
    title = 'Avg Retention Trend',
  } = config || {}

  const { averages } = useMemo(
    () => buildCohortData(data, granularity, cohortEvent, retentionEvent, periods),
    [data, granularity, cohortEvent, retentionEvent, periods]
  )

  /* unique gradient id so multiple instances don't collide */
  const gradientId = useMemo(
    () => `cohortTrendGrad_${Math.random().toString(36).slice(2, 8)}`,
    []
  )

  if (averages.length < 2) {
    return (
      <div className={`rounded-xl border h-full flex flex-col
        ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
        <p className={`text-xs font-semibold px-4 pt-3 pb-2 ${dark ? 'text-white' : 'text-slate-700'}`}>
          {title}
        </p>
        <div className="flex-1 flex items-center justify-center">
          <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {data?.length ? 'Not enough periods for trend' : 'No data'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border h-full flex flex-col overflow-hidden
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
      {/* Title */}
      <p className={`text-xs font-semibold px-4 pt-3 pb-2 shrink-0 ${dark ? 'text-white' : 'text-slate-700'}`}>
        {title}
      </p>

      {/* Chart */}
      <div className="flex-1 min-h-0 px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={averages} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#252836' : '#E2E8F0'} />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 9, fill: dark ? '#64748B' : '#475569' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: dark ? '#64748B' : '#475569' }}
              tickFormatter={v => v + '%'}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: dark ? '#1A1D27' : '#FFF',
                border: `1px solid ${dark ? '#252836' : '#E2E8F0'}`,
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(v) => [v.toFixed(1) + '%', 'Avg Retention']}
            />
            <Area
              type="monotone"
              dataKey="retention"
              stroke="#6366F1"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 3, fill: '#6366F1', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#6366F1' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
