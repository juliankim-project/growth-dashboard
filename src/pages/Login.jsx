import { useState } from 'react'
import { Eye, EyeOff, LogIn, BarChart2 } from 'lucide-react'

/* Google 아이콘 SVG */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function Login({ onSignInWithGoogle, onSignInWithEmail, dark }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [mode,     setMode]     = useState('google') // 'google' | 'email'

  const handleEmailLogin = async e => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    const { error } = await onSignInWithEmail(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await onSignInWithGoogle()
    if (error) { setError(error.message); setLoading(false) }
  }

  const inp = `w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors
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

          {/* 에러 */}
          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Google 로그인 */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all
              ${dark
                ? 'bg-[#13151C] border-[#252836] text-white hover:border-indigo-500/40 hover:bg-[#0F1117]'
                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:shadow-sm'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <GoogleIcon />
            Google 계정으로 로그인
          </button>

          {/* 구분선 */}
          <div className="flex items-center gap-3 my-4">
            <div className={`flex-1 h-px ${dark ? 'bg-[#252836]' : 'bg-slate-100'}`} />
            <span className={`text-xs ${dark ? 'text-slate-600' : 'text-slate-300'}`}>또는</span>
            <div className={`flex-1 h-px ${dark ? 'bg-[#252836]' : 'bg-slate-100'}`} />
          </div>

          {/* 이메일/비밀번호 */}
          <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일"
              autoComplete="email"
              className={inp}
            />
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호"
                autoComplete="current-password"
                className={`${inp} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-300 hover:text-slate-500'}`}
              >
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <LogIn size={15} />}
              이메일로 로그인
            </button>
          </form>
        </div>

        <p className={`text-center text-xs mt-4 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
          접근 권한이 없다면 관리자에게 문의하세요
        </p>
      </div>
    </div>
  )
}
