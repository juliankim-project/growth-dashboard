/**
 * Plott Duck 클라이언트
 * Keycloak SSO 인증 → duck.plott.co.kr REST API 직접 호출
 */
import Keycloak from 'keycloak-js'

const DUCK_API = 'https://duck.plott.co.kr'
const DUCK_QUERY_URL = `${DUCK_API}/query`
const DUCK_MCP_URL = `${DUCK_API}/mcp`

/* ── Keycloak 초기화 ── */
let _kc = null
let _kcReady = false
let _kcInitPromise = null

function getKeycloak() {
  if (!_kc) {
    _kc = new Keycloak({
      url: 'https://auth.plott.co.kr',
      realm: 'plott',
      clientId: 'plott-sandbox',
    })
  }
  return _kc
}

async function ensureKeycloak() {
  if (_kcReady) return getKeycloak()

  if (_kcInitPromise) return _kcInitPromise

  _kcInitPromise = (async () => {
    const kc = getKeycloak()
    try {
      const authenticated = await kc.init({
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        checkLoginIframe: false,
      })
      _kcReady = true
      if (authenticated) {
        // 토큰 자동 갱신
        setInterval(() => {
          kc.updateToken(30).catch(() => { /* silent fail */ })
        }, 30000)
      }
      return kc
    } catch (e) {
      console.error('Keycloak init failed:', e)
      _kcInitPromise = null
      throw e
    }
  })()

  return _kcInitPromise
}

async function getToken() {
  const kc = await ensureKeycloak()
  if (!kc.authenticated) {
    throw new MCPAuthRequiredError()
  }
  // 토큰 만료 임박 시 갱신
  try {
    await kc.updateToken(10)
  } catch {
    throw new MCPAuthRequiredError()
  }
  return kc.token
}

/* ── Auth Error ── */
export class MCPAuthRequiredError extends Error {
  constructor() {
    super('MCP 인증이 필요합니다')
  }
}

/* ── 인증 상태 확인 ── */
export async function mcpCheckAuth() {
  try {
    const kc = await ensureKeycloak()
    return { authenticated: kc.authenticated }
  } catch {
    return { authenticated: false }
  }
}

/* ── Keycloak 로그인 시작 ── */
export async function mcpLogin() {
  const kc = await ensureKeycloak()
  await kc.login({
    redirectUri: window.location.href,
  })
}

/* ── Keycloak 로그아웃 ── */
export async function mcpLogout() {
  const kc = await ensureKeycloak()
  await kc.logout({ redirectUri: window.location.origin })
}

/* ── REST API 호출 (duck.plott.co.kr/query) ── */
async function queryDuck(sql, limit = 1000, signal) {
  const token = await getToken()
  const res = await fetch(DUCK_QUERY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sql, limit }),
    signal,
  })

  if (res.status === 401) {
    throw new MCPAuthRequiredError()
  }
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Duck API error ${res.status}: ${txt}`)
  }
  return res.json()
}

/* ── MCP 호출 (duck.plott.co.kr/mcp) ── */
let mcpSessionId = null

async function callMCP(tool, args, signal) {
  const token = await getToken()

  // 세션 초기화
  if (!mcpSessionId) {
    const initHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${token}`,
    }
    const initRes = await fetch(DUCK_MCP_URL, {
      method: 'POST',
      headers: initHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'growth-dashboard', version: '1.0.0' },
        },
      }),
    })
    const sid = initRes.headers.get('Mcp-Session-Id')
    if (sid) mcpSessionId = sid
    await parseSSE(initRes)

    // initialized notification
    await fetch(DUCK_MCP_URL, {
      method: 'POST',
      headers: { ...initHeaders, ...(mcpSessionId ? { 'Mcp-Session-Id': mcpSessionId } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    })
  }

  // 도구 호출
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${token}`,
    ...(mcpSessionId ? { 'Mcp-Session-Id': mcpSessionId } : {}),
  }

  const res = await fetch(DUCK_MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }),
    signal,
  })

  if (res.status === 401) throw new MCPAuthRequiredError()
  if (res.status === 400) {
    const txt = await res.text()
    if (txt.includes('Session')) {
      mcpSessionId = null
      return callMCP(tool, args, signal) // retry
    }
    throw new Error(`MCP error: ${txt}`)
  }
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`MCP error ${res.status}: ${txt}`)
  }

  return unwrapMcpResponse(await parseSSE(res))
}

/* ── SSE 파싱 ── */
async function parseSSE(res) {
  const text = await res.text()
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return JSON.parse(text)

  let lastData = null
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try { lastData = JSON.parse(line.slice(6).trim()) } catch { /* skip */ }
    }
  }
  if (lastData) return lastData
  try { return JSON.parse(text) } catch { return { text } }
}

/* ── JSONRPC 언래핑 ── */
function unwrapMcpResponse(raw) {
  if (raw?.rows || raw?.columns) return raw
  if (raw?.result?.content) {
    const textItem = raw.result.content.find(c => c.type === 'text')
    if (textItem?.text) {
      try { return JSON.parse(textItem.text) } catch { return { text: textItem.text } }
    }
  }
  if (raw?.result) return raw.result
  return raw
}

/* ── 공개 API ── */

/** 자연어 질문 (MCP ask 도구) */
export function mcpAsk(question, signal) {
  return callMCP('ask', {
    question,
    use_case: 'agent_server_reasoning',
  }, signal)
}

/** SQL 쿼리 (REST API 직접 호출 — 빠름) */
export function mcpQuery(sql, signal, { limit = 1000 } = {}) {
  return queryDuck(sql, limit, signal)
}

/** 스키마 부트스트랩 */
export function mcpGetBootstrap() {
  return callMCP('get_bootstrap', {})
}

/** 참고 문서 */
export function mcpGetReference(topic) {
  return callMCP('get_reference', { topic })
}
