import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

/**
 * keyword-collector: 매일 실행되는 키워드 수집 Edge Function
 *
 * 1. product_revenue_raw 에서 area, branch_name 고유값 추출
 * 2. 고정 키워드 구조에 따라 키워드 셋 생성:
 *    - 숙소 유형별 (accom_type): 7개 카테고리의 고정 키워드
 *    - 지역별 (area): 각 지역의 지점명을 기반으로 생성
 *    - 브랜드 (brand): 각 브랜드의 고정 키워드
 * 3. 네이버 검색광고 API 호출 (5개씩 배치)
 * 4. keyword_trends 테이블에 upsert (keyword_group 필드 포함)
 *
 * 호출: POST /functions/v1/keyword-collector
 * 또는 Supabase cron job / 외부 스케줄러에서 호출
 */

/* ── 권역 매핑 ── */
const REGION_MAP: Record<string, string> = {
  '서울': '수도권', '경기': '수도권', '인천': '수도권',
  '부산': '동남권', '울산': '동남권', '경남': '동남권', '창원': '동남권',
  '대구': '대경권', '경북': '대경권', '경주': '대경권', '포항': '대경권',
  '광주': '호남권', '전남': '호남권', '전북': '호남권', '여수': '호남권', '목포': '호남권',
  '대전': '충청권', '충남': '충청권', '충북': '충청권', '세종': '충청권',
  '강원': '강원권', '속초': '강원권', '춘천': '강원권', '강릉': '강원권', '평창': '강원권',
  '제주': '제주권',
  '통영': '동남권', '거제': '동남권',
}

/* ── 숙소 유형별 고정 키워드 (전체 여행 수요) ── */
const ACCOMMODATION_TYPE_KEYWORDS: Record<string, string[]> = {
  '숙소': ['숙소', '숙소 추천', '숙소 예약'],
  '여행': ['여행', '국내 여행', '국내여행'],
  '펜션': ['펜션', '펜션 예약', '펜션 추천'],
  '호텔': ['호텔', '호텔 예약', '호텔 추천'],
  '숙박': ['숙박', '숙박 예약', '숙박 추천'],
  '레지던스': ['레지던스', '서비스 레지던스'],
  '에어비앤비': ['에어비앤비', '에어비엔비'],
}

const NAVER_API_BASE = "https://api.naver.com"
const KEYWORD_TOOL_URI = "/keywordstool"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

/* ── HMAC-SHA256 서명 ── */
async function generateSignature(
  timestamp: string, method: string, uri: string, secretKey: string
): Promise<string> {
  // 타임스탐프, HTTP 메서드, URI를 조합하여 서명할 메시지 생성
  const message = `${timestamp}.${method}.${uri}`
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message))
  const bytes = new Uint8Array(sig)
  let binary = ""
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary)
}

/* ── 네이버 검색광고 API 호출 (최대 5개 키워드) ── */
async function fetchKeywordTool(
  keywords: string[], customerId: string, apiKey: string, secretKey: string
) {
  const timestamp = Date.now().toString()
  const sig = await generateSignature(timestamp, "GET", KEYWORD_TOOL_URI, secretKey)
  // 공백을 제거한 키워드들을 쉼표로 구분
  const hintKeywords = keywords.map(k => k.replace(/\s+/g, "")).join(",")
  const url = `${NAVER_API_BASE}${KEYWORD_TOOL_URI}?hintKeywords=${encodeURIComponent(hintKeywords)}&showDetail=1`

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Timestamp": timestamp,
      "X-API-KEY": apiKey,
      "X-API-SECRET": secretKey,
      "X-Customer": customerId,
      "X-Signature": sig,
    },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`네이버 API ${res.status}: ${errText}`)
  }
  return await res.json()
}

