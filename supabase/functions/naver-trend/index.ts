import "jsr:@supabase/functions-js/edge-runtime.d.ts"

/**
 * 네이버 검색광고 API 프록시 (Keyword Tool)
 * - 앱스크립트와 동일한 인증 방식 (HMAC-SHA256)
 * - Endpoint: GET https://api.naver.com/keywordstool?hintKeywords=...
 */

const BASE_URL = "https://api.naver.com"
const URI = "/keywordstool"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

/* ── HMAC-SHA256 서명 생성 (앱스크립트 동일 로직) ── */
async function generateSignature(
  timestamp: string,
  method: string,
  uri: string,
  secretKey: string
): Promise<string> {
  const message = `${timestamp}.${method}.${uri}`
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secretKey)
  const msgData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData)

  // base64 encode
  const bytes = new Uint8Array(signature)
  let binary = ""
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary)
}

/* ── 네이버 검색광고 API 호출 ── */
async function fetchKeywordTool(
  keywords: string[],
  customerId: string,
  apiKey: string,
  secretKey: string
): Promise<Record<string, unknown>> {
  const timestamp = Date.now().toString()
  const method = "GET"
  const sig = await generateSignature(timestamp, method, URI, secretKey)

  // 키워드를 쉼표로 연결 (공백 제거)
  const hintKeywords = keywords.map(k => k.replace(/\s+/g, "")).join(",")
  const url = `${BASE_URL}${URI}?hintKeywords=${encodeURIComponent(hintKeywords)}&showDetail=1`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Timestamp": timestamp,
      "X-API-KEY": apiKey,
      "X-API-SECRET": secretKey,
      "X-Customer": customerId,
      "X-Signature": sig,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`네이버 API 오류: ${response.status} ${errorText}`)
  }

  return await response.json()
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...CORS } }
    )
  }

  try {
    // 환경 변수에서 인증 정보 읽기
    const customerId = Deno.env.get("NAVER_CUSTOMER_ID")
    const apiKey = Deno.env.get("NAVER_API_KEY")
    const secretKey = Deno.env.get("NAVER_SECRET_KEY")

    if (!customerId || !apiKey || !secretKey) {
      return new Response(
        JSON.stringify({ error: "네이버 검색광고 API 인증 정보가 설정되지 않았습니다" }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
      )
    }

    const body = await req.json()
    const { keywords } = body as { keywords?: string[] }

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return new Response(
        JSON.stringify({ error: "keywords 배열이 필요합니다" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS } }
      )
    }

    // 최대 5개 키워드 제한
    const limited = keywords.slice(0, 5)
    const result = await fetchKeywordTool(limited, customerId, apiKey, secretKey)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    })
  } catch (error) {
    console.error("naver-trend 함수 오류:", error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "내부 서버 오류",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
    )
  }
})
