import { useMemo } from 'react'
import { METRICS } from '../../store/useConfig'
import { fmtNum } from './widgetUtils'

/* ── cohort data builder (shared logic from CohortPage) ── */
export function buildCohortData(data, granularity, cohortEvent, retentionEvent, periods) {
  if (!data?.length) return { cohorts: [], averages: [] }

  const cohortMetric = METRICS.find(m => m.id === cohortEvent)
  const retMetric = METRICS.find(m => m.id === retentionEvent)
  if (!cohortMetric?.field || !retMetric?.field) return { cohorts: [], averages: [] }

  const byDate = {}
  data.forEach(r => {
    const d = (r.date || r['Event Date'])?.slice(0, 10)
    if (!d) return
    if (!byDate[d]) byDate[d] = { cohortVal: 0, retVal: 0 }
    byDate[d].cohortVal += parseFloat(r[cohortMetric.field]) || 0
    byDate[d].retVal += parseFloat(r[retMetric.field]) || 0
  })

  const getGroup = (dateStr) => {
    const d = new Date(dateStr)
    if (granularity === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const jan1 = new Date(d.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
  }

  const groups = {}
  Object.entries(byDate).forEach(([dateStr, vals]) => {
    const g = getGroup(dateStr)
    if (!groups[g]) groups[g] = { cohortVal: 0, retVal: 0, dates: [] }
    groups[g].cohortVal += vals.cohortVal
    groups[g].retVal += vals.retVal
    groups[g].dates.push(dateStr)
  })

  const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  const numCohorts = Math.min(sortedGroups.length, periods)

  const cohorts = []
  for (let i = 0; i < numCohorts; i++) {
    const [label, vals] = sortedGroups[i]
    const row = { label, cohortSize: vals.cohortVal, periods: [] }
    for (let j = 0; j < numCohorts - i; j++) {
      const periodIdx = i + j
      if (periodIdx >= sortedGroups.length) break
      const [, periodVals] = sortedGroups[periodIdx]
      const retention = vals.cohortVal > 0
        ? (periodVals.retVal / vals.cohortVal) * 100
        : 0
      row.periods.push(Math.min(retention, 100))
    }
    cohorts.push(row)
  }

  const averages = []
  for (let j = 0; j < numCohorts; j++) {
    const vals = cohorts.filter(c => c.periods[j] !== undefined).map(c => c.periods[j])
    if (vals.length === 0) break
    averages.push({
      period: granularity === 'month' ? `M${j}` : `W${j}`,
      retention: vals.reduce((s, v) => s + v, 0) / vals.length,
    })
  }

  return { cohorts, averages }
}

/* ── heatmap cell color ── */
export function getHeatColor(value, dark) {
  if (value == null) return 'transparent'
  const r = value < 50 ? 255 : Math.round(255 - (value - 50) * 5.1)
  const g = value < 50 ? Math.round(value * 5.1) : 255
  const opacity = dark ? 0.3 : 0.25
  return `rgba(${r}, ${g}, 60, ${opacity})`
}

/* ── CohortHeatmapWidget ── */
export default function CohortHeatmapWidget({ data, config, dark }) {
  const {
    granularity = 'week',
    cohortEvent = 'signup',
    retentionEvent = 'conv',
    periods = 8,
    title = 'Retention Heatmap',
  } = config || {}

  const { cohorts, averages } = useMemo(
    () => buildCohortData(data, granularity, cohortEvent, retentionEvent, periods),
    [data, granularity, cohortEvent, retentionEvent, periods]
  )

  const maxPeriods = useMemo(
    () => Math.max(...cohorts.map(c => c.periods.length), 0),
    [cohorts]
  )

  if (cohorts.length === 0) {
    return (
      <div className={`rounded-xl border h-full flex flex-col
        ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
        <p className={`text-xs font-semibold px-4 pt-3 pb-2 ${dark ? 'text-white' : 'text-slate-700'}`}>
          {title}
        </p>
        <div className="flex-1 flex items-center justify-center">
          <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {data?.length ? 'No cohort data for current settings' : 'No data'}
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

      {/* KPI row */}
      <div className="flex gap-2 px-4 pb-2 shrink-0 flex-wrap">
        <div className={`rounded-lg border px-3 py-1.5
          ${dark ? 'bg-[#20232E] border-[#252836]' : 'bg-slate-50 border-slate-100'}`}>
          <p className={`text-[9px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Cohorts</p>
          <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{cohorts.length}</p>
        </div>
        {averages.length >= 2 && (
          <div className={`rounded-lg border px-3 py-1.5
            ${dark ? 'bg-[#20232E] border-[#252836]' : 'bg-slate-50 border-slate-100'}`}>
            <p className={`text-[9px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              {averages[1]?.period} Ret.
            </p>
            <p className={`text-sm font-bold ${averages[1]?.retention >= 30 ? 'text-emerald-500' : 'text-amber-500'}`}>
              {averages[1]?.retention.toFixed(1)}%
            </p>
          </div>
        )}
        {averages.length >= 5 && (
          <div className={`rounded-lg border px-3 py-1.5
            ${dark ? 'bg-[#20232E] border-[#252836]' : 'bg-slate-50 border-slate-100'}`}>
            <p className={`text-[9px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              {averages[4]?.period}+ Ret.
            </p>
            <p className={`text-sm font-bold ${averages[4]?.retention >= 15 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {averages[4]?.retention.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Heatmap table */}
      <div className="flex-1 overflow-x-auto overflow-y-auto px-1 pb-2">
        <table className="w-full text-[10px]">
          <thead>
            <tr className={dark ? 'bg-[#20232E]' : 'bg-slate-50'}>
              <th className={`text-left px-2 py-1.5 font-semibold sticky left-0 z-10
                ${dark ? 'bg-[#20232E] text-slate-400' : 'bg-slate-50 text-slate-600'}`}>
                Cohort
              </th>
              <th className={`text-right px-2 py-1.5 font-semibold ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                Size
              </th>
              {Array.from({ length: maxPeriods }, (_, i) => (
                <th key={i} className={`text-center px-1.5 py-1.5 font-semibold min-w-[40px]
                  ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {granularity === 'month' ? `M${i}` : `W${i}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort, ci) => (
              <tr key={ci}
                className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                <td className={`px-2 py-1.5 font-medium sticky left-0 z-10 whitespace-nowrap
                  ${dark ? 'bg-[#1A1D27] text-white' : 'bg-white text-slate-700'}`}>
                  {cohort.label}
                </td>
                <td className={`text-right px-2 py-1.5 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {fmtNum(cohort.cohortSize)}
                </td>
                {Array.from({ length: maxPeriods }, (_, j) => {
                  const val = cohort.periods[j]
                  return (
                    <td key={j} className="text-center px-1.5 py-1.5 font-medium"
                      style={{ backgroundColor: getHeatColor(val, dark) }}>
                      <span className={val != null
                        ? (val >= 50 ? 'text-emerald-600' : val >= 20 ? (dark ? 'text-amber-400' : 'text-amber-600') : (dark ? 'text-red-400' : 'text-red-500'))
                        : (dark ? 'text-slate-700' : 'text-slate-200')}>
                        {val != null ? val.toFixed(1) + '%' : ''}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
