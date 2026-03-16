import { useMemo, memo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { calcMetric, fmtMetric, splitByPeriod } from './widgetUtils'

function ComparisonWidget({ data, config, dark, metrics: metricsProp, dateColumn, dateRange }) {
  const { metrics = [], compareMode = 'period', title = '기간 비교' } = config

  const rows = useMemo(() => {
    if (!data?.length || metrics.length === 0) return []

    if (compareMode === 'period' && dateRange) {
      const { current, previous } = splitByPeriod(data, dateRange, dateColumn)
      return metrics.map(mid => {
        const curVal = calcMetric(current, mid, metricsProp)
        const prevVal = calcMetric(previous, mid, metricsProp)
        const diff = curVal - prevVal
        const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : (curVal > 0 ? 100 : 0)
        const meta = metricsProp?.find(x => x.id === mid)
        return { id: mid, label: meta?.label || mid, curVal, prevVal, diff, pct }
      })
    }

    /* 전체 데이터 기간 비교 (dateRange 없을 때): 데이터 반분 */
    const sorted = [...data].sort((a, b) => {
      const da = a[dateColumn || 'date'] || ''
      const db = b[dateColumn || 'date'] || ''
      return da.localeCompare(db)
    })
    const mid2 = Math.floor(sorted.length / 2)
    const first = sorted.slice(0, mid2)
    const second = sorted.slice(mid2)

    return metrics.map(mid => {
      const curVal = calcMetric(second, mid, metricsProp)
      const prevVal = calcMetric(first, mid, metricsProp)
      const diff = curVal - prevVal
      const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : (curVal > 0 ? 100 : 0)
      const meta = metricsProp?.find(x => x.id === mid)
      return { id: mid, label: meta?.label || mid, curVal, prevVal, diff, pct }
    })
  }, [data, metrics, metricsProp, compareMode, dateRange, dateColumn])

  return (
    <div className={`rounded-xl p-6 border h-full flex flex-col
      ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-sm font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>

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
                {/* 지표명 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-wider truncate
                    ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {row.label}
                  </p>
                  <p className={`text-sm font-bold mt-0.5 ${dark ? 'text-white' : 'text-slate-800'}`}>
                    {fmtMetric(row.id, row.curVal, metricsProp)}
                  </p>
                </div>
                {/* 이전 값 */}
                <div className="text-right shrink-0">
                  <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>이전</p>
                  <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {fmtMetric(row.id, row.prevVal, metricsProp)}
                  </p>
                </div>
                {/* 변화율 */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold shrink-0
                  ${isUp ? 'bg-emerald-500/10 text-emerald-500'
                    : isDown ? 'bg-red-500/10 text-red-500'
                    : dark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                  {isUp ? <TrendingUp size={12}/> : isDown ? <TrendingDown size={12}/> : <Minus size={12}/>}
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

export default memo(ComparisonWidget)
