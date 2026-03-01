import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(undefined)  // undefined = 아직 확인 중
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      setLoading(false)
      return
    }

    /* 현재 세션 확인 */
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    /* 세션 변경 구독 (로그인/아웃) */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  /** Google OAuth 로그인 */
  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })

  /** 이메일 + 비밀번호 로그인 */
  const signInWithEmail = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  /** 로그아웃 */
  const signOut = () => supabase.auth.signOut()

  return {
    session,
    loading,
    user: session?.user ?? null,
    signInWithGoogle,
    signInWithEmail,
    signOut,
  }
}
