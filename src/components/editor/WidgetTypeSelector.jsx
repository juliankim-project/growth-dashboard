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
                ? 'border-[#579DFF] bg-[#579DFF]/10 ring-1 ring-[#579DFF]/30'
                : dark
                  ? 'border-[#A1BDD914] bg-[#1D2125] hover:border-[#579DFF]/40'
                  : 'border-slate-200 bg-white hover:border-[#85B8FF]'
              }`}
          >
            <div className="w-full h-7">
              {SvgIcon && <SvgIcon active={on} dark={dark} />}
            </div>
            <span className={`text-[9px] font-medium leading-tight text-center
              ${on
                ? 'text-[#579DFF]'
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
