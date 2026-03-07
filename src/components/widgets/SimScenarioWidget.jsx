import { useMemo, useState, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { groupData, fmtMetric } from './widgetUtils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444']

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
   SimScenarioWidget
   - Compare multiple budget allocation scenarios
     side-by-side using a BarChart
   ══════════════════════════════════════════ */
export default function SimScenarioWidget({ data, config, dark, onConfigUpdate, metrics: metricsProp }) {
  const {
    totalBudget = 0,
    targetMetric = 'revenue',
    scenarios = [],
    title = '시나리오 비교',
  } = config || {}

  const efficiency = useChannelEfficiency(data)
  const channels = useMemo(() => Object.keys(efficiency), [efficiency])

  const [activeScIdx, setActiveScIdx] = useState(0)
  const activeSc = scenarios[activeScIdx] || null

  /* helpers to persist config changes */
  const update = useCallback((patch) => {
    onConfigUpdate?.({ ...config, ...patch })
  }, [config, onConfigUpdate])

  /* ── scenario management ── */
  const addScenario = useCallback(() => {
    const alloc = {}
    channels.forEach(ch => { alloc[ch] = Math.round(100 / (channels.length || 1)) })
    const sc = {
      id: `sc_${Date.now()}`,
      name: `시나리오 ${scenarios.length + 1}`,
      allocations: alloc,
    }
    update({ scenarios: [...scenarios, sc] })
    setActiveScIdx(scenarios.length)
  }, [channels, scenarios, update])

  const removeScenario = useCallback((idx) => {
    const next = scenarios.filter((_, i) => i !== idx)
    update({ scenarios: next })
    setActiveScIdx(Math.min(activeScIdx, Math.max(0, next.length - 1)))
  }, [scenarios, activeScIdx, update])

  const updateAllocation = useCallback((channel, pct) => {
    if (!activeSc) return
    const newSc = { ...activeSc, allocations: { ...activeSc.allocations, [channel]: pct } }
    update({ scenarios: scenarios.map((s, i) => i === activeScIdx ? newSc : s) })
  }, [activeSc, activeScIdx, scenarios, update])

  /* ── chart data: per channel, each scenario as a bar ── */
  const chartData = useMemo(() => {
    if (scenarios.length === 0 || channels.length === 0) return []
    return channels.map(ch => {
      const row = { name: ch }
      scenarios.forEach(sc => {
        const alloc = sc.allocations?.[ch] || 0
        const budget = totalBudget * (alloc / 100)
        const eff = efficiency[ch]
        if (!eff || eff.cost === 0) {
          row[sc.name] = 0
        } else {
          const ratio = targetMetric === 'revenue'
            ? eff.revenue / eff.cost
            : targetMetric === 'conv'
            ? eff.conv / eff.cost
            : eff.clicks / eff.cost
          row[sc.name] = budget * ratio
        }
      })
      return row
    })
  }, [scenarios, channels, efficiency, totalBudget, targetMetric])

  /* ── per-scenario summary stats ── */
  const summaryStats = useMemo(() => {
    return scenarios.map(sc => {
      let totalOut = 0
      let totalCost = 0
      channels.forEach(ch => {
        const alloc = sc.allocations?.[ch] || 0
        const budget = totalBudget * (alloc / 100)
        totalCost += budget
        const eff = efficiency[ch]
        if (eff && eff.cost > 0) {
          const ratio = targetMetric === 'revenue'
            ? eff.revenue / eff.cost
            : targetMetric === 'conv'
            ? eff.conv / eff.cost
            : eff.clicks / eff.cost
          totalOut += budget * ratio
        }
      })
      return { name: sc.name, output: totalOut, cost: totalCost }
    })
  }, [scenarios, channels, efficiency, totalBudget, targetMetric])

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

      {/* controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>총 예산</label>
          <input type="number" value={totalBudget}
            onChange={e => update({ totalBudget: Number(e.target.value) || 0 })}
            className={`text-xs px-2 py-1.5 rounded-lg border outline-none w-28
              ${dark ? 'bg-transparent border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-800'}`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>목표 지표</label>
          <select value={targetMetric} onChange={e => update({ targetMetric: e.target.value })}
            className={`text-xs px-2 py-1.5 rounded-lg border outline-none
              ${dark ? 'bg-[#1A1D27] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
            {revenueMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </div>

      {/* scenario tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {scenarios.map((sc, i) => (
          <div key={sc.id} className="flex items-center gap-0.5">
            <button onClick={() => setActiveScIdx(i)}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors
                ${i === activeScIdx
                  ? 'bg-indigo-600 text-white'
                  : dark ? 'bg-[#20232E] text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-800'}`}>
              {sc.name}
            </button>
            {scenarios.length > 1 && (
              <button onClick={() => removeScenario(i)}
                className={`p-0.5 rounded ${dark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`}>
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
        {scenarios.length < 4 && (
          <button onClick={addScenario}
            className={`text-xs px-2.5 py-1 rounded-lg border border-dashed
              ${dark ? 'border-[#2E3450] text-slate-400 hover:text-slate-200' : 'border-slate-300 text-slate-500 hover:text-slate-700'}`}>
            <Plus size={10} className="inline mr-0.5" /> 추가
          </button>
        )}
      </div>

      {/* active scenario sliders */}
      {activeSc && channels.length > 0 && (
        <div className="space-y-1">
          {channels.map(ch => (
            <div key={ch} className={`flex items-center gap-2 p-1.5 rounded-lg
              ${dark ? 'bg-[#20232E]' : 'bg-slate-50'}`}>
              <span className={`text-[11px] font-medium w-16 truncate ${dark ? 'text-white' : 'text-slate-700'}`}>
                {ch}
              </span>
              <input type="range" min={0} max={100} value={activeSc.allocations?.[ch] || 0}
                onChange={e => updateAllocation(ch, Number(e.target.value))}
                className="flex-1 h-1 accent-indigo-500"
              />
              <span className={`text-[11px] font-bold w-8 text-right ${dark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {activeSc.allocations?.[ch] || 0}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* comparison chart (show when 2+ scenarios) */}
      {scenarios.length >= 2 && chartData.length > 0 && (
        <div>
          <p className={`text-[10px] font-medium mb-2 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
            시나리오별 예상 {metricLabel}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#252836' : '#E2E8F0'} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: dark ? '#64748B' : '#475569' }} />
              <YAxis tick={{ fontSize: 10, fill: dark ? '#64748B' : '#475569' }} />
              <Tooltip contentStyle={{
                backgroundColor: dark ? '#1A1D27' : '#FFF',
                border: `1px solid ${dark ? '#252836' : '#E2E8F0'}`,
                borderRadius: 8, fontSize: 11,
              }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {scenarios.map((sc, i) => (
                <Bar key={sc.id} dataKey={sc.name} fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* summary stats table */}
      {summaryStats.length > 0 && totalBudget > 0 && (
        <div className="flex gap-2 flex-wrap">
          {summaryStats.map((st, i) => (
            <div key={st.name} className={`rounded-lg border px-3 py-2 flex-1 min-w-[110px]
              ${dark ? 'bg-[#20232E] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                <p className={`text-[10px] font-medium ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{st.name}</p>
              </div>
              <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                {fmtMetric(targetMetric, st.output)}
              </p>
              <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                예산 {fmtMetric('cost', st.cost)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* empty state */}
      {scenarios.length === 0 && (
        <div className={`text-center py-6`}>
          <p className={`text-xs mb-2 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            시나리오를 추가하여 비교하세요
          </p>
          <button onClick={addScenario}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
            <Plus size={10} className="inline mr-1" /> 첫 시나리오 추가
          </button>
        </div>
      )}
    </div>
  )
}
