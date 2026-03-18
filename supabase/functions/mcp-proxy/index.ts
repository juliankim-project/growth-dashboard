import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0"

const MCP_BASE = "https://duck.plott.co.kr"
const MCP_URL  = `${MCP_BASE}/mcp`
const KEYCLOAK_BASE = "https://auth.plott.co.kr/realms/plott/protocol/openid-connect"
const OAUTH_REGISTER  = `https://auth.plott.co.kr/realms/plott/clients-registrations/openid-connect`
const OAUTH_AUTHORIZE = `${KEYCLOAK_BASE}/auth`
const OAUTH_TOKEN     = `${KEYCLOAK_BASE}/token`

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/mcp-proxy?action=callback`

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/* ── 캐시 ── */
let clientCreds: { client_id: string; client_secret: string } | null = null
let accessToken: string | null = null
let tokenExpiry = 0

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

/* ── DB에서 토큰 저장/조회 ── */
async function saveTokens(tokens: Record<string, unknown>) {
  await db.from("mcp_tokens").upsert({
    id: "plott",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + ((tokens.expires_in as number ?? 3600) - 60) * 1000,
    updated_at: new Date().toISOString(),
  })
}

async function loadTokens() {
  const { data } = await db.from("mcp_tokens").select("*").eq("id", "plott").maybeSingle()
  return data
}

/* ── OAuth 동적 클라이언트 등록 ── */
async function ensureClient() {
  if (clientCreds) return clientCreds

  // DB에 저장된 client 확인
  const { data } = await db.from("mcp_tokens").select("client_id, client_secret").eq("id", "plott").maybeSingle()
  if (data?.client_id && data?.client_secret) {
    clientCreds = { client_id: data.client_id, client_secret: data.client_secret }
    return clientCreds
  }

  const res = await fetch(OAUTH_REGISTER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "growth-dashboard-edge",
      redirect_uris: [CALLBACK_URL],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
      scope: "openid",
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`OAuth register failed: ${res.status} ${txt}`)
  }
  const result = await res.json()
  clientCreds = { client_id: result.client_id, client_secret: result.client_secret }

  // client 정보 DB 저장
  await db.from("mcp_tokens").upsert({
    id: "plott",
    client_id: result.client_id,
    client_secret: result.client_secret,
  })

  return clientCreds!
}

/* ── PKCE 코드 생성 ── */
async function generatePKCE() {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  const verifier = btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  return { verifier, challenge }
}

/* ── OAuth 토큰 (refresh_token으로 갱신) ── */
async function ensureToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken

  const stored = await loadTokens()
  if (!stored?.refresh_token) {
    throw new Error("NOT_AUTHENTICATED")
  }

  const { client_id, client_secret } = await ensureClient()
  const res = await fetch(OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refresh_token,
      client_id,
      client_secret,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    // refresh_token 만료 시 재인증 필요
    throw new Error(`NOT_AUTHENTICATED: ${txt}`)
  }
  const data = await res.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000

  // 새 refresh_token이 있으면 저장
  if (data.refresh_token) {
    await saveTokens(data)
  }

  return accessToken!
}

/* ── MCP 세션 관리 ── */
let mcpSessionId: string | null = null

async function mcpFetch(body: Record<string, unknown>, token: string) {
  const headers: Record<string, string> = {
    "Content-Type":  "application/json",
    "Accept":        "application/json, text/event-stream",
    "Authorization": `Bearer ${token}`,
  }
  if (mcpSessionId) {
    headers["Mcp-Session-Id"] = mcpSessionId
  }

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  // 세션 ID 캡처
  const sid = res.headers.get("Mcp-Session-Id")
  if (sid) mcpSessionId = sid

  return res
}

async function ensureSession(token: string) {
  if (mcpSessionId) return

  const res = await mcpFetch({
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "growth-dashboard", version: "1.0.0" },
    },
  }, token)

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`MCP initialize failed: ${res.status} ${txt}`)
  }

  // 세션 ID는 mcpFetch에서 자동 캡처됨
  await parseSSEResponse(res) // consume body

  // initialized 알림 전송
  await mcpFetch({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  }, token)
}

/* ── SSE 응답 파싱 ── */
async function parseSSEResponse(res: Response) {
  const text = await res.text()
  const contentType = res.headers.get("content-type") || ""

  // JSON 응답이면 그대로 파싱
  if (contentType.includes("application/json")) {
    return JSON.parse(text)
  }

  // SSE 응답이면 data: 라인에서 JSON 추출
  const lines = text.split("\n")
  let lastData = null
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const dataStr = line.slice(6).trim()
      if (dataStr) {
        try { lastData = JSON.parse(dataStr) } catch { /* skip */ }
      }
    }
  }

  if (lastData) return lastData
  throw new Error(`Could not parse MCP response: ${text.substring(0, 200)}`)
}

/* ── MCP 호출 ── */
async function callMCP(tool: string, args: Record<string, unknown>) {
  const token = await ensureToken()
  await ensureSession(token)

  const res = await mcpFetch({
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "tools/call",
    params: { name: tool, arguments: args },
  }, token)

  if (!res.ok) {
    const txt = await res.text()
    // 세션 만료 시 재시도
    if (res.status === 400 && txt.includes("Session")) {
      mcpSessionId = null
      return callMCP(tool, args)
    }
    throw new Error(`MCP call failed: ${res.status} ${txt}`)
  }

  return await parseSSEResponse(res)
}

/* ── Edge Function 핸들러 ── */
Deno.serve(async (req) => {
  const url = new URL(req.url)
  const action = url.searchParams.get("action")

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }

  /* ── 1) OAuth 인증 시작: GET ?action=auth ── */
  if (action === "auth") {
    try {
      const { client_id } = await ensureClient()
      const { verifier, challenge } = await generatePKCE()

      // verifier를 DB에 임시 저장
      await db.from("mcp_tokens").upsert({
        id: "plott",
        code_verifier: verifier,
        client_id: clientCreds!.client_id,
        client_secret: clientCreds!.client_secret,
      })

      const state = crypto.randomUUID()

      // state를 DB에 저장 (CSRF 방지)
      await db.from("mcp_tokens").update({ oauth_state: state }).eq("id", "plott")

      const authUrl = new URL(OAUTH_AUTHORIZE)
      authUrl.searchParams.set("response_type", "code")
      authUrl.searchParams.set("client_id", client_id)
      authUrl.searchParams.set("redirect_uri", CALLBACK_URL)
      authUrl.searchParams.set("scope", "mcp:tools")
      authUrl.searchParams.set("state", state)
      authUrl.searchParams.set("code_challenge", challenge)
      authUrl.searchParams.set("code_challenge_method", "S256")

      return new Response(null, {
        status: 302,
        headers: { Location: authUrl.toString() },
      })
    } catch (e) {
      return new Response(`Auth start error: ${e}`, { status: 500 })
    }
  }

  /* ── 2) OAuth 콜백: GET ?action=callback&code=... ── */
  if (action === "callback") {
    const code = url.searchParams.get("code")
    if (!code) {
      const err = url.searchParams.get("error") || "no code"
      return new Response(`OAuth callback error: ${err}`, { status: 400 })
    }

    try {
      const stored = await loadTokens()
      if (!stored?.code_verifier || !stored?.client_id || !stored?.client_secret) {
        return new Response("Missing PKCE verifier or client creds", { status: 400 })
      }

      const res = await fetch(OAUTH_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: CALLBACK_URL,
          client_id: stored.client_id,
          client_secret: stored.client_secret,
          code_verifier: stored.code_verifier,
        }),
      })

      if (!res.ok) {
        const txt = await res.text()
        return new Response(`Token exchange failed: ${res.status} ${txt}`, { status: 502 })
      }

      const tokens = await res.json()
      await saveTokens(tokens)

      // 인증 성공 메모리 캐시 업데이트
      accessToken = tokens.access_token
      tokenExpiry = Date.now() + ((tokens.expires_in ?? 3600) - 60) * 1000

      return new Response(`
        <html><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
          <div style="text-align:center;">
            <h1>✅ MCP 인증 완료!</h1>
            <p>이 창을 닫고 대시보드에서 질문해 보세요.</p>
          </div>
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })
    } catch (e) {
      return new Response(`Callback error: ${e}`, { status: 500 })
    }
  }

  /* ── 3) 인증 상태 확인: POST { action: "status" } ── */
  /* ── 4) MCP 도구 호출: POST { tool, args } ── */
  try {
    const body = await req.json()

    if (body.action === "status") {
      const stored = await loadTokens()
      const authenticated = !!stored?.refresh_token
      return new Response(
        JSON.stringify({ authenticated }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      )
    }

    const { tool, args } = body as { tool: string; args: Record<string, unknown> }
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

    // 인증 안 됐으면 auth URL 안내
    if (msg.includes("NOT_AUTHENTICATED")) {
      const authUrl = `${SUPABASE_URL}/functions/v1/mcp-proxy?action=auth`
      return new Response(
        JSON.stringify({ error: "NOT_AUTHENTICATED", authUrl }),
        { status: 401, headers: { ...CORS, "Content-Type": "application/json" } },
      )
    }

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
    )
  }
})
