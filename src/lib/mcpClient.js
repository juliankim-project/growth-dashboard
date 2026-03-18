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

/**
 * JSONRPC 응답에서 실제 데이터 추출
 * { jsonrpc, result: { content: [{ type:"text", text: "..." }] } }
 * → text를 JSON parse하여 반환
 */
function unwrapMcpResponse(raw) {
  // 이미 rows가 있는 평문 응답
  if (raw?.rows || raw?.columns) return raw

  // JSONRPC 래퍼
  if (raw?.result?.content) {
    const textItem = raw.result.content.find(c => c.type === 'text')
    if (textItem?.text) {
      try {
        return JSON.parse(textItem.text)
      } catch {
        return { text: textItem.text }
      }
    }
  }

  // result가 바로 있는 경우
  if (raw?.result) return raw.result

  return raw
}

async function call(tool, args = {}, signal) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey':        ANON_KEY,
    },
    body: JSON.stringify({ tool, args }),
    signal,
  })

  if (res.status === 401) {
    const data = await res.json()
    throw new MCPAuthRequiredError(data.authUrl)
  }

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`MCP proxy error ${res.status}: ${txt}`)
  }

  const raw = await res.json()
  return unwrapMcpResponse(raw)
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
export function mcpAsk(question, signal) {
  return call('ask', {
    question,
    use_case: 'agent_server_reasoning',
  }, signal)
}

/** SQL 쿼리 (limit: 기본 1000, 최대 100000) */
export function mcpQuery(sql, signal, { limit = 1000 } = {}) {
  return call('query', { sql, limit }, signal)
}

/** 스키마 부트스트랩 */
export function mcpGetBootstrap() {
  return call('get_bootstrap', {})
}

/** 참고 문서 */
export function mcpGetReference(topic) {
  return call('get_reference', { topic })
}
