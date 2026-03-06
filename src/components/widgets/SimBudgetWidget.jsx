import { useMemo, useState, useCallback } from 'react'
import { METRICS } from '../../store/useConfig'
import { groupData, fmtMetric } from './widgetUtils'

const REVENUE_METRICS = METRICS.filter(m =>
  ['cost', 'revenue', 'conv', 'clicks', 'impr', 'installs', 'signup'].includes(m.id),
)

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

/* ── budget slider ── */
function BudgetSlider({ channel, pct, onChange, dark, efficiency }) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg
      ${dark ? 'bg-[#20232E]' : 'bg-slate-50'}`}>
      <span className={`text-xs font-medium w-20 truncate ${dark ? 'text-white' : 'text-slate-700'}`}>
        {channel}
      </span>
      <input type="range" min={0} max={100} value={pct}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-indigo-500"
      />
      <span className={`text-xs font-bold w-10 text-right ${dark ? 'text-indigo-400' : 'text-indigo-600'}`}>
        {pct}%
      </span>
      {efficiency && (
        <span className={`text-[10px] w-16 text-right ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          ROAS {(efficiency.roas * 100).toFixed(0)}%
        </span>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   SimBudgetWidget
   - Budget allocation sliders + projected KPIs
   ══════════════════════════════════════════ */
export default function SimBudgetWidget({ data, config, dark, onConfigUpdate }) {
  const {
    totalBudget = 0,
    targetMetric = 'revenue',
    allocations = {},
    title = '예산 배분 시뮬레이션',
  } = config || {}

  const efficiency = useChannelEfficiency(data)
  const channels = useMemo(() => Object.keys(efficiency), [efficiency])

  /* initialise allocations if empty */
  const activeAlloc = useMemo(() => {
    if (Object.keys(allocations).length > 0) return allocations
    const init = {}
    channels.forEach(ch => { init[ch] = Math.round(100 / (channels.length || 1)) })
    return init
  }, [allocations, channels])

  /* projected KPIs per channel */
  const projections = useMemo(() => {
    if (!totalBudget || channels.length === 0) return []
    return channels.map(ch => {
      const pct = activeAlloc[ch] || 0
      const budget = totalBudget * (pct / 100)
      const eff = efficiency[ch]
      if (!eff || eff.cost === 0) return { channel: ch, budget, revenue: 0, conv: 0, roas: 0 }
      return {
        channel: ch,
        budget,
        revenue: budget * (eff.revenue / eff.cost),
        conv: budget * (eff.conv / eff.cost),
        roas: eff.roas,
      }
    })
  }, [totalBudget, channels, activeAlloc, efficiency])

  const totals = useMemo(() => projections.reduce(
    (s, p) => ({ revenue: s.revenue + p.revenue, conv: s.conv + p.conv, budget: s.budget + p.budget }),
    { revenue: 0, conv: 0, budget: 0 },
  ), [projections])

  const totalPct = useMemo(
    () => channels.reduce((s, ch) => s + (activeAlloc[ch] || 0), 0),
    [channels, activeAlloc],
  )

  /* handlers */
  const handleBudgetChange = useCallback((val) => {
    onConfigUpdate?.({ ...config, totalBudget: Number(val) || 0 })
  }, [config, onConfigUpdate])

  const handleMetricChange = useCallback((val) => {
    onConfigUpdate?.({ ...config, targetMetric: val })
  }, [config, onConfigUpdate])

  const handleAllocChange = useCallback((channel, pct) => {
    const next = { ...activeAlloc, [channel]: pct }
    onConfigUpdate?.({ ...config, allocations: next })
  }, [config, activeAlloc, onConfigUpdate])

  const metricLabel = METRICS.find(m => m.id === targetMetric)?.label || targetMetric

  return (
    <div className={`rounded-xl border p-4 space-y-3
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>

      {/* title */}
      <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>

      {/* controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>총 예산</label>
          <input type="number" value={totalBudget}
            onChange={e => handleBudgetChange(e.target.value)}
            className={`text-xs px-2 py-1.5 rounded-lg border outline-none w-28
              ${dark ? 'bg-transparent border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-800'}`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>목표 지표</label>
          <select value={targetMetric} onChange={e => handleMetricChange(e.target.value)}
            className={`text-xs px-2 py-1.5 rounded-lg border outline-none
              ${dark ? 'bg-[#1A1D27] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
            {REVENUE_METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* channel sliders */}
      {channels.length > 0 && (
        <div className="space-y-1.5">
          {channels.map(ch => (
            <BudgetSlider key={ch} channel={ch}
              pct={activeAlloc[ch] || 0}
              onChange={pct => handleAllocChange(ch, pct)}
              dark={dark}
              efficiency={efficiency[ch]}
            />
          ))}
          <div className={`flex items-center justify-between pt-2 border-t
            ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
            <span className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>총 배분율</span>
            <span className={`text-xs font-bold
              ${totalPct === 100 ? 'text-emerald-500' : dark ? 'text-amber-400' : 'text-amber-600'}`}>
              {totalPct}%
            </span>
          </div>
        </div>
      )}

      {/* projected KPI summary */}
      {projections.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <div className={`rounded-lg border px-3 py-2 min-w-[100px]
            ${dark ? 'bg-[#20232E] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[10px] mb-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>배분 예산</p>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
              {fmtMetric('cost', totals.budget)}
            </p>
          </div>
          <div className={`rounded-lg border px-3 py-2 min-w-[100px]
            ${dark ? 'bg-[#20232E] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[10px] mb-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>예상 매출</p>
            <p className="text-sm font-bold text-emerald-500">
              {fmtMetric('revenue', totals.revenue)}
            </p>
          </div>
          <div className={`rounded-lg border px-3 py-2 min-w-[100px]
            ${dark ? 'bg-[#20232E] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[10px] mb-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>예상 ROAS</p>
            <p className={`text-sm font-bold ${dark ? 'text-indigo-400' : 'text-indigo-600'}`}>
              {totals.budget > 0 ? ((totals.revenue / totals.budget) * 100).toFixed(0) + '%' : '--'}
            </p>
          </div>
        </div>
      )}

      {/* empty state */}
      {channels.length === 0 && (
        <p className={`text-xs text-center py-6 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          채널 데이터가 없습니다
        </p>
      )}
    </div>
  )
}