/* ── 배치 호출 (5개씩 나눠서, rate limit 방지 1.2초 딜레이) ── */
async function fetchAllKeywords(
  allKeywords: string[], customerId: string, apiKey: string, secretKey: string
) {
  const results: any[] = []
  const batchSize = 5

  for (let i = 0; i < allKeywords.length; i += batchSize) {
    const batch = allKeywords.slice(i, i + batchSize)
    try {
      const data = await fetchKeywordTool(batch, customerId, apiKey, secretKey)
      if (data?.keywordList) {
        results.push(...data.keywordList)
      }
    } catch (err) {
      console.error(`배치 ${i}~${i + batchSize} 실패:`, err)
    }
    // API rate limit 방지 (마지막 배치 제외)
    if (i + batchSize < allKeywords.length) {
      await new Promise(r => setTimeout(r, 1200))
    }
  }

  return results
}

/* ── 지역에서 권역 찾기 ── */
function getRegion(area: string): string {
  if (!area) return '기타'
  for (const [key, region] of Object.entries(REGION_MAP)) {
    if (area.includes(key)) return region
  }
  return '기타'
}

/* ── 키워드에 해당하는 그룹 판정 ── */
function determineKeywordGroup(
  keyword: string,
  hintKeyword: string,
  accommTypeHints: Set<string>,
  areaHints: Set<string>,
  brandHints: Set<string>
): string {
  // 숙소 유형별 고정 키워드에 해당하는지 확인
  if (accommTypeHints.has(hintKeyword)) {
    return 'accom_type'
  }
  // 지역별 키워드에 해당하는지 확인
  if (areaHints.has(hintKeyword)) {
    return 'area'
  }
  // 브랜드 키워드에 해당하는지 확인
  if (brandHints.has(hintKeyword)) {
    return 'brand'
  }
  // 기본값 (API 응답의 연관 키워드)
  return 'related'
}

