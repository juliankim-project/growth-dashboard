import { Bell, Search } from 'lucide-react'
import { DEFAULT_SECTIONS } from './Sidebar'

export default function Header({ nav, dark }) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  const section = DEFAULT_SECTIONS.find(s => s.id === nav.section)
  const sub     = section?.subs.find(s => s.id === nav.sub)
  const title   = sub?.label || section?.label || ''

  return (
    <header className={`
      flex items-center justify-between px-7 py-4 border-b shrink-0 transition-colors duration-200
      ${dark ? 'bg-[#13151C] border-[#1E2130]' : 'bg-[#F8FAFF] border-slate-200'}
    `}>
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            {section?.label}
          </span>
          {sub && (
            <>
              <span className={`text-xs ${dark ? 'text-slate-600' : 'text-slate-300'}`}>/</span>
              <span className={`text-xs font-semibold ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>
                {title}
              </span>
            </>
          )}
        </div>
        <h1 className={`text-xl font-bold mt-0.5 ${dark ? 'text-white' : 'text-slate-800'}`}>
          {title}
        </h1>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>{today}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm
          ${dark ? 'bg-[#1A1D27] text-slate-400 border border-[#252836]' : 'bg-white text-slate-400 border border-slate-200'}
        `}>
          <Search size={13} />
          <span className="text-xs hidden sm:block">Search...</span>
        </div>
        <button className={`relative p-2 rounded-lg ${dark ? 'hover:bg-[#1A1D27] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
          G
        </div>
      </div>
    </header>
  )
}
