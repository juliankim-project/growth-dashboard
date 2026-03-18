import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/* ─── Keycloak SSO 설정 ─── */
const KEYCLOAK_URL = 'https://auth.plott.co.kr/realms/plott/protocol/openid-connect'
const KC_CLIENT_ID = 'plott-sandbox'
const KC_REDIRECT_URI = window.location.origin + '/'
const KC_TOKEN_KEY = 'kc_tokens'

function generateCodeVerifier() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr)).replace(/[+/=]/g, c => c === '+' ? '-' : c === '/' ? '_' : '')
}
async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/[+/=]/g, c => c === '+' ? '-' : c === '/' ? '_' : '')
}
function getKcTokens() {
  try { const r = localStorage.getItem(KC_TOKEN_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function storeKcTokens(t) { localStorage.setItem(KC_TOKEN_KEY, JSON.stringify({ ...t, stored_at: Date.now() })) }
function clearKcTokens() { localStorage.removeItem(KC_TOKEN_KEY); sessionStorage.removeItem('kc_code_verifier'); sessionStorage.removeItem('kc_state') }
function parseJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) } catch { return null }
}

/* ─── Hook ─── */
export function useAuth() {
  const [session, setSession] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState('')

  useEffect(() => {
    if (!supabase) { setSession(null); setLoading(false); return }

    let cancelled = false

    // ── 1. Keycloak 콜백 체크 (kc_state가 있을 때만) ──
    const storedState = sessionStorage.getItem('kc_state')
    if (storedState) {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      if (code && state === storedState) {
        const verifier = sessionStorage.getItem('kc_code_verifier')
        fetch(`${KEYCLOAK_URL}/token`, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', client_id: KC_CLIENT_ID, redirect_uri: KC_REDIRECT_URI, code, code_verifier: verifier || '' }),
        }).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(tokens => {
          if (cancelled) return
          storeKcTokens(tokens)
          const p = parseJwt(tokens.access_token)
          setSession({ user: { email: p?.email || '', name: p?.name || '', id: p?.sub, accessToken: tokens.access_token } })
          setLoading(false)
          window.history.replaceState({}, '', window.location.origin)
        }).catch(() => {
          if (cancelled) return
          clearKcTokens()
          setAccessError('SSO 인증 실패. 다시 시도해주세요.')
          setSession(null)
          setLoading(false)
        })
        return () => { cancelled = true }
      }
      // state 불일치 → KC 세션 정리하고 Supabase로 진행
      clearKcTokens()
    }

    // ── 2. 저장된 Keycloak 토큰 확인 ──
    const kcTokens = getKcTokens()
    if (kcTokens?.access_token) {
      const payload = parseJwt(kcTokens.access_token)
      const now = Date.now() / 1000
      if (payload && payload.exp > now + 30) {
        setSession({ user: { email: payload.email || '', name: payload.name || '', id: payload.sub, accessToken: kcTokens.access_token } })
        setLoading(false)
        return
      }
      // 만료 → 정리 (Supabase로 폴백)
      clearKcTokens()
    }

    // ── 3. Supabase Auth (매직링크) — 항상 설정 ──
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return
      if (s) checkAllowed(s)
      else { setSession(null); setLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (cancelled) return
      if (s) checkAllowed(s)
      else { setSession(null); setLoading(false) }
    })

    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  async function checkAllowed(session) {
    try {
      const { data, error } = await supabase
        .from('allowed_users').select('email').eq('email', session.user.email).maybeSingle()
      if (error) {
        console.warn('[checkAllowed]', error.message)
        setSession(session) // DB 오류 → 로그인 허용
      } else if (!data) {
        await supabase.auth.signOut()
        setAccessError('등록되지 않은 이메일입니다. 관리자에게 문의하세요.')
        setSession(null)
      } else {
        setAccessError('')
        setSession(session)
      }
    } catch (e) {
      console.warn('[checkAllowed] 예외:', e)
      setSession(session)
    }
    setLoading(false)
  }

  /* ── 매직링크 로그인 ── */
  const signInWithMagicLink = async (email) => {
    const trimmed = email.trim()
    const { data, error: checkError } = await supabase
      .from('allowed_users').select('email').eq('email', trimmed).maybeSingle()
    if (checkError) console.warn('[signIn] allowed_users check failed:', checkError.message)
    else if (!data) return { error: { message: 'email_not_allowed' } }
    return supabase.auth.signInWithOtp({ email: trimmed, options: { emailRedirectTo: window.location.origin } })
  }

  /* ── Keycloak SSO 로그인 ── */
  const signInWithSSO = useCallback(async () => {
    const state = crypto.randomUUID()
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    sessionStorage.setItem('kc_state', state)
    sessionStorage.setItem('kc_code_verifier', verifier)
    window.location.href = `${KEYCLOAK_URL}/auth?${new URLSearchParams({
      response_type: 'code', client_id: KC_CLIENT_ID, redirect_uri: KC_REDIRECT_URI,
      scope: 'openid', state, code_challenge: challenge, code_challenge_method: 'S256',
    })}`
  }, [])

  /* ── 로그아웃 ── */
  const signOut = useCallback(() => {
    const kcTokens = getKcTokens()
    if (kcTokens?.access_token) {
      clearKcTokens()
      setSession(null)
      if (kcTokens.id_token) {
        window.location.href = `${KEYCLOAK_URL}/logout?${new URLSearchParams({
          id_token_hint: kcTokens.id_token, post_logout_redirect_uri: window.location.origin,
        })}`
      }
      return
    }
    supabase.auth.signOut()
  }, [])

  /* ── Keycloak access token (duck API용) ── */
  const getAccessToken = useCallback(async () => {
    const stored = getKcTokens()
    if (!stored?.access_token) return null
    const payload = parseJwt(stored.access_token)
    if (payload && payload.exp > Date.now() / 1000 + 30) return stored.access_token
    if (stored.refresh_token) {
      try {
        const res = await fetch(`${KEYCLOAK_URL}/token`, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', client_id: KC_CLIENT_ID, refresh_token: stored.refresh_token }),
        })
        if (!res.ok) throw new Error()
        const newTokens = await res.json()
        storeKcTokens(newTokens)
        return newTokens.access_token
      } catch { clearKcTokens(); return null }
    }
    return null
  }, [])

  return {
    session,
    loading,
    accessError,
    user: session?.user ?? null,
    signInWithMagicLink,
    signInWithSSO,
    signOut,
    getAccessToken,
  }
}
