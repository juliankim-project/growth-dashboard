import { useMemo, memo } from 'react'
import { groupData, fmtMetric, CHART_COLORS } from './widgetUtils'

function RankingWidget({ data, config, dark, metrics: metricsProp }) {
  const { metric = '', groupBy = '', topN = 10, sortDir = 'desc', title = '랭킹' } = config

  const ranked = useMemo(() => {
    if (!data?.length || !metric || !groupBy) return []
    const grouped = groupData(data, groupBy, [metric], metricsProp)
    const sorted = [...grouped].sort((a, b) =>
      sortDir === 'desc' ? (b[metric] || 0) - (a[metric] || 0) : (a[metric] || 0) - (b[metric] || 0)
    )
    return sorted.slice(0, topN)
  }, [data, metric, groupBy, topN, sortDir, metricsProp])

  const maxVal = ranked.length > 0 ? Math.max(...ranked.map(r => Math.abs(r[metric] || 0)), 1) : 1

  return (
    <div className={`rounded-xl p-5 border h-full flex flex-col
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-xs font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>

      {ranked.length === 0 ? (
        <div className={`text-center py-10 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          데이터가 없습니다
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-1.5">
          {ranked.map((row, i) => {
            const val = row[metric] || 0
            const pct = (Math.abs(val) / maxVal) * 100
            const color = CHART_COLORS[i % CHART_COLORS.length]

            return (
              <div key={row.name || i} className="flex items-center gap-2">
                {/* 순위 */}
                <span className={`w-5 text-right text-[10px] font-bold shrink-0
                  ${i < 3 ? 'text-amber-500' : dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {i + 1}
                </span>
                {/* 이름 + 프로그레스 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[10px] font-medium truncate
                      ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {row.name}
                    </span>
                    <span className={`text-[10px] font-bold ml-2 shrink-0
                      ${dark ? 'text-white' : 'text-slate-700'}`}>
                      {fmtMetric(metric, val, metricsProp)}
                    </span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden
                    ${dark ? 'bg-[#252836]' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default memo(RankingWidget)
