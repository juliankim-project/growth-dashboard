import { useMemo, memo } from 'react'
import { calcMetric, fmtMetric, getThresholdStatus } from './widgetUtils'

const STATUS_STYLES = {
  good:    { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500', label: '양호' },
  warning: { dot: 'bg-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-500',   label: '주의' },
  danger:  { dot: 'bg-red-500',     bg: 'bg-red-500/10',     text: 'text-red-500',     label: '위험' },
  neutral: { dot: 'bg-slate-400',   bg: 'bg-slate-400/10',   text: 'text-slate-400',   label: '미설정' },
}

function AlertWidget({ data, config, dark, metrics: metricsProp }) {
  const { metrics = [], thresholds = {}, title = '알림 모니터' } = config

  const items = useMemo(() => {
    if (!data?.length || metrics.length === 0) return []

    return metrics.map(mid => {
      const val = calcMetric(data, mid, metricsProp)
      const th = thresholds[mid]
      const status = getThresholdStatus(val, th)
      const meta = metricsProp?.find(x => x.id === mid)
      return { id: mid, label: meta?.label || mid, value: val, status }
    })
  }, [data, metrics, metricsProp, thresholds])

  const statusCounts = useMemo(() => {
    const c = { good: 0, warning: 0, danger: 0, neutral: 0 }
    items.forEach(i => { c[i.status] = (c[i.status] || 0) + 1 })
    return c
  }, [items])

  return (
    <div className={`rounded-xl p-5 border h-full flex flex-col
      ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
      {/* 헤더 + 요약 */}
      <div className="flex items-center justify-between mb-4">
        <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
        <div className="flex gap-2">
          {statusCounts.danger > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">
              {statusCounts.danger} 위험
            </span>
          )}
          {statusCounts.warning > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
              {statusCounts.warning} 주의
            </span>
          )}
          {statusCounts.good > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
              {statusCounts.good} 양호
            </span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className={`text-center py-10 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          지표가 설정되지 않았습니다
        </div>
      ) : (
        <div className="flex-1 overflow-auto space-y-2">
          {items.map(item => {
            const s = STATUS_STYLES[item.status]
            return (
              <div key={item.id}
                className={`rounded-lg border px-4 py-3 flex items-center gap-3
                  ${dark ? 'bg-[#2C333A] border-[#A1BDD914]' : 'bg-slate-50 border-slate-200'}`}>
                {/* 상태 점 */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                {/* 지표명 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider truncate
                    ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.label}
                  </p>
                </div>
                {/* 값 */}
                <span className={`text-sm font-bold shrink-0 ${dark ? 'text-white' : 'text-slate-800'}`}>
                  {fmtMetric(item.id, item.value, metricsProp)}
                </span>
                {/* 상태 뱃지 */}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${s.bg} ${s.text}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default memo(AlertWidget)
