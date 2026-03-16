import "@supabase/functions-js/edge-runtime.d.ts"

const MCP_BASE = "https://latestrue.plott.co.kr"
const MCP_URL  = `${MCP_BASE}/mcp`
const OAUTH_REGISTER = `${MCP_BASE}/oauth/register`
const OAUTH_TOKEN    = `${MCP_BASE}/oauth/token`

/* ── 캐시: 동적 등록 + 토큰 ── */
let clientCreds: { client_id: string; client_secret: string } | null = null
let accessToken: string | null = null
let tokenExpiry = 0

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

/* ── OAuth 동적 클라이언트 등록 ── */
async function ensureClient() {
  if (clientCreds) return clientCreds
  const res = await fetch(OAUTH_REGISTER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "growth-dashboard-edge",
      grant_types: ["client_credentials"],
      token_endpoint_auth_method: "client_secret_post",
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`OAuth register failed: ${res.status} ${txt}`)
  }
  clientCreds = await res.json() as { client_id: string; client_secret: string }
  return clientCreds!
}

/* ── OAuth 토큰 발급 ── */
async function ensureToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken
  const { client_id, client_secret } = await ensureClient()
  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id,
      client_secret,
      scope: "mcp:tools",
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`OAuth token failed: ${res.status} ${txt}`)
  }
  const data = await res.json() as { access_token: string; expires_in?: number }
  accessToken = data.access_token
  tokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000
  return accessToken!
}

/* ── MCP 호출 ── */
async function callMCP(tool: string, args: Record<string, unknown>) {
  const token = await ensureToken()
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`MCP call failed: ${res.status} ${txt}`)
  }
  return await res.json()
}

/* ── Edge Function 핸들러 ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }

  try {
    const { tool, args } = await req.json() as { tool: string; args: Record<string, unknown> }
    if (!tool) {
      return new Response(
        JSON.stringify({ error: "Missing 'tool' field" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      )
    }

    const result = await callMCP(tool, args ?? {})

    return new Response(
      JSON.stringify(result),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("mcp-proxy error:", msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
    )
  }
})
