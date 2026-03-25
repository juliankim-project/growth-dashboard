/**
 * Vercel Serverless Function — 에어브릿지 광고주 포스트백 수신
 * ─────────────────────────────────────────────────────────────
 * URL: https://<your-domain>/api/airbridge/postback
 * Method: POST (에어브릿지 대시보드에서 POST 선택)
 *
 * 에어브릿지 → 이 엔드포인트로 이벤트 데이터 전송 → Supabase 저장
 *
 * 환경변수 (Vercel Dashboard > Settings > Environment Variables):
 *   SUPABASE_URL           = https://xxx.supabase.co
 *   SUPABASE_SERVICE_KEY   = eyJ... (service_role key)
 *   AIRBRIDGE_POSTBACK_SECRET = (선택) Bearer 토큰 인증용
 */

import { createClient } from '@supabase/supabase-js'

// ── Supabase 클라이언트 (service_role — RLS 우회) ──
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── 에어브릿지 포스트백 서버 IP 허용 목록 (선택적 보안) ──
const AIRBRIDGE_IPS = new Set([
  '3.112.156.26','3.113.116.246','18.177.210.124','18.178.90.248',
  '18.182.81.54','35.73.18.225','35.76.1.45','52.196.176.123',
  '54.150.6.139','54.238.226.38','3.35.29.212','3.35.66.163',
  '3.35.109.84','3.35.115.78','3.35.125.128','3.35.125.182',
  '3.35.142.157','3.35.145.199','3.35.185.244','3.35.253.108',
])

// ── 안전하게 값 추출 (nested key 지원) ──
function dig(obj, path, fallback = null) {
  if (!obj || !path) return fallback
  const keys = path.split('.')
  let cur = obj
  for (const k of keys) {
    if (cur == null) return fallback
    cur = cur[k]
  }
  return cur ?? fallback
}

// ── null/undefined만 건너뛰는 첫 값 선택 (0, false 등 유효값 보존) ──
function first(...args) {
  for (const v of args) {
    if (v !== null && v !== undefined) return v
  }
  return null
}

// ── 타임스탬프 → ISO 변환 ──
function tsToISO(ts) {
  if (!ts) return null
  const n = Number(ts)
  if (isNaN(n)) return null
  // 에어브릿지 타임스탬프는 ms 단위
  return new Date(n > 1e12 ? n : n * 1000).toISOString()
}

