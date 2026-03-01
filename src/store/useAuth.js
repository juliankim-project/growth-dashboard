import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session,     setSession]     = useState(undefined)
  const [loading,     setLoading]     = useState(true)
  const [accessError, setAccessError] = useState('')   // 권한 없는 이메일

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkAllowed(session)
      } else {
        setSession(null)
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkAllowed(session)
      } else {
        setSession(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * 로그인 후 allowed_users 테이블에서 이메일 확인
   * 없으면 즉시 로그아웃
   */
  async function checkAllowed(session) {
    try {
      const { data, error } = await supabase
        .from('allowed_users')
        .select('email')
        .eq('email', session.user.email)
        .maybeSingle()

      if (error || !data) {
        // 허용 목록에 없음 → 로그아웃
        await supabase.auth.signOut()
        setAccessError(`${session.user.email} 은(는) 접근 권한이 없습니다. 관리자에게 문의하세요.`)
        setSession(null)
      } else {
        setAccessError('')
        setSession(session)
      }
    } catch {
      await supabase.auth.signOut()
      setSession(null)
    }
    setLoading(false)
  }

  /** 매직링크 발송 */
  const signInWithMagicLink = (email) =>
    supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

  /** 로그아웃 */
  const signOut = () => supabase.auth.signOut()

  return {
    session,
    loading,
    accessError,
    user: session?.user ?? null,
    signInWithMagicLink,
    signOut,
  }
}
