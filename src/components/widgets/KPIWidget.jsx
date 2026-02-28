import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { METRICS } from '../../store/useConfig'
import { calcMetric, fmtMetric } from './widgetUtils'

const COLOR_MAP = {
  cost:     'text-indigo-500  bg-indigo-500/10',
  revenue:  'text-emerald-500 bg-emerald-500/10',
  roas:     'text-purple-500  bg-purple-500/10',
  installs: 'text-blue-500    bg-blue-500/10',
  conv:     'text-orange-500  bg-orange-500/10',
  signup:   'text-teal-500    bg-teal-500/10',
  impr:     'text-sky-500     bg-sky-500/10',
  clicks:   'text-pink-500    bg-pink-500/10',
  ctr:      'text-lime-500    bg-lime-500/10',
  cpc:      'text-rose-500    bg-rose-500/10',
}

const ICON_MAP = {
  cost:'₩', revenue:'↑', roas:'✕', installs:'📲', conv:'🛒',
  signup:'👤', impr:'👁', clicks:'🖱', ctr:'%', cpc:'₩'
}

export default function KPIWidget({ data, config, dark }) {
  const { metric = 'cost', label = '' } = config
  const metaDef  = METRICS.find(m => m.id === metric)
  const title    = label || metaDef?.label || metric
  const value    = useMemo(() => calcMetric(data, metric), [data, metric])
  const display  = fmtMetric(metric, value)
  const colorCls = COLOR_MAP[metric] || 'text-slate-500 bg-slate-500/10'

  return (
    <div className={`
      rounded-xl p-5 border flex flex-col gap-3 h-full
      transition-all hover:shadow-md hover:-translate-y-0.5
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}
    `}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          {title}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${colorCls}`}>
          {ICON_MAP[metric] || '📊'}
        </div>
      </div>
      <div>
        <div className={`text-2xl font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
          {display}
        </div>
      </div>
    </div>
  )
}
