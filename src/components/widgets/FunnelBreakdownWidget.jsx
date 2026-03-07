import { useMemo } from 'react'
import { groupData, fmtMetric } from './widgetUtils'

export default function FunnelBreakdownWidget({ data, config, dark, metrics: metricsProp }) {
  const { stages = [], groupBy = 'channel', title = '퍼널 브레이크다운' } = config

  const grouped = useMemo(() => {
    if (!data?.length || stages.length === 0) return []
    return groupData(data, groupBy, stages.map(s => s.metric), metricsProp)
  }, [data, stages, groupBy, metricsProp])

  return (
    <div className={`rounded-xl p-5 border h-full flex flex-col
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <p className={`text-xs font-semibold mb-4 ${dark ? 'text-white' : 'text-slate-700'}`}>
        {title}
      </p>

      {stages.length === 0 ? (
        <div className={`text-center py-10 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          퍼널 단계가 설정되지 않았습니다
        </div>
      ) : grouped.length === 0 ? (
        <div className={`text-center py-10 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          데이터가 없습니다
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden flex-1
          ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className={dark ? 'bg-[#20232E]' : 'bg-slate-50'}>
                  <th className={`text-left px-3 py-2.5 font-semibold
                    ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                    {groupBy === 'channel' ? '채널' : groupBy}
                  </th>
                  {stages.map(s => (
                    <th key={s.id} className={`text-right px-3 py-2.5 font-semibold
                      ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                      {s.label}
                    </th>
                  ))}
                  {stages.slice(1).map((s, i) => (
                    <th key={`cr_${s.id}`} className={`text-right px-3 py-2.5 font-semibold
                      ${dark ? 'text-amber-400/70' : 'text-amber-600'}`}>
                      {stages[i].label}&rarr;{s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map(row => (
                  <tr key={row.name}
                    className={`border-t ${dark ? 'border-[#252836] hover:bg-[#20232E]' : 'border-slate-100 hover:bg-slate-50'}`}>
                    <td className={`px-3 py-2 font-medium
                      ${dark ? 'text-white' : 'text-slate-700'}`}>
                      {row.name}
                    </td>
                    {stages.map(s => (
                      <td key={s.id} className={`text-right px-3 py-2
                        ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {fmtMetric(s.metric, row[s.metric] || 0, metricsProp)}
                      </td>
                    ))}
                    {stages.slice(1).map((s, i) => {
                      const prev = row[stages[i].metric] || 0
                      const cur = row[s.metric] || 0
                      const rate = prev > 0 ? ((cur / prev) * 100).toFixed(1) : null
                      return (
                        <td key={`cr_${s.id}`} className={`text-right px-3 py-2 font-medium
                          ${rate === null
                            ? (dark ? 'text-slate-500' : 'text-slate-400')
                            : parseFloat(rate) >= 50 ? 'text-emerald-500'
                            : parseFloat(rate) >= 20 ? 'text-amber-500'
                            : 'text-red-500'}`}>
                          {rate === null ? '\u2014' : rate + '%'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
