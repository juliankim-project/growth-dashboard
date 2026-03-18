import { useState, useEffect, useCallback } from 'react'

const KEYCLOAK_URL = 'https://auth.plott.co.kr/realms/plott/protocol/openid-connect'
const CLIENT_ID = 'plott-sandbox'
const REDIRECT_URI = window.location.origin + '/auth/callback'
const TOKEN_KEY = 'kc_tokens'

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

function getStoredTokens() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function storeTokens(tokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({
    ...tokens,
    stored_at: Date.now(),
  }))
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem('kc_code_verifier')
  sessionStorage.removeItem('kc_state')
}

async function exchangeCode(code) {
  const verifier = sessionStorage.getItem('kc_code_verifier')
  const res = await fetch(`${KEYCLOAK_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: verifier || '',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json()
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${KEYCLOAK_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error('Refresh failed')
  return res.json()
}

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch { return null }
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accessError, setAccessError] = useState('')

  // 토큰에서 유저 정보 추출
  const setUserFromTokens = useCallback((tokens) => {
    const payload = parseJwt(tokens.access_token)
    if (!payload) return null
    const u = {
      email: payload.email || '',
      name: payload.name || payload.preferred_username || '',
      id: payload.sub,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    }
    setUser(u)
    return u
  }, [])

  // 초기화: 저장된 토큰 확인 + callback 처리
  useEffect(() => {
    async function init() {
      // 1. OAuth callback 처리
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const storedState = sessionStorage.getItem('kc_state')

      if (code && state && state === storedState) {
        try {
          const tokens = await exchangeCode(code)
          storeTokens(tokens)
          setUserFromTokens(tokens)
          // URL 정리
          window.history.replaceState({}, '', window.location.origin)
        } catch (e) {
          console.error('[Keycloak] token exchange error:', e)
          setAccessError('인증에 실패했습니다. 다시 시도해주세요.')
        }
        setLoading(false)
        return
      }

      // 2. 저장된 토큰 확인
      const stored = getStoredTokens()
      if (stored?.access_token) {
        const payload = parseJwt(stored.access_token)
        const now = Date.now() / 1000

        if (payload && payload.exp > now + 30) {
          // 아직 유효
          setUserFromTokens(stored)
        } else if (stored.refresh_token) {
          // 만료됨 → refresh 시도
          try {
            const newTokens = await refreshAccessToken(stored.refresh_token)
            storeTokens(newTokens)
            setUserFromTokens(newTokens)
          } catch {
            clearTokens()
          }
        } else {
          clearTokens()
        }
      }

      setLoading(false)
    }

    init()
  }, [setUserFromTokens])

  // 로그인: Keycloak으로 리다이렉트
  const signIn = useCallback(async () => {
    const state = crypto.randomUUID()
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)

    sessionStorage.setItem('kc_state', state)
    sessionStorage.setItem('kc_code_verifier', verifier)

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'openid',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })

    window.location.href = `${KEYCLOAK_URL}/auth?${params}`
  }, [])

  // 로그아웃
  const signOut = useCallback(() => {
    const tokens = getStoredTokens()
    clearTokens()
    setUser(null)

    // Keycloak에서도 로그아웃
    if (tokens?.id_token) {
      const params = new URLSearchParams({
        id_token_hint: tokens.id_token,
        post_logout_redirect_uri: window.location.origin,
      })
      window.location.href = `${KEYCLOAK_URL}/logout?${params}`
    }
  }, [])

  // 유효한 access token 반환 (자동 refresh)
  const getAccessToken = useCallback(async () => {
    const stored = getStoredTokens()
    if (!stored) return null

    const payload = parseJwt(stored.access_token)
    const now = Date.now() / 1000

    if (payload && payload.exp > now + 30) {
      return stored.access_token
    }

    if (stored.refresh_token) {
      try {
        const newTokens = await refreshAccessToken(stored.refresh_token)
        storeTokens(newTokens)
        setUserFromTokens(newTokens)
        return newTokens.access_token
      } catch {
        clearTokens()
        setUser(null)
        return null
      }
    }

    return null
  }, [setUserFromTokens])

  return {
    session: user ? { user } : null,
    loading,
    accessError,
    user,
    signIn,
    signOut,
    getAccessToken,
  }
}
