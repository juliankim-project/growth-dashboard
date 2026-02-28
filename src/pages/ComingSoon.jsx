import { DEFAULT_SECTIONS } from '../components/Layout/Sidebar'
import { Construction } from 'lucide-react'

export default function ComingSoon({ dark, nav }) {
  const section = DEFAULT_SECTIONS.find(s => s.id === nav?.section)
  const sub     = section?.subs.find(s => s.id === nav?.sub)

  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className={`rounded-2xl border p-12 text-center max-w-sm w-full mx-6
        ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4
          ${dark ? 'bg-[#13151C]' : 'bg-slate-50'}`}>
          <Construction size={24} className="text-indigo-500" />
        </div>
        <p className={`font-bold text-base ${dark ? 'text-white' : 'text-slate-800'}`}>
          {sub?.label || '준비 중'}
        </p>
        <p className={`text-xs mt-2 leading-relaxed ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          이 페이지는 현재 개발 중이에요.<br />
          Data Studio에서 데이터를 먼저 업로드해주세요.
        </p>
      </div>
    </div>
  )
}
