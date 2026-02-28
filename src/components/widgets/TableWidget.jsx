import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { METRICS, GROUP_BY } from '../../store/useConfig'
import { groupData, fmtMetric } from './widgetUtils'

export default function TableWidget({ data, config, dark }) {
  const { metrics = ['cost','installs','conv','revenue'], groupBy = 'Channel', title = '성과 테이블' } = config
  const [sort, setSort] = useState({ key: metrics[0] || 'cost', dir: -1 })

  const rows = useMemo(() => {
    const g = groupData(data, groupBy, metrics)
    return [...g].sort((a, b) => {
      const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0
      return (bv - av) * -sort.dir
    })
  }, [data, metrics, groupBy, sort])

  const toggle = key => setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: -1 })

  const th = `px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide cursor-pointer select-none ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`
  const td = `px-3 py-2.5 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`

  return (
    <div className={`rounded-xl border h-full flex flex-col overflow-hidden ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className={`px-4 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
        <p className={`text-xs font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className={dark ? 'bg-[#13151C]' : 'bg-slate-50'}>
              <th className={th} onClick={() => toggle('name')}>이름</th>
              {metrics.map(mid => {
                const meta = METRICS.find(x => x.id === mid)
                return (
                  <th key={mid} className={th} onClick={() => toggle(mid)}>
                    <span className="flex items-center gap-1">
                      {meta?.label || mid}
                      {sort.key === mid && <ArrowUpDown size={9}/>}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-t transition-colors ${dark ? 'border-[#252836] hover:bg-[#13151C]' : 'border-slate-100 hover:bg-slate-50'}`}>
                <td className={`${td} font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>{row.name}</td>
                {metrics.map(mid => (
                  <td key={mid} className={td}>
                    {mid === 'roas'
                      ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row[mid] >= 2 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                          {fmtMetric(mid, row[mid] || 0)}
                        </span>
                      : fmtMetric(mid, row[mid] || 0)
                    }
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={metrics.length + 1} className="px-4 py-8 text-center text-xs text-slate-400">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
