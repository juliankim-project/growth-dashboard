import { Construction } from 'lucide-react'

export default function GoogleAds({ dark }) {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className={`rounded-2xl border p-12 text-center max-w-sm w-full mx-6
        ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4
          ${dark ? 'bg-[#1D2125]' : 'bg-slate-50'}`}>
          <Construction size={24} className="text-[#579DFF]" />
        </div>
        <p className={`font-bold text-base ${dark ? 'text-white' : 'text-slate-800'}`}>
          개발 준비 중
        </p>
        <p className={`text-xs mt-2 leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
          Google Trends API / Google Ads API 연동은 준비 중입니다.<br />
          곧 지원될 예정입니다.
        </p>
      </div>
    </div>
  )
}
