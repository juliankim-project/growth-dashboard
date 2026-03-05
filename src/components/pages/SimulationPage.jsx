import { useState, useMemo } from 'react'
import { Plus, Trash2, BarChart3, Target } from 'lucide-react'
import { METRICS } from '../../store/useConfig'
import { calcMetric, fmtMetric, groupData } from '../widgets/widgetUtils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const REVENUE_METRICS = METRICS.filter(m => ['cost', 'revenue', 'conv', 'clicks', 'impr', 'installs', 'signup'].includes(m.id))
const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444']

/* ── 채널별 효율 계산 ── */
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

/* ── 슬라이더 ── */
function BudgetSlider({ channel, pct, onChange, dark, efficiency }) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg
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
        <span className={`text-[10px] w-16 text-right ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          ROAS {(efficiency.roas * 100).toFixed(0)}%
        </span>
      )}
    </div>
  )
}

/* ── 시나리오 비교 차트 ── */
function ScenarioChart({ scenarios, channels, efficiency, totalBudget, targetMetric, dark }) {
  const chartData = useMemo(() => {
    return channels.map(ch => {
      const row = { name: ch }
      scenarios.forEach((sc, i) => {
        const alloc = sc.allocations?.[ch] || 0
        const budget = totalBudget * (alloc / 100)
        const eff = efficiency[ch]
        if (!eff || eff.cost === 0) {
          row[sc.name] = 0
        } else {
          // 효율 비율 * 배분 예산
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

  const metricLabel = METRICS.find(m => m.id === targetMetric)?.label || targetMetric

  return (
    <div className={`rounded-xl border p-4
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
      <p className={`text-xs font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-700'}`}>
        시나리오별 예상 {metricLabel}
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#252836' : '#E2E8F0'} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: dark ? '#64748B' : '#94A3B8' }} />
          <YAxis tick={{ fontSize: 10, fill: dark ? '#64748B' : '#94A3B8' }} />
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
  )
}

