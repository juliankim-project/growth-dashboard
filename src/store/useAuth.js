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

    /* 세션 변경 구독 (로그인/아웃/매직링크 콜백) */
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * 매직링크 발송
   * - 등록된 이메일이면 로그인 링크 전송
   * - Supabase 설정에서 신규가입 비활성화 시 초대된 유저만 가능
   */
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
    user: session?.user ?? null,
    signInWithMagicLink,
    signOut,
  }
}