/* ── 메인 핸들러 ── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS })
  }

  const startTime = Date.now()

  try {
    // ── 환경 변수 검증 ──
    const customerId = Deno.env.get("NAVER_CUSTOMER_ID")!
    const apiKey = Deno.env.get("NAVER_API_KEY")!
    const secretKey = Deno.env.get("NAVER_SECRET_KEY")!
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    if (!customerId || !apiKey || !secretKey) {
      throw new Error("네이버 API 인증 정보 미설정")
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // ── 1단계: product_revenue_raw에서 고유 area, branch_name 추출 ──
    const { data: products, error: prodErr } = await supabase
      .from("product_revenue_raw")
      .select("area, branch_name")

    if (prodErr) throw new Error(`상품 데이터 조회 실패: ${prodErr.message}`)

    const areaSet = new Set<string>()
    const brandSet = new Set<string>()
    products?.forEach((r: any) => {
      if (r.area) areaSet.add(r.area.trim())
      if (r.branch_name) brandSet.add(r.branch_name.trim())
    })

    console.log(`추출된 지역: ${areaSet.size}개, 브랜드: ${brandSet.size}개`)

    // ── 2단계: 고정 키워드 구조에 따라 키워드 셋 생성 ──
    const keywordSet = new Set<string>()

    // 숙소 유형별 고정 키워드 (전체 여행 수요)
    const accommTypeHints = new Set<string>()
    Object.values(ACCOMMODATION_TYPE_KEYWORDS).forEach(keywords => {
      keywords.forEach(kw => {
        keywordSet.add(kw)
        accommTypeHints.add(kw)
      })
    })

    // 지역별 키워드
    // 각 지역마다: ${area}, ${area} 숙소, ${area} 호텔, ${area} 펜션, ${area} 숙박, ${area} 여행, ${area} 리조트
    const areaHints = new Set<string>()
    areaSet.forEach(area => {
      const areaKeywords = [
        area,
        `${area} 숙소`,
        `${area} 호텔`,
        `${area} 펜션`,
        `${area} 숙박`,
        `${area} 여행`,
        `${area} 리조트`,
      ]
      areaKeywords.forEach(kw => {
        keywordSet.add(kw)
        areaHints.add(kw)
      })
    })

    // 브랜드 키워드
    // 각 브랜드마다: ${brand}, ${brand} 예약, ${brand} 가격
    const brandHints = new Set<string>()
    brandSet.forEach(brand => {
      const brandKeywords = [
        brand,
        `${brand} 예약`,
        `${brand} 가격`,
      ]
      brandKeywords.forEach(kw => {
        keywordSet.add(kw)
        brandHints.add(kw)
      })
    })

    const allKeywords = Array.from(keywordSet)
    console.log(`수집 대상 키워드: ${allKeywords.length}개`)
    console.log(`  - 숙소 유형: ${accommTypeHints.size}개`)
    console.log(`  - 지역별: ${areaHints.size}개`)
    console.log(`  - 브랜드: ${brandHints.size}개`)

    // ── 3단계: 네이버 검색광고 API 배치 호출 ──
    const keywordList = await fetchAllKeywords(allKeywords, customerId, apiKey, secretKey)
    console.log(`API 응답 키워드: ${keywordList.length}개`)

    // ── 4단계: keyword_trends 테이블에 upsert (keyword_group 포함) ──
    const today = new Date().toISOString().split("T")[0]
    const rows = keywordList.map((item: any) => {
      const responseKeyword = item.relKeyword || ""

      // 응답 키워드와 원본 hint 키워드 매칭 시도
      let matchedHintKeyword = ""
      let keywordGroup = "related"

      // 응답 키워드가 힌트 셋에 정확히 포함되어 있는지 확인
      if (accommTypeHints.has(responseKeyword)) {
        matchedHintKeyword = responseKeyword
        keywordGroup = "accom_type"
      } else if (areaHints.has(responseKeyword)) {
        matchedHintKeyword = responseKeyword
        keywordGroup = "area"
      } else if (brandHints.has(responseKeyword)) {
        matchedHintKeyword = responseKeyword
        keywordGroup = "brand"
      }

      return {
        collected_at: today,
        keyword: responseKeyword,
        keyword_group: keywordGroup,
        monthly_pc: typeof item.monthlyPcQcCnt === "number" ? item.monthlyPcQcCnt : 0,
        monthly_mobile: typeof item.monthlyMobileQcCnt === "number" ? item.monthlyMobileQcCnt : 0,
        monthly_total: (typeof item.monthlyPcQcCnt === "number" ? item.monthlyPcQcCnt : 0)
          + (typeof item.monthlyMobileQcCnt === "number" ? item.monthlyMobileQcCnt : 0),
        competition: item.compIdx === "높음" ? "높음" : item.compIdx === "중간" ? "중간" : "낮음",
        comp_idx: typeof item.compIdx === "number" ? item.compIdx : null,
        is_hint: allKeywords.includes(responseKeyword),
        raw_json: item,
      }
    })

    // 배치 upsert (500개씩)
    let insertedCount = 0
    const upsertBatch = 500
    for (let i = 0; i < rows.length; i += upsertBatch) {
      const batch = rows.slice(i, i + upsertBatch)
      const { error: upsertErr } = await supabase
        .from("keyword_trends")
        .upsert(batch, { onConflict: "collected_at,keyword" })

      if (upsertErr) {
        console.error(`upsert 실패 (${i}~${i + batch.length}):`, upsertErr)
      } else {
        insertedCount += batch.length
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    // ── 수집 완료 ──
    const summary = {
      success: true,
      collected_at: today,
      total_keywords_queried: allKeywords.length,
      total_results: keywordList.length,
      inserted: insertedCount,
      areas: Array.from(areaSet),
      brands: Array.from(brandSet).slice(0, 10),
      elapsed_sec: elapsed,
    }

    console.log("수집 완료:", JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    })

  } catch (error) {
    console.error("keyword-collector 오류:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "내부 오류" }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
    )
  }
})