/* ── 메인 시뮬레이션 페이지 ── */
export default function SimulationPage({ dashboard, setDashboard, data, dark, editMode }) {
  const mode = dashboard?.mode || 'budget'
  const channels = dashboard?.channels || []
  const totalBudget = dashboard?.totalBudget || 0
  const targetMetric = dashboard?.targetMetric || 'revenue'
  const targetValue = dashboard?.targetValue || 0
  const scenarios = dashboard?.scenarios || []
  const [activeScIdx, setActiveScIdx] = useState(0)

  const efficiency = useChannelEfficiency(data)
  const availableChannels = Object.keys(efficiency)

  /* 현재 시나리오 */
  const activeSc = scenarios[activeScIdx] || null

  const update = (changes) => setDashboard({ ...dashboard, ...changes })

  /* 채널 자동 감지 (처음 데이터 로드 시) */
  const channelsToUse = channels.length > 0 ? channels : availableChannels

  /* 시나리오 추가 */
  const addScenario = () => {
    const alloc = {}
    channelsToUse.forEach(ch => { alloc[ch] = Math.round(100 / channelsToUse.length) })
    const sc = { id: `sc_${Date.now()}`, name: `시나리오 ${scenarios.length + 1}`, allocations: alloc }
    update({ scenarios: [...scenarios, sc], channels: channelsToUse })
    setActiveScIdx(scenarios.length)
  }

  const removeScenario = (idx) => {
    const next = scenarios.filter((_, i) => i !== idx)
    update({ scenarios: next })
    setActiveScIdx(Math.min(activeScIdx, Math.max(0, next.length - 1)))
  }

  const updateAllocation = (channel, pct) => {
    if (!activeSc) return
    const newSc = { ...activeSc, allocations: { ...activeSc.allocations, [channel]: pct } }
    update({ scenarios: scenarios.map((s, i) => i === activeScIdx ? newSc : s) })
  }

  /* 예상 성과 계산 */
  const projections = useMemo(() => {
    if (!activeSc || !totalBudget) return []
    return channelsToUse.map(ch => {
      const alloc = activeSc.allocations?.[ch] || 0
      const budget = totalBudget * (alloc / 100)
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
  }, [activeSc, totalBudget, channelsToUse, efficiency])

  const totalProjected = projections.reduce((s, p) => ({
    revenue: s.revenue + p.revenue,
    conv: s.conv + p.conv,
    budget: s.budget + p.budget,
  }), { revenue: 0, conv: 0, budget: 0 })

  return (
    <div className="space-y-4">
      {/* 설정 바 */}
      {editMode && (
        <div className={`rounded-xl border p-4 space-y-3
          ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>시뮬레이션 설정</p>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button onClick={() => update({ mode: 'budget' })}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors
                ${mode === 'budget' ? 'bg-indigo-600 text-white' : dark ? 'bg-[#20232E] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                <BarChart3 size={12} /> 예산 배분
              </button>
              <button onClick={() => update({ mode: 'target' })}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors
                ${mode === 'target' ? 'bg-indigo-600 text-white' : dark ? 'bg-[#20232E] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                <Target size={12} /> 목표 역산
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                {mode === 'budget' ? '총 예산' : '목표값'}
              </label>
              <input type="number"
                value={mode === 'budget' ? totalBudget : targetValue}
                onChange={e => update(mode === 'budget'
                  ? { totalBudget: Number(e.target.value) }
                  : { targetValue: Number(e.target.value) })}
                className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none w-32
                ${dark ? 'bg-transparent border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-800'}`}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>목표 지표</label>
              <select value={targetMetric}
                onChange={e => update({ targetMetric: e.target.value })}
                className={`text-xs px-2 py-1.5 rounded-lg border outline-none
                ${dark ? 'bg-[#1A1D27] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                {REVENUE_METRICS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 시나리오 없을 때 */}
      {scenarios.length === 0 ? (
        <div className={`text-center py-16 rounded-xl border
          ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs mb-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            시나리오를 추가하여 예산 배분을 시뮬레이션하세요
          </p>
          <button onClick={addScenario}
            className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
            <Plus size={12} className="inline mr-1.5" /> 첫 시나리오 추가
          </button>
        </div>
      ) : (
        <>
          {/* 시나리오 탭 */}
          <div className="flex items-center gap-2 flex-wrap">
            {scenarios.map((sc, i) => (
              <div key={sc.id} className="flex items-center gap-0.5">
                <button onClick={() => setActiveScIdx(i)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                  ${i === activeScIdx
                    ? 'bg-indigo-600 text-white'
                    : dark ? 'bg-[#1A1D27] text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
                  {sc.name}
                </button>
                {scenarios.length > 1 && (
                  <button onClick={() => removeScenario(i)}
                    className={`p-1 rounded ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`}>
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
            {scenarios.length < 3 && (
              <button onClick={addScenario}
                className={`text-xs px-3 py-1.5 rounded-lg border border-dashed
                ${dark ? 'border-[#2E3450] text-slate-500 hover:text-slate-300' : 'border-slate-200 text-slate-400 hover:text-slate-600'}`}>
                <Plus size={10} className="inline mr-1" /> 시나리오
              </button>
            )}
          </div>

          {/* KPI 요약 */}
          <div className="flex gap-3 flex-wrap">
            <div className={`rounded-xl border px-4 py-3 min-w-[130px]
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
              <p className={`text-[10px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>배분 예산</p>
              <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                {fmtMetric('cost', totalProjected.budget)}
              </p>
            </div>
            <div className={`rounded-xl border px-4 py-3 min-w-[130px]
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
              <p className={`text-[10px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>예상 매출</p>
              <p className={`text-lg font-bold text-emerald-500`}>
                {fmtMetric('revenue', totalProjected.revenue)}
              </p>
            </div>
            <div className={`rounded-xl border px-4 py-3 min-w-[130px]
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
              <p className={`text-[10px] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>예상 ROAS</p>
              <p className={`text-lg font-bold ${dark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {totalProjected.budget > 0 ? ((totalProjected.revenue / totalProjected.budget) * 100).toFixed(0) + '%' : '—'}
              </p>
            </div>
          </div>

          {/* 채널별 슬라이더 */}
          {activeSc && (
            <div className={`rounded-xl border p-4
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
              <p className={`text-xs font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-700'}`}>
                채널별 예산 배분 — {activeSc.name}
              </p>
              <div className="space-y-1.5">
                {channelsToUse.map(ch => (
                  <BudgetSlider key={ch} channel={ch}
                    pct={activeSc.allocations?.[ch] || 0}
                    onChange={(pct) => updateAllocation(ch, pct)}
                    dark={dark}
                    efficiency={efficiency[ch]}
                  />
                ))}
              </div>
              <div className={`flex items-center justify-between mt-3 pt-3 border-t
                ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                <span className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>총 배분율</span>
                <span className={`text-xs font-bold
                  ${(() => {
                    const total = channelsToUse.reduce((s, ch) => s + (activeSc.allocations?.[ch] || 0), 0)
                    return total === 100 ? 'text-emerald-500' : dark ? 'text-amber-400' : 'text-amber-600'
                  })()}`}>
                  {channelsToUse.reduce((s, ch) => s + (activeSc.allocations?.[ch] || 0), 0)}%
                </span>
              </div>
            </div>
          )}

          {/* 채널별 예상 성과 테이블 */}
          {projections.length > 0 && (
            <div className={`rounded-xl border overflow-hidden
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={dark ? 'bg-[#20232E]' : 'bg-slate-50'}>
                      <th className={`text-left px-3 py-2.5 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>채널</th>
                      <th className={`text-right px-3 py-2.5 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>배분 예산</th>
                      <th className={`text-right px-3 py-2.5 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>예상 매출</th>
                      <th className={`text-right px-3 py-2.5 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>예상 전환</th>
                      <th className={`text-right px-3 py-2.5 font-semibold ${dark ? 'text-slate-400' : 'text-slate-500'}`}>효율 ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projections.map(p => (
                      <tr key={p.channel}
                        className={`border-t ${dark ? 'border-[#252836] hover:bg-[#20232E]' : 'border-slate-100 hover:bg-slate-50'}`}>
                        <td className={`px-3 py-2 font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>{p.channel}</td>
                        <td className={`text-right px-3 py-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{fmtMetric('cost', p.budget)}</td>
                        <td className={`text-right px-3 py-2 text-emerald-500 font-medium`}>{fmtMetric('revenue', p.revenue)}</td>
                        <td className={`text-right px-3 py-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{Math.round(p.conv).toLocaleString()}</td>
                        <td className={`text-right px-3 py-2 ${dark ? 'text-indigo-400' : 'text-indigo-600'} font-medium`}>
                          {(p.roas * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 시나리오 비교 차트 (2개 이상일 때) */}
          {scenarios.length >= 2 && (
            <ScenarioChart
              scenarios={scenarios}
              channels={channelsToUse}
              efficiency={efficiency}
              totalBudget={totalBudget}
              targetMetric={targetMetric}
              dark={dark}
            />
          )}
        </>
      )}
    </div>
  )
}
