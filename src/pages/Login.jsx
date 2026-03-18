import { BarChart2, LogIn } from 'lucide-react'

export default function Login({ onSignIn, dark, accessError }) {
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${dark ? 'bg-[#1D2125]' : 'bg-[#F7F8F9]'}`}>
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#0C66E4] flex items-center justify-center mb-3 shadow-lg shadow-[#0C66E4]/30">
            <BarChart2 size={28} className="text-white" />
          </div>
          <h1 className={`text-2xl font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
            Growth Dashboard
          </h1>
          <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
            내부 구성원만 접근 가능합니다
          </p>
        </div>

        {/* 카드 */}
        <div className={`rounded-2xl border p-7 shadow-xl ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-col gap-4">
            <div>
              <p className={`text-base font-semibold mb-1 ${dark ? 'text-white' : 'text-slate-800'}`}>
                로그인
              </p>
              <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                Plott 계정으로 로그인합니다
              </p>
            </div>

            {accessError && (
              <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {accessError}
              </div>
            )}

            <button
              onClick={onSignIn}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#0C66E4] text-white text-base font-semibold rounded-xl hover:bg-[#0055CC] transition-colors"
            >
              <LogIn size={18} />
              Plott SSO로 로그인
            </button>
          </div>
        </div>

        <p className={`text-center text-sm mt-4 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
          Plott OS 계정이 필요합니다
        </p>
      </div>
    </div>
  )
}
