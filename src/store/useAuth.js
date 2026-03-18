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

async function exchangeKcCode(code) {
  const verifier = sessionStorage.getItem('kc_code_verifier')
  const res = await fetch(`${KEYCLOAK_URL}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: KC_CLIENT_ID, redirect_uri: KC_REDIRECT_URI, code, code_verifier: verifier || '' }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json()
}

async function refreshKcToken(refreshToken) {
  const res = await fetch(`${KEYCLOAK_URL}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: KC_CLIENT_ID, refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error('Refresh failed')
  return res.json()
}

/* ─── Hook ─── */
export function useAuth() {
  const [session, setSession] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [authMethod, setAuthMethod] = useState(null) // 'supabase' | 'keycloak'

  /* ── Supabase Auth (매직링크) ── */
  useEffect(() => {
    if (!supabase) { setSession(null); setLoading(false); return }

    // Keycloak callback 처리 먼저
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const storedState = sessionStorage.getItem('kc_state')

    if (code && state && state === storedState) {
      exchangeKcCode(code).then(tokens => {
        storeKcTokens(tokens)
        const payload = parseJwt(tokens.access_token)
        setAuthMethod('keycloak')
        setSession({
          user: {
            email: payload?.email || '',
            name: payload?.name || payload?.preferred_username || '',
            id: payload?.sub,
            accessToken: tokens.access_token,
          }
        })
        setLoading(false)
        window.history.replaceState({}, '', window.location.origin)
      }).catch(e => {
        console.error('[Keycloak] token exchange error:', e)
        setAccessError('SSO 인증에 실패했습니다. 다시 시도해주세요.')
        setLoading(false)
      })
      return
    }

    // 저장된 Keycloak 토큰 확인
    const kcTokens = getKcTokens()
    if (kcTokens?.access_token) {
      const payload = parseJwt(kcTokens.access_token)
      const now = Date.now() / 1000
      if (payload && payload.exp > now + 30) {
        setAuthMethod('keycloak')
        setSession({
          user: { email: payload.email || '', name: payload.name || '', id: payload.sub, accessToken: kcTokens.access_token }
        })
        setLoading(false)
        return
      } else if (kcTokens.refresh_token) {
        refreshKcToken(kcTokens.refresh_token).then(newTokens => {
          storeKcTokens(newTokens)
          const p = parseJwt(newTokens.access_token)
          setAuthMethod('keycloak')
          setSession({
            user: { email: p?.email || '', name: p?.name || '', id: p?.sub, accessToken: newTokens.access_token }
          })
        }).catch(() => clearKcTokens()).finally(() => setLoading(false))
        return
      } else {
        clearKcTokens()
      }
    }

    // Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { checkAllowed(session) }
      else { setSession(null); setLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) checkAllowed(session)
      else { setSession(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function checkAllowed(session) {
    try {
      const { data, error } = await supabase
        .from('allowed_users').select('email').eq('email', session.user.email).maybeSingle()
      if (error) { console.warn('[checkAllowed]', error.message); setAccessError(''); setAuthMethod('supabase'); setSession(session) }
      else if (!data) { await supabase.auth.signOut(); setAccessError('등록되지 않은 이메일입니다.'); setSession(null) }
      else { setAccessError(''); setAuthMethod('supabase'); setSession(session) }
    } catch { setAuthMethod('supabase'); setSession(session) }
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
    const params = new URLSearchParams({
      response_type: 'code', client_id: KC_CLIENT_ID, redirect_uri: KC_REDIRECT_URI,
      scope: 'openid', state, code_challenge: challenge, code_challenge_method: 'S256',
    })
    window.location.href = `${KEYCLOAK_URL}/auth?${params}`
  }, [])

  /* ── 로그아웃 ── */
  const signOut = useCallback(() => {
    if (authMethod === 'keycloak') {
      const tokens = getKcTokens()
      clearKcTokens()
      setSession(null)
      setAuthMethod(null)
      if (tokens?.id_token) {
        const params = new URLSearchParams({ id_token_hint: tokens.id_token, post_logout_redirect_uri: window.location.origin })
        window.location.href = `${KEYCLOAK_URL}/logout?${params}`
      }
    } else {
      supabase.auth.signOut()
    }
  }, [authMethod])

  /* ── Keycloak access token (duck API용) ── */
  const getAccessToken = useCallback(async () => {
    const stored = getKcTokens()
    if (!stored) return null
    const payload = parseJwt(stored.access_token)
    if (payload && payload.exp > Date.now() / 1000 + 30) return stored.access_token
    if (stored.refresh_token) {
      try {
        const newTokens = await refreshKcToken(stored.refresh_token)
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
