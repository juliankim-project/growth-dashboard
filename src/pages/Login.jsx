import { useState } from 'react'
import { Mail, BarChart2, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function Login({ onSignInWithMagicLink, dark, accessError }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error } = await onSignInWithMagicLink(email.trim())
    if (error) {
      // Supabase 에러 메시지 한국어로 변환
      const msg = error.message || ''
      if (msg.includes('Signups not allowed') || msg.includes('not allowed')) {
        setError('등록되지 않은 이메일입니다. 관리자에게 문의하세요.')
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        setError('잠시 후 다시 시도해주세요. (요청 횟수 초과)')
      } else {
        setError('오류가 발생했습니다. 다시 시도해주세요.')
      }
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  const inp = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors
    ${dark
      ? 'bg-[#13151C] border-[#252836] text-white placeholder:text-slate-600 focus:border-indigo-500'
      : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-300 focus:border-indigo-400'}`

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${dark ? 'bg-[#0F1117]' : 'bg-[#F4F6FA]'}`}>
      <div className="w-full max-w-sm">

        {/* 로고 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/30">
            <BarChart2 size={24} className="text-white" />
          </div>
          <h1 className={`text-xl font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
            Growth Dashboard
          </h1>
          <p className={`text-xs mt-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
            내부 구성원만 접근 가능합니다
          </p>
        </div>

        {/* 카드 */}
        <div className={`rounded-2xl border p-6 shadow-xl ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}>

          {sent ? (
            /* ── 전송 완료 상태 ── */
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
              <div>
                <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>
                  이메일을 확인해주세요
                </p>
                <p className={`text-xs mt-1.5 leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className="font-medium text-indigo-400">{email}</span>으로<br/>
                  로그인 링크를 보냈어요.<br/>
                  링크를 클릭하면 바로 접속됩니다.
                </p>
              </div>
              <button
                onClick={() => { setSent(false); setEmail('') }}
                className={`text-xs mt-2 ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
              >
                다른 이메일로 시도
              </button>
            </div>
          ) : (
            /* ── 이메일 입력 폼 ── */
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <p className={`text-sm font-semibold mb-1 ${dark ? 'text-white' : 'text-slate-800'}`}>
                  로그인
                </p>
                <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                  이메일 주소를 입력하면 로그인 링크를 보내드려요
                </p>
              </div>

              {/* 접근 권한 없음 에러 (외부에서 전달) */}
              {accessError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  🚫 {accessError}
                </div>
              )}

              {/* 일반 에러 */}
              {error && (
                <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {error}
                </div>
              )}

              <div className="relative">
                <Mail size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500' : 'text-slate-300'}`} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  autoComplete="email"
                  autoFocus
                  className={`${inp} pl-10`}
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : (
                    <>
                      로그인 링크 보내기
                      <ArrowRight size={15} />
                    </>
                  )
                }
              </button>
            </form>
          )}
        </div>

        <p className={`text-center text-xs mt-4 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
          접근 권한이 없다면 관리자에게 문의하세요
        </p>
      </div>
    </div>
  )
}