export default async function handler(req, res) {
  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(200).end()
  }

  // ── POST만 허용 ──
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  // ── (선택) Bearer 토큰 인증 ──
  const secret = process.env.AIRBRIDGE_POSTBACK_SECRET
  if (secret) {
    const auth = req.headers['authorization'] || ''
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  // ── (선택) IP 화이트리스트 체크 ──
  // Vercel에서는 x-forwarded-for 헤더로 원본 IP 확인
  // 주의: 프록시 환경에서는 정확하지 않을 수 있음 → 참고용
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  // IP 체크는 로깅만 (차단하지 않음 — 테스트 편의)
  const isKnownIp = AIRBRIDGE_IPS.has(clientIp)

  try {
    const body = req.body

    // ── 배열로 올 수도 있음 (벌크 포스트백) ──
    const events = Array.isArray(body) ? body : [body]
    const rows = []

    for (const evt of events) {
      // ── 실제 에어브릿지 광고주 포스트백 페이로드 구조 기반 매핑 ──
      // 주요 객체: event, touchpoint, device, user, app,
      //           eventDatetime, eventDetails, product, attributionResult
      const row = {
        // 이벤트 정보
        event_name:      dig(evt, 'event.eventCategory') || dig(evt, 'eventName') || dig(evt, 'event_name'),
        event_category:  dig(evt, 'event.eventCategory') || dig(evt, 'eventCategory'),
        event_action:    dig(evt, 'event.eventAction') || dig(evt, 'eventAction'),
        event_label:     dig(evt, 'event.eventLabel') || dig(evt, 'eventLabel'),
        event_value:     first(dig(evt, 'event.eventValue'), dig(evt, 'eventValue')),
        event_timestamp: first(dig(evt, 'eventTimestamp'), dig(evt, 'timestamp')),
        event_datetime:  dig(evt, 'eventDatetime.eventDate')
                           ? new Date(dig(evt, 'eventDatetime.eventDate')).toISOString()
                           : tsToISO(first(dig(evt, 'eventTimestamp'), dig(evt, 'timestamp'))),

        // 디바이스 정보
        device_gaid:     dig(evt, 'device.gaid') || dig(evt, 'deviceGaid'),
        device_idfa:     dig(evt, 'device.idfa') || dig(evt, 'deviceIdfa'),
        device_idfv:     dig(evt, 'device.ifv') || dig(evt, 'device.idfv'),
        device_uuid:     dig(evt, 'device.airbridgeDeviceID') || dig(evt, 'device.deviceUUID'),
        device_model:    dig(evt, 'device.model') || dig(evt, 'deviceModel'),
        device_os:       dig(evt, 'device.osName') || dig(evt, 'device.platform'),
        device_os_ver:   dig(evt, 'device.osVersion') || dig(evt, 'deviceOSVersion'),
        device_locale:   dig(evt, 'device.locale') || dig(evt, 'deviceLocale'),
        device_country:  dig(evt, 'device.country') || dig(evt, 'country'),
        device_carrier:  dig(evt, 'device.carrier') || dig(evt, 'carrier'),
        device_ip:       dig(evt, 'device.ipAddress') || dig(evt, 'ipAddress'),

        // 유저/앱 정보
        user_id:         dig(evt, 'user.userID') || dig(evt, 'user.userId') || dig(evt, 'userId'),
        user_email:      dig(evt, 'user.email') || dig(evt, 'userEmail'),
        app_name:        dig(evt, 'app.name') || dig(evt, 'appName'),
        app_package:     dig(evt, 'app.packageName') || dig(evt, 'packageName'),
        app_version:     dig(evt, 'app.version') || dig(evt, 'appVersion'),

        // 어트리뷰션 — touchpoint (실제 포스트백) > attributionResult (fallback)
        attr_channel:    dig(evt, 'touchpoint.channel') || dig(evt, 'attributionResult.attributedChannel'),
        attr_campaign:   dig(evt, 'touchpoint.campaign') || dig(evt, 'attributionResult.attributedCampaign'),
        attr_ad_group:   dig(evt, 'touchpoint.adGroup') || dig(evt, 'attributionResult.attributedAdGroup'),
        attr_ad_creative: dig(evt, 'touchpoint.adCreative') || dig(evt, 'attributionResult.attributedAdCreative'),
        attr_keyword:    dig(evt, 'touchpoint.term') || dig(evt, 'attributionResult.attributedKeyword'),
        attr_sub_id:     dig(evt, 'touchpoint.subPublisher') || dig(evt, 'attributionResult.attributedSubId'),
        attr_click_id:   dig(evt, 'touchpoint.campaignID') || dig(evt, 'attributionResult.attributedClickID'),
        attr_type:       dig(evt, 'touchpoint.campaignType') || dig(evt, 'attributionResult.attributionType'),
        is_organic:      dig(evt, 'touchpoint.isViewThrough') != null
                           ? !dig(evt, 'touchpoint.isViewThrough')
                           : (dig(evt, 'isOrganic') || false),

        // 전환 상세
        currency:        dig(evt, 'event.currency')
                           || dig(evt, 'product.productList.products.0.currency')
                           || dig(evt, 'currency'),
        revenue:         first(dig(evt, 'event.eventValue'), dig(evt, 'event.eventValueOriginal'), dig(evt, 'revenue')),
        quantity:        first(dig(evt, 'event.quantity'), dig(evt, 'quantity')),
        transaction_id:  dig(evt, 'eventDetails.transactionID') || dig(evt, 'event.transactionID') || dig(evt, 'transactionId'),

        // 원본 payload 전체 저장 (분석용 — product, customUserProperties 등 여기서 꺼내 씀)
        raw_payload:     evt,
      }

      rows.push(row)
    }

    // ── Supabase 저장 (배치) ──
    const { data, error } = await supabase
      .from('airbridge_events')
      .insert(rows)

    if (error) {
      console.error('Supabase insert error:', error)
      return res.status(500).json({
        error: 'DB insert failed',
        detail: error.message,
        hint: error.hint || null,
      })
    }

    return res.status(200).json({
      ok: true,
      count: rows.length,
      from_known_ip: isKnownIp,
    })

  } catch (err) {
    console.error('Postback handler error:', err)
    return res.status(500).json({ error: 'Internal server error', detail: err.message })
  }
}
