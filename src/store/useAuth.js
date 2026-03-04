import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session,     setSession]     = useState(undefined)
  const [loading,     setLoading]     = useState(true)
  const [accessError, setAccessError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) checkAllowed(session)
      else { setSession(null); setLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) checkAllowed(session)
      else { setSession(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  /**
   * 매직링크 클릭 후 세션이 생기면 allowed_users 확인
   * ※ Supabase allowed_users 테이블에 아래 두 가지 RLS 정책 필요:
   *   1) anon   SELECT  USING (true)           ← 로그인 전 사전 체크용
   *   2) authenticated SELECT USING (true)     ← 로그인 후 이 함수용
   */
  async function checkAllowed(session) {
    try {
      const { data, error } = await supabase
        .from('allowed_users')
        .select('email')
        .eq('email', session.user.email)
        .maybeSingle()

      if (error) {
        // DB / RLS 오류 → 로그인은 허용하되 콘솔에 경고
        // (authenticated SELECT 정책이 없으면 여기에 걸림 → Supabase에서 정책 추가 필요)
        console.warn('[checkAllowed] allowed_users 쿼리 오류:', error.message)
        setAccessError('')
        setSession(session)
      } else if (!data) {
        // 테이블에 없는 이메일 → 로그아웃
        await supabase.auth.signOut()
        setAccessError('등록되지 않은 이메일입니다. 관리자에게 문의하세요.')
        setSession(null)
      } else {
        // 정상 허용
        setAccessError('')
        setSession(session)
      }
    } catch (e) {
      console.warn('[checkAllowed] 예외:', e)
      // 예외 발생 시 세션 유지 (예외가 차단 근거가 되어선 안 됨)
      setSession(session)
    }
    setLoading(false)
  }

  /**
   * 매직링크 발송
   * - allowed_users 에 있으면 → OTP 발송
   * - 없으면 → 에러 반환 (메일 안 보냄)
   * ※ anon SELECT RLS 정책이 없으면 사전 체크 불가 → OTP 시도 후 post-auth 에서 차단
   */
  const signInWithMagicLink = async (email) => {
    const trimmed = email.trim()

    const { data, error: checkError } = await supabase
      .from('allowed_users')
      .select('email')
      .eq('email', trimmed)
      .maybeSingle()

    if (checkError) {
      // RLS 미설정 등 → 일단 OTP 시도 (checkAllowed가 최종 차단)
      console.warn('[signInWithMagicLink] allowed_users 사전 체크 실패:', checkError.message)
    } else if (!data) {
      // 확실히 미등록 → 즉시 차단
      return { error: { message: 'email_not_allowed' } }
    }

    return supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    })
  }

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
