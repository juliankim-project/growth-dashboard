import { useMemo, useState } from 'react'
import { Download, Calendar } from 'lucide-react'
import { useMarketingData } from '../../hooks/useMarketingData'
import Spinner from '../../components/UI/Spinner'

const sum = (arr, k) => arr.reduce((s, r) => s + (parseFloat(r[k]) || 0), 0)
const fmtW = n => {
  if (!n) return '0'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000)      return (n / 10_000).toFixed(1) + '만'
  return Math.round(n).toLocaleString()
}

export default function Reports({ dark }) {
  const { data, loading } = useMarketingData()
  const [groupBy, setGroupBy] = useState('channel') // channel | campaign | date

  const report = useMemo(() => {
    if (!data.length) return []
    const key = groupBy === 'channel' ? 'Channel'
      : groupBy === 'campaign' ? 'Campaign'
      : 'Event Date'

    const map = {}
    data.forEach(r => {
      const k = r[key] || '(없음)'
      if (!map[k]) map[k] = { name: k, cost: 0, impressions: 0, clicks: 0, installs: 0, conv: 0, revenue: 0 }
      map[k].cost        += parseFloat(r['Cost (Channel)']) || 0
      map[k].impressions += parseFloat(r['Impressions (Channel)']) || 0
      map[k].clicks      += parseFloat(r['Clicks (Channel)']) || 0
      map[k].installs    += parseFloat(r['Installs (App)']) || 0
      map[k].conv        += parseFloat(r['구매 완료 (App+Web)']) || 0
      map[k].revenue     += parseFloat(r['구매액 (App+Web)']) || 0
    })
    return Object.values(map)
      .map(r => ({ ...r, roas: r.cost > 0 ? (r.revenue / r.cost).toFixed(2) : '—', ctr: r.impressions > 0 ? ((r.clicks / r.impressions) * 100).toFixed(2) : '—' }))
      .sort((a, b) => b.cost - a.cost)
  }, [data, groupBy])

  const totals = useMemo(() => ({
    cost: sum(data, 'Cost (Channel)'),
    impressions: sum(data, 'Impressions (Channel)'),
    clicks: sum(data, 'Clicks (Channel)'),
    installs: sum(data, 'Installs (App)'),
    conv: sum(data, '구매 완료 (App+Web)'),
    revenue: sum(data, '구매액 (App+Web)'),
  }), [data])

  const exportCSV = () => {
    const headers = ['이름', '광고비', '노출', '클릭', '인스톨', '구매', '매출', 'ROAS', 'CTR']
    const rows = report.map(r => [r.name, r.cost, r.impressions, r.clicks, r.installs, r.conv, r.revenue, r.roas, r.ctr])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `report_${groupBy}.csv`; a.click()
  }

  const th = `px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`
  const td = `px-4 py-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`

  if (loading) return <Spinner dark={dark} />

  return (
    <div className="p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* 그룹 선택 */}
        <div className="flex items-center gap-2">
          {[['channel','채널별'], ['campaign','캠페인별'], ['date','날짜별']].map(([v, l]) => (
            <button key={v} onClick={() => setGroupBy(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${groupBy === v
                  ? 'bg-indigo-600 text-white'
                  : dark ? 'bg-[#1A1D27] text-slate-400 border border-[#252836]' : 'bg-white text-slate-500 border border-slate-200'}`}>
              {l}
            </button>
          ))}
        </div>

        <button onClick={exportCSV}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
            ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#1A1D27]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
          <Download size={13} /> CSV 내보내기
        </button>
      </div>

      {/* 합계 요약 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          ['총 광고비', fmtW(totals.cost)],
          ['노출',      Math.round(totals.impressions).toLocaleString()],
          ['클릭',      Math.round(totals.clicks).toLocaleString()],
          ['인스톨',    Math.round(totals.installs).toLocaleString()],
          ['구매',      Math.round(totals.conv).toLocaleString()],
          ['ROAS',      totals.cost > 0 ? (totals.revenue / totals.cost).toFixed(2) + 'x' : '—'],
        ].map(([label, value]) => (
          <div key={label} className={`rounded-xl px-4 py-3 border ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
            <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
            <p className={`text-base font-bold mt-0.5 ${dark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 테이블 */}
      <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={dark ? 'bg-[#13151C]' : 'bg-slate-50'}>
                {['이름', '광고비', '노출', '클릭', '인스톨', '구매', '매출', 'ROAS', 'CTR'].map(h => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.map((r, i) => (
                <tr key={i} className={`border-t transition-colors ${dark ? 'border-[#252836] hover:bg-[#13151C]' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <td className={`px-4 py-3 text-xs font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>{r.name}</td>
                  <td className={td}>{fmtW(r.cost)}</td>
                  <td className={td}>{Math.round(r.impressions).toLocaleString()}</td>
                  <td className={td}>{Math.round(r.clicks).toLocaleString()}</td>
                  <td className={td}>{Math.round(r.installs).toLocaleString()}</td>
                  <td className={td}>{Math.round(r.conv).toLocaleString()}</td>
                  <td className={td}>{fmtW(r.revenue)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${parseFloat(r.roas) >= 2 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500'}`}>
                      {r.roas}x
                    </span>
                  </td>
                  <td className={td}>{r.ctr}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
