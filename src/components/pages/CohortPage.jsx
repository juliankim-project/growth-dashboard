import { useState, useMemo } from 'react'
import { METRICS } from '../../store/useConfig'
import { fmtNum } from '../widgets/widgetUtils'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const NON_DERIVED_METRICS = METRICS.filter(m => !m.derived)

/* ── 코호트 데이터 처리 ── */
function buildCohortData(data, granularity, cohortEvent, retentionEvent, periods) {
  if (!data?.length) return { cohorts: [], averages: [] }

  const cohortMetric = METRICS.find(m => m.id === cohortEvent)
  const retMetric = METRICS.find(m => m.id === retentionEvent)
  if (!cohortMetric?.field || !retMetric?.field) return { cohorts: [], averages: [] }

  // 날짜별 집계
  const byDate = {}
  data.forEach(r => {
    const d = (r.date || r['Event Date'])?.slice(0, 10)
    if (!d) return
    if (!byDate[d]) byDate[d] = { cohortVal: 0, retVal: 0 }
    byDate[d].cohortVal += parseFloat(r[cohortMetric.field]) || 0
    byDate[d].retVal += parseFloat(r[retMetric.field]) || 0
  })

  // 기간별 그룹핑
  const getGroup = (dateStr) => {
    const d = new Date(dateStr)
    if (granularity === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    // week: ISO week
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

  // 코호트 테이블 생성
  const cohorts = []
  for (let i = 0; i < numCohorts; i++) {
    const [label, vals] = sortedGroups[i]
    const row = {
      label,
      cohortSize: vals.cohortVal,
      periods: [],
    }
    // 각 후속 기간의 리텐션
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

  // 평균 리텐션 트렌드
  const averages = []
  for (let j = 0; j < numCohorts; j++) {
    const vals = cohorts.filter(c => c.periods[j] !== undefined).map(c => c.periods[j])
    if (vals.length === 0) break
    averages.push({
      period: j === 0 ? (granularity === 'month' ? 'M0' : 'W0') : (granularity === 'month' ? `M${j}` : `W${j}`),
      retention: vals.reduce((s, v) => s + v, 0) / vals.length,
    })
  }

  return { cohorts, averages }
}

/* ── 히트맵 셀 색상 ── */
function getHeatColor(value, dark) {
  if (value == null) return 'transparent'
  // 0% → 빨강, 50% → 노랑, 100% → 초록
  const r = value < 50 ? 255 : Math.round(255 - (value - 50) * 5.1)
  const g = value < 50 ? Math.round(value * 5.1) : 255
  const opacity = dark ? 0.3 : 0.25
  return `rgba(${r}, ${g}, 60, ${opacity})`
}

/* ── 메인 코호트 페이지 ── */
export default function CohortPage({ dashboard, setDashboard, data, dark, editMode }) {
  const granularity = dashboard?.granularity || 'week'
  const cohortEvent = dashboard?.cohortEvent || 'signup'
  const retentionEvent = dashboard?.retentionEvent || 'conv'
  const periods = dashboard?.periods || 8

  const update = (changes) => setDashboard({ ...dashboard, ...changes })

  const { cohorts, averages } = useMemo(
    () => buildCohortData(data, granularity, cohortEvent, retentionEvent, periods),
    [data, granularity, cohortEvent, retentionEvent, periods]
  )

  const maxPeriods = Math.max(...cohorts.map(c => c.periods.length), 0)

  return (
    <div className="space-y-4">
      {/* 설정 바 */}
      {editMode && (
        <div className={`rounded-xl border p-4
          ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-700'}`}>코호트 설정</p>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-700'}`}>단위</label>
              <div className="flex gap-1">
                <button onClick={() => update({ granularity: 'week' })}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors
                  ${granularity === 'week' ? 'bg-indigo-600 text-white' : dark ? 'bg-[#20232E] text-slate-400' : 'bg-slate-100 text-slate-700'}`}>
                  주간
                </button>
                <button onClick={() => update({ granularity: 'month' })}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors
                  ${granularity === 'month' ? 'bg-indigo-600 text-white' : dark ? 'bg-[#20232E] text-slate-400' : 'bg-slate-100 text-slate-700'}`}>
                  월간
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-700'}`}>코호트 이벤트</label>
              <select value={cohortEvent} onChange={e => update({ cohortEvent: e.target.value })}
                className={`text-xs px-2 py-1 rounded-lg border outline-none
                ${dark ? 'bg-[#1A1D27] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                {NON_DERIVED_METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-700'}`}>리텐션 이벤트</label>
              <select value={retentionEvent} onChange={e => update({ retentionEvent: e.target.value })}
                className={`text-xs px-2 py-1 rounded-lg border outline-none
                ${dark ? 'bg-[#1A1D27] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                {NON_DERIVED_METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className={`text-[10px] ${dark ? 'text-slate-400' : 'text-slate-700'}`}>기간 수</label>
              <input type="number" min={2} max={20} value={periods}
                onChange={e => update({ periods: Number(e.target.value) })}
                className={`text-xs px-2 py-1 rounded-lg border outline-none w-14
                ${dark ? 'bg-transparent border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-800'}`}
              />
            </div>
          </div>
        </div>
      )}

      {cohorts.length === 0 ? (
        <div className={`text-center py-16 rounded-xl border
          ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
            {data?.length ? '설정을 조정해서 코호트 데이터를 확인하세요' : '데이터가 없습니다'}
          </p>
        </div>
      ) : (
        <>
          {/* KPI 요약 */}
          <div className="flex gap-3 flex-wrap">
            <div className={`rounded-xl border px-4 py-3 min-w-[120px]
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
              <p className={`text-[10px] mb-1 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>코호트 수</p>
              <p className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{cohorts.length}</p>
            </div>
            {averages.length >= 2 && (
              <>
                <div className={`rounded-xl border px-4 py-3 min-w-[120px]
                  ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
                  <p className={`text-[10px] mb-1 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                    {averages[1]?.period} 평균 리텐션
                  </p>
                  <p className={`text-lg font-bold ${averages[1]?.retention >= 30 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {averages[1]?.retention.toFixed(1)}%
                  </p>
                </div>
                {averages.length >= 5 && (
                  <div className={`rounded-xl border px-4 py-3 min-w-[120px]
                    ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
                    <p className={`text-[10px] mb-1 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                      {averages[4]?.period} 평균 리텐션
                    </p>
                    <p className={`text-lg font-bold ${averages[4]?.retention >= 15 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {averages[4]?.retention.toFixed(1)}%
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 리텐션 히트맵 */}
          <div className={`rounded-xl border overflow-hidden
            ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs font-semibold px-4 pt-4 pb-2 ${dark ? 'text-white' : 'text-slate-700'}`}>
              리텐션 히트맵
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className={dark ? 'bg-[#20232E]' : 'bg-slate-50'}>
                    <th className={`text-left px-3 py-2 font-semibold sticky left-0 z-10
                      ${dark ? 'bg-[#20232E] text-slate-400' : 'bg-slate-50 text-slate-700'}`}>
                      코호트
                    </th>
                    <th className={`text-right px-3 py-2 font-semibold ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                      규모
                    </th>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                      <th key={i} className={`text-center px-2 py-2 font-semibold min-w-[48px]
                        ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                        {granularity === 'month' ? `M${i}` : `W${i}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((cohort, ci) => (
                    <tr key={ci}
                      className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                      <td className={`px-3 py-2 font-medium sticky left-0 z-10
                        ${dark ? 'bg-[#1A1D27] text-white' : 'bg-white text-slate-700'}`}>
                        {cohort.label}
                      </td>
                      <td className={`text-right px-3 py-2 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {fmtNum(cohort.cohortSize)}
                      </td>
                      {Array.from({ length: maxPeriods }, (_, j) => {
                        const val = cohort.periods[j]
                        return (
                          <td key={j} className="text-center px-2 py-2 font-medium"
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

          {/* 평균 리텐션 트렌드 */}
          {averages.length >= 2 && (
            <div className={`rounded-xl border p-4
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
              <p className={`text-xs font-semibold mb-3 ${dark ? 'text-white' : 'text-slate-700'}`}>
                평균 리텐션 트렌드
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={averages}>
                  <defs>
                    <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#252836' : '#E2E8F0'} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: dark ? '#64748B' : '#475569' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: dark ? '#64748B' : '#475569' }}
                    tickFormatter={v => v + '%'} />
                  <Tooltip contentStyle={{
                    backgroundColor: dark ? '#1A1D27' : '#FFF',
                    border: `1px solid ${dark ? '#252836' : '#E2E8F0'}`,
                    borderRadius: 8, fontSize: 11,
                  }}
                    formatter={(v) => [v.toFixed(1) + '%', '평균 리텐션']} />
                  <Area type="monotone" dataKey="retention" stroke="#6366F1" strokeWidth={2}
                    fill="url(#retGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
