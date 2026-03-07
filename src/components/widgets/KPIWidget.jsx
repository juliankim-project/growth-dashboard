import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { calcMetric, fmtMetric } from './widgetUtils'

const COLOR_MAP = {
  /* 지표 (legacy + dynamic ID 동시 지원) */
  cost:         'text-indigo-500  bg-indigo-500/10',
  spend:        'text-indigo-500  bg-indigo-500/10',
  impr:         'text-sky-500     bg-sky-500/10',
  impressions:  'text-sky-500     bg-sky-500/10',
  clicks:       'text-pink-500    bg-pink-500/10',
  view_content: 'text-cyan-500    bg-cyan-500/10',
  signup:       'text-teal-500    bg-teal-500/10',
  signups:      'text-teal-500    bg-teal-500/10',
  conv:         'text-orange-500  bg-orange-500/10',
  purchases:    'text-orange-500  bg-orange-500/10',
  revenue:      'text-emerald-500 bg-emerald-500/10',
  installs:     'text-blue-500    bg-blue-500/10',
  /* 단가 */
  cpm:          'text-violet-500  bg-violet-500/10',
  cpc:          'text-rose-500    bg-rose-500/10',
  ctr:          'text-lime-500    bg-lime-500/10',
  cpa_view:     'text-amber-500   bg-amber-500/10',
  cac:          'text-fuchsia-500 bg-fuchsia-500/10',
  cps:          'text-red-500     bg-red-500/10',
  roas:         'text-purple-500  bg-purple-500/10',
  /* 프로덕트 메트릭 */
  payment_amount:     'text-emerald-500  bg-emerald-500/10',
  original_price:     'text-teal-500     bg-teal-500/10',
  cc_order_count:     'text-orange-500   bg-orange-500/10',
  cc_avg_payment:     'text-indigo-500   bg-indigo-500/10',
  cc_price_per_person:'text-violet-500   bg-violet-500/10',
  nights:             'text-sky-500      bg-sky-500/10',
  peoples:            'text-cyan-500     bg-cyan-500/10',
  lead_time:          'text-amber-500    bg-amber-500/10',
}

const ICON_MAP = {
  cost:'₩', spend:'₩', impr:'👁', impressions:'👁', clicks:'🖱',
  view_content:'📄', signup:'👤', signups:'👤',
  conv:'🛒', purchases:'🛒', revenue:'↑', installs:'📲',
  cpm:'₩', cpc:'₩', ctr:'%', cpa_view:'₩', cac:'₩', cps:'₩', roas:'✕',
  payment_amount:'₩', original_price:'₩',
  cc_order_count:'#', cc_avg_payment:'₩', cc_price_per_person:'₩',
  nights:'🌙', peoples:'👥', lead_time:'⏱',
}

export default function KPIWidget({ data, config, dark, metrics: metricsProp }) {
  const { metric = 'cost', label = '' } = config
  const metaDef  = metricsProp?.find(m => m.id === metric)
  const title    = label || metaDef?.label || metric
  const value    = useMemo(() => calcMetric(data, metric, metricsProp), [data, metric, metricsProp])
  const display  = fmtMetric(metric, value, metricsProp)
  const colorCls = COLOR_MAP[metric] || 'text-slate-500 bg-slate-500/10'

  return (
    <div className={`
      rounded-xl px-4 py-3 border flex flex-col gap-1.5
      transition-all hover:shadow-md hover:-translate-y-0.5
      ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}
    `}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-widest truncate ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
          {title}
        </span>
        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0 ${colorCls}`}>
          {ICON_MAP[metric] || '📊'}
        </div>
      </div>
      <div className={`text-lg font-bold leading-tight ${dark ? 'text-white' : 'text-slate-800'}`}>
        {display}
      </div>
    </div>
  )
}
