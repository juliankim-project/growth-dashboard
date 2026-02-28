import {
  LayoutDashboard, Megaphone, Package, Database,
  Settings, ChevronRight, Sun, Moon, BarChart2
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'overview',    label: 'Overview',     icon: LayoutDashboard },
  { id: 'marketing',   label: 'Marketing',    icon: Megaphone },
  { id: 'product',     label: 'Product',      icon: Package },
  { id: 'datastudio',  label: 'Data Studio',  icon: Database },
]

const BOTTOM_ITEMS = [
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ page, setPage, dark, toggleDark }) {
  return (
    <aside className={`
      flex flex-col w-[220px] min-h-screen shrink-0
      border-r transition-colors duration-200
      ${dark
        ? 'bg-[#0F1117] border-[#1E2130]'
        : 'bg-white border-slate-200'}
    `}>
      {/* 로고 */}
      <div className={`
        flex items-center gap-2.5 px-5 py-5
        border-b ${dark ? 'border-[#1E2130]' : 'border-slate-100'}
      `}>
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <BarChart2 size={16} className="text-white" />
        </div>
        <span className={`font-bold text-[15px] ${dark ? 'text-white' : 'text-slate-800'}`}>
          Growth HQ
        </span>
      </div>

      {/* 메인 메뉴 */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(item => {
          const Icon    = item.icon
          const active  = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                transition-all duration-150 text-left group
                ${active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : dark
                    ? 'text-slate-400 hover:bg-[#1A1D27] hover:text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }
              `}
            >
              <Icon size={17} className={active ? 'text-white' : ''} />
              <span className="font-medium">{item.label}</span>
              {active && <ChevronRight size={14} className="ml-auto opacity-70" />}
            </button>
          )
        })}
      </nav>

      {/* 하단: Settings + 다크모드 */}
      <div className={`px-3 pb-4 flex flex-col gap-1 border-t pt-3 ${dark ? 'border-[#1E2130]' : 'border-slate-100'}`}>
        {BOTTOM_ITEMS.map(item => {
          const Icon   = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                transition-all duration-150 text-left
                ${active
                  ? 'bg-indigo-600 text-white'
                  : dark
                    ? 'text-slate-400 hover:bg-[#1A1D27] hover:text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }
              `}
            >
              <Icon size={17} />
              <span className="font-medium">{item.label}</span>
            </button>
          )
        })}

        {/* 다크모드 토글 */}
        <button
          onClick={toggleDark}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
            transition-all duration-150
            ${dark
              ? 'text-slate-400 hover:bg-[#1A1D27] hover:text-white'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }
          `}
        >
          {dark
            ? <Sun  size={17} className="text-yellow-400" />
            : <Moon size={17} className="text-indigo-400" />
          }
          <span className="font-medium">{dark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  )
}
