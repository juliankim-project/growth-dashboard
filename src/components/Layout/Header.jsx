import { Bell, Search } from 'lucide-react'

const PAGE_TITLES = {
  overview:   'Overview',
  marketing:  'Marketing',
  product:    'Product',
  datastudio: 'Data Studio',
  settings:   'Settings',
}

export default function Header({ page, dark }) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <header className={`
      flex items-center justify-between px-7 py-4
      border-b shrink-0 transition-colors duration-200
      ${dark
        ? 'bg-[#13151C] border-[#1E2130]'
        : 'bg-[#F8FAFF] border-slate-200'}
    `}>
      {/* 페이지 제목 */}
      <div>
        <h1 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
          {PAGE_TITLES[page] || page}
        </h1>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          {today}
        </p>
      </div>

      {/* 우측 액션 */}
      <div className="flex items-center gap-3">
        {/* 검색 */}
        <div className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm
          ${dark
            ? 'bg-[#1A1D27] text-slate-400 border border-[#252836]'
            : 'bg-white text-slate-400 border border-slate-200'}
        `}>
          <Search size={14} />
          <span className="text-xs hidden sm:block">Search...</span>
        </div>

        {/* 알림 */}
        <button className={`
          relative p-2 rounded-lg
          ${dark ? 'hover:bg-[#1A1D27] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}
        `}>
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>

        {/* 프로필 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
            G
          </div>
        </div>
      </div>
    </header>
  )
}
