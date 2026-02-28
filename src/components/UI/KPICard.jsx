import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KPICard({ label, value, sub, change, dark, icon: Icon, color = 'indigo' }) {
  const isPos  = change > 0
  const isNeg  = change < 0
  const isZero = change === 0 || change == null

  const colorMap = {
    indigo: 'bg-indigo-500/10 text-indigo-500',
    blue:   'bg-blue-500/10 text-blue-500',
    green:  'bg-emerald-500/10 text-emerald-500',
    orange: 'bg-orange-500/10 text-orange-500',
    purple: 'bg-purple-500/10 text-purple-500',
  }

  return (
    <div className={`
      rounded-xl p-5 flex flex-col gap-3 border transition-all duration-200
      hover:shadow-md hover:-translate-y-0.5
      ${dark
        ? 'bg-[#1A1D27] border-[#252836]'
        : 'bg-white border-slate-200 shadow-sm'}
    `}>
      {/* 상단: 라벨 + 아이콘 */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
        {Icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.indigo}`}>
            <Icon size={16} />
          </div>
        )}
      </div>

      {/* 값 */}
      <div>
        <div className={`text-2xl font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
          {value ?? '—'}
        </div>
        {sub && (
          <div className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {sub}
          </div>
        )}
      </div>

      {/* 변화율 */}
      {!isZero && (
        <div className={`
          inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full w-fit
          ${isPos ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}
        `}>
          {isPos
            ? <TrendingUp  size={12} />
            : <TrendingDown size={12} />
          }
          {isPos ? '+' : ''}{change}%
        </div>
      )}
    </div>
  )
}
