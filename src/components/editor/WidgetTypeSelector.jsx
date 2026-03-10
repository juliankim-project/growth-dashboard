import { WIDGET_TYPES } from '../../store/useConfig'
import { WIDGET_TYPE_SVGS } from './WidgetTypeSVGs'

export default function WidgetTypeSelector({ value, onChange, dark }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {WIDGET_TYPES.map(wt => {
        const SvgIcon = WIDGET_TYPE_SVGS[wt.id]
        const on = value === wt.id
        return (
          <button
            key={wt.id}
            type="button"
            onClick={() => onChange(wt.id)}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all
              ${on
                ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                : dark
                  ? 'border-[#252836] bg-[#0F1117] hover:border-indigo-500/40'
                  : 'border-slate-200 bg-white hover:border-indigo-300'
              }`}
          >
            <div className="w-full h-7">
              {SvgIcon && <SvgIcon active={on} dark={dark} />}
            </div>
            <span className={`text-[9px] font-medium leading-tight text-center
              ${on
                ? 'text-indigo-400'
                : dark ? 'text-slate-400' : 'text-slate-500'
              }`}>
              {wt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
