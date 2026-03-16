/**
 * MCP Proxy 클라이언트
 * Supabase Edge Function을 통해 Plott MCP 서버와 통신
 */

const PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-proxy`
const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY

export class MCPAuthRequiredError extends Error {
  constructor(authUrl) {
    super('MCP 인증이 필요합니다')
    this.authUrl = authUrl
  }
}

async function call(tool, args = {}) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey':        ANON_KEY,
    },
    body: JSON.stringify({ tool, args }),
  })

  if (res.status === 401) {
    const data = await res.json()
    throw new MCPAuthRequiredError(data.authUrl)
  }

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`MCP proxy error ${res.status}: ${txt}`)
  }
  return res.json()
}

/** 인증 상태 확인 */
export async function mcpCheckAuth() {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey':        ANON_KEY,
    },
    body: JSON.stringify({ action: 'status' }),
  })
  return res.json()
}

/** 자연어 질문 */
export function mcpAsk(question) {
  return call('ask', { question })
}

/** SQL 쿼리 */
export function mcpQuery(sql) {
  return call('query', { sql })
}

/** 스키마 부트스트랩 */
export function mcpGetBootstrap() {
  return call('get_bootstrap', {})
}

/** 참고 문서 */
export function mcpGetReference(topic) {
  return call('get_reference', { topic })
}
