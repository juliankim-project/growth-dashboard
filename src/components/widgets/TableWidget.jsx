import { useMemo, useState, memo } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { groupData, fmtMetric } from './widgetUtils'

function TableWidget({ data, config, dark, metrics: metricsProp }) {
  const { metrics = ['cost','installs','conv','revenue'], groupBy = 'channel', title = '성과 테이블' } = config
  const [sort, setSort] = useState({ key: metrics[0] || 'cost', dir: -1 })

  // 최적화: groupData 결과를 먼저 캐싱, 정렬은 분리
  const grouped = useMemo(() => {
    return groupData(data, groupBy, metrics, metricsProp)
  }, [data, metrics, groupBy, metricsProp])

  const rows = useMemo(() => {
    if (!grouped || grouped.length === 0) return []
    // 최적화: 원본 배열 복사 감소, 이미 groupData에서 Object.values() 호출됨
    return [...grouped].sort((a, b) => {
      const av = a[sort.key] ?? 0, bv = b[sort.key] ?? 0
      return (bv - av) * -sort.dir
    })
  }, [grouped, sort])

  const toggle = key => setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: -1 })

  const th = `px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide cursor-pointer select-none ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-600 hover:text-slate-600'}`
  const td = `px-3 py-2.5 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`

  return (
    <div className={`rounded-xl border h-full flex flex-col overflow-hidden ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className={`px-3 py-2 border-b ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
        <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>{title}</p>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className={dark ? 'bg-[#1D2125]' : 'bg-slate-50'}>
              <th className={th} onClick={() => toggle('name')}>이름</th>
              {metrics.map(mid => {
                const meta = metricsProp?.find(x => x.id === mid)
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
              <tr key={i} className={`border-t transition-colors ${dark ? 'border-[#A1BDD914] hover:bg-[#1D2125]' : 'border-slate-100 hover:bg-slate-50'}`}>
                <td className={`${td} font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>{row.name}</td>
                {metrics.map(mid => {
                  const meta = metricsProp?.find(x => x.id === mid)
                  const isRoas = meta?.fmt === 'roas'
                  return (
                    <td key={mid} className={td}>
                      {isRoas
                        ? <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${(row[mid] || 0) >= 2 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                            {fmtMetric(mid, row[mid] || 0, metricsProp)}
                          </span>
                        : fmtMetric(mid, row[mid] || 0, metricsProp)
                      }
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={metrics.length + 1} className="px-4 py-8 text-center text-xs text-slate-500">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default memo(TableWidget)
