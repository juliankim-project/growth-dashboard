import { useMemo, useCallback } from 'react'
import { groupData, fmtMetric } from './widgetUtils'

const SIM_METRIC_IDS = ['cost', 'revenue', 'conv', 'clicks', 'impr', 'installs', 'signup']

/* ── channel efficiency hook (extracted from SimulationPage) ── */
function useChannelEfficiency(data) {
  return useMemo(() => {
    if (!data?.length) return {}
    const grouped = groupData(data, 'channel', ['cost', 'revenue', 'conv', 'clicks', 'impr', 'signup', 'installs'])
    const eff = {}
    grouped.forEach(row => {
      const cost = row.cost || 0
      eff[row.name] = {
        name: row.name,
        cost,
        revenue: row.revenue || 0,
        conv: row.conv || 0,
        clicks: row.clicks || 0,
        roas: cost > 0 ? (row.revenue || 0) / cost : 0,
        cpa: (row.conv || 0) > 0 ? cost / row.conv : 0,
        ctr: (row.impr || 0) > 0 ? (row.clicks / row.impr) * 100 : 0,
      }
    })
    return eff
  }, [data])
}

/* ══════════════════════════════════════════
   SimGoalWidget
   - Reverse-calculate required budget per channel
     given a target metric value
   ══════════════════════════════════════════ */
export default function SimGoalWidget({ data, config, dark, onConfigUpdate, metrics: metricsProp }) {
  const {
    targetMetric = 'revenue',
    targetValue = 0,
    title = '목표 역산',
  } = config || {}

  const efficiency = useChannelEfficiency(data)
  const channels = useMemo(() => Object.keys(efficiency), [efficiency])

  /* reverse calculation: how much budget each channel needs
     to contribute its proportional share to reach targetValue */
  const breakdown = useMemo(() => {
    if (!targetValue || channels.length === 0) return []

    /* compute total historical output for the target metric */
    const totalOutput = channels.reduce((s, ch) => {
      const eff = efficiency[ch]
      if (!eff) return s
      if (targetMetric === 'revenue') return s + eff.revenue
      if (targetMetric === 'conv') return s + eff.conv
      if (targetMetric === 'clicks') return s + eff.clicks
      return s + eff.revenue
    }, 0)

    return channels.map(ch => {
      const eff = efficiency[ch]
      if (!eff || eff.cost === 0) {
        return { channel: ch, share: 0, requiredBudget: 0, efficiency: 0 }
      }

      /* each channel's proportional share based on historical mix */
      const metricVal = targetMetric === 'revenue' ? eff.revenue
        : targetMetric === 'conv' ? eff.conv
        : targetMetric === 'clicks' ? eff.clicks
        : eff.revenue

      const share = totalOutput > 0 ? metricVal / totalOutput : 1 / channels.length
      const channelTarget = targetValue * share

      /* efficiency ratio: how much metric per 1 unit cost */
      const ratio = metricVal / eff.cost
      const requiredBudget = ratio > 0 ? channelTarget / ratio : 0

      return {
        channel: ch,
        share,
        requiredBudget,
        channelTarget,
        efficiency: ratio,
      }
    })
  }, [targetValue, targetMetric, channels, efficiency])

  const totalRequired = useMemo(
    () => breakdown.reduce((s, b) => s + b.requiredBudget, 0),
    [breakdown],
  )

  /* handlers */
  const handleMetricChange = useCallback((val) => {
    onConfigUpdate?.({ ...config, targetMetric: val })
  }, [config, onConfigUpdate])

  const handleTargetChange = useCallback((val) => {
    onConfigUpdate?.({ ...config, targetValue: Number(val) || 0 })
  }, [config, onConfigUpdate])

  const revenueMetrics = useMemo(
    () => metricsProp?.filter(m => SIM_METRIC_IDS.includes(m.id)) || [],
    [metricsProp],
  )

  const metricLabel = metricsProp?.find(m => m.id === targetMetric)?.label || targetMetric

  return (
    <div className={`rounded-xl border p-4 space-y-3
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>

      {/* title */}
      <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>

      {/* controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>목표 지표</label>
          <select value={targetMetric} onChange={e => handleMetricChange(e.target.value)}
            className={`text-xs px-2 py-1.5 rounded-lg border outline-none
              ${dark ? 'bg-[#1A1D27] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
            {revenueMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>목표값</label>
          <input type="number" value={targetValue}
            onChange={e => handleTargetChange(e.target.value)}
            className={`text-xs px-2 py-1.5 rounded-lg border outline-none w-28
              ${dark ? 'bg-transparent border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-800'}`}
          />
        </div>
      </div>

      {/* total required budget */}
      {breakdown.length > 0 && targetValue > 0 && (
        <div className={`rounded-lg border px-3 py-2
          ${dark ? 'bg-[#20232E] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>
          <p className={`text-[10px] mb-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            {metricLabel} {fmtMetric(targetMetric, targetValue)} 달성에 필요한 총 예산
          </p>
          <p className={`text-lg font-bold ${dark ? 'text-indigo-400' : 'text-indigo-600'}`}>
            {fmtMetric('cost', totalRequired)}
          </p>
        </div>
      )}

      {/* per-channel breakdown table */}
      {breakdown.length > 0 && targetValue > 0 && (
        <div className={`rounded-lg border overflow-hidden
          ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className={dark ? 'bg-[#20232E]' : 'bg-slate-50'}>
                <th className={`text-left px-3 py-2 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>채널</th>
                <th className={`text-right px-3 py-2 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>기여 비중</th>
                <th className={`text-right px-3 py-2 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>채널 목표</th>
                <th className={`text-right px-3 py-2 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>필요 예산</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map(b => (
                <tr key={b.channel}
                  className={`border-t ${dark ? 'border-[#252836] hover:bg-[#20232E]' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <td className={`px-3 py-2 font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>{b.channel}</td>
                  <td className={`text-right px-3 py-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {(b.share * 100).toFixed(1)}%
                  </td>
                  <td className={`text-right px-3 py-2 text-emerald-500 font-medium`}>
                    {fmtMetric(targetMetric, b.channelTarget || 0)}
                  </td>
                  <td className={`text-right px-3 py-2 ${dark ? 'text-indigo-400' : 'text-indigo-600'} font-medium`}>
                    {fmtMetric('cost', b.requiredBudget)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* empty state */}
      {(channels.length === 0 || !targetValue) && (
        <p className={`text-xs text-center py-6 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          {channels.length === 0 ? '채널 데이터가 없습니다' : '목표값을 입력하세요'}
        </p>
      )}
    </div>
  )
}
