import { useMemo, useState, memo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { dailyData, calcMetric, fmtMetric, CHART_COLORS } from './widgetUtils'

const TIME_GROUPS = [
  { id: 'day', label: '일' },
  { id: 'week', label: '주' },
  { id: 'month', label: '월' },
]

/* ── 미니 스파크라인 SVG ── */
function Sparkline({ points, color, width = 120, height = 28 }) {
  if (!points || points.length < 2) return <div style={{ width, height }} />

  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const range = max - min || 1

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TimelineWidget({ data, config, dark, metrics: metricsProp, dateColumn }) {
  const { metrics = [], title = '트렌드 요약', timeGroup: cfgTimeGroup } = config
  const [timeGroup, setTimeGroup] = useState(cfgTimeGroup || 'day')

  const rows = useMemo(() => {
    if (!data?.length || metrics.length === 0) return []

    const daily = dailyData(data, metrics, metricsProp, dateColumn, timeGroup)

    return metrics.map((mid, idx) => {
      const meta = metricsProp?.find(x => x.id === mid)
      const points = daily.map(d => d[mid] || 0)
      const total = calcMetric(data, mid, metricsProp)

      // 전일 대비 변화 (마지막 두 날)
      const lastVal = points.length >= 1 ? points[points.length - 1] : 0
      const prevVal = points.length >= 2 ? points[points.length - 2] : 0
      const diff = lastVal - prevVal
      const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : 0

      return {
        id: mid,
        label: meta?.label || mid,
        total,
        points,
        diff,
        pct,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }
    })
  }, [data, metrics, metricsProp, dateColumn, timeGroup])

  return (
    <div className={`rounded-xl p-4 border h-full overflow-hidden flex flex-col
      ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
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

      {rows.length === 0 ? (
        <div className={`text-center py-10 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          지표가 설정되지 않았습니다
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
          {rows.map(row => {
            const isUp = row.diff > 0
            const isDown = row.diff < 0
            return (
              <div key={row.id}
                className={`rounded-lg border px-4 py-3 flex items-center gap-4
                  ${dark ? 'bg-[#2C333A] border-[#A1BDD914]' : 'bg-slate-50 border-slate-200'}`}>
                {/* 지표명 + 총합 */}
                <div className="min-w-0 flex-shrink-0" style={{ width: '30%' }}>
                  <p className={`text-xs font-semibold uppercase tracking-wider truncate
                    ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {row.label}
                  </p>
                  <p className={`text-sm font-bold mt-0.5 ${dark ? 'text-white' : 'text-slate-800'}`}>
                    {fmtMetric(row.id, row.total, metricsProp)}
                  </p>
                </div>
                {/* 스파크라인 */}
                <div className="flex-1 flex items-center justify-center">
                  <Sparkline points={row.points} color={row.color} />
                </div>
                {/* 전일 대비 */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold shrink-0
                  ${isUp ? 'bg-emerald-500/10 text-emerald-500'
                    : isDown ? 'bg-red-500/10 text-red-500'
                    : dark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                  {isUp ? <TrendingUp size={10}/> : isDown ? <TrendingDown size={10}/> : <Minus size={10}/>}
                  {Math.abs(row.pct).toFixed(1)}%
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default memo(TimelineWidget)
