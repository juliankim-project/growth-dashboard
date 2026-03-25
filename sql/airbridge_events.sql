-- ═══════════════════════════════════════════════════
-- 에어브릿지 포스트백 이벤트 테이블
-- Supabase SQL Editor에서 실행
-- ═══════════════════════════════════════════════════

-- 1) 이벤트 저장 테이블
CREATE TABLE IF NOT EXISTS airbridge_events (
  id              BIGSERIAL PRIMARY KEY,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 이벤트 정보
  event_name      TEXT,                          -- install, open, sign_up, purchase 등
  event_category  TEXT,                          -- 이벤트 카테고리
  event_action    TEXT,                          -- 이벤트 액션
  event_label     TEXT,                          -- 이벤트 라벨
  event_value     NUMERIC,                       -- 이벤트 값 (매출 등)
  event_datetime  TIMESTAMPTZ,                   -- 에어브릿지 이벤트 발생 시각
  event_timestamp BIGINT,                        -- Unix timestamp (ms)

  -- 디바이스 정보
  device_gaid     TEXT,                          -- Google Advertising ID
  device_idfa     TEXT,                          -- IDFA (iOS)
  device_idfv     TEXT,                          -- IDFV (iOS)
  device_uuid     TEXT,                          -- Airbridge Device UUID
  device_model    TEXT,                          -- 기기 모델
  device_os       TEXT,                          -- Android / iOS
  device_os_ver   TEXT,                          -- OS 버전
  device_locale   TEXT,                          -- ko-KR 등
  device_country  TEXT,                          -- KR, US 등
  device_carrier  TEXT,                          -- 통신사
  device_ip       TEXT,                          -- IP 주소

  -- 유저/앱 정보
  user_id         TEXT,                          -- 앱 내 유저 ID
  user_email      TEXT,                          -- 유저 이메일
  app_name        TEXT,                          -- 앱 이름
  app_package     TEXT,                          -- 패키지명 (bundle ID)
  app_version     TEXT,                          -- 앱 버전

  -- 어트리뷰션 결과
  attr_channel    TEXT,                          -- 광고 채널 (google, facebook, naver 등)
  attr_campaign   TEXT,                          -- 캠페인명
  attr_ad_group   TEXT,                          -- 광고그룹
  attr_ad_creative TEXT,                         -- 소재
  attr_keyword    TEXT,                          -- 키워드
  attr_sub_id     TEXT,                          -- Sub ID
  attr_click_id   TEXT,                          -- 클릭 ID
  attr_type       TEXT,                          -- attribution type (click, impression 등)
  is_organic      BOOLEAN DEFAULT FALSE,         -- 오가닉 여부

  -- 전환 상세 (구매 등)
  currency        TEXT,                          -- KRW, USD 등
  revenue         NUMERIC,                       -- 매출액
  quantity        INTEGER,                       -- 수량
  transaction_id  TEXT,                          -- 거래 ID

  -- 원본 payload (전체 저장)
  raw_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 인덱스용
  created_date    DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 2) 인덱스
CREATE INDEX IF NOT EXISTS idx_ab_events_name ON airbridge_events (event_name);
CREATE INDEX IF NOT EXISTS idx_ab_events_date ON airbridge_events (created_date);
CREATE INDEX IF NOT EXISTS idx_ab_events_channel ON airbridge_events (attr_channel);
CREATE INDEX IF NOT EXISTS idx_ab_events_campaign ON airbridge_events (attr_campaign);
CREATE INDEX IF NOT EXISTS idx_ab_events_received ON airbridge_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_ab_events_user ON airbridge_events (user_id) WHERE user_id IS NOT NULL;

-- 3) 일별 이벤트 집계 뷰 (대시보드용)
CREATE OR REPLACE VIEW airbridge_daily_summary AS
SELECT
  created_date,
  event_name,
  attr_channel,
  attr_campaign,
  COUNT(*)                          AS event_count,
  COUNT(DISTINCT device_uuid)       AS unique_devices,
  COUNT(DISTINCT user_id)           AS unique_users,
  SUM(revenue)                      AS total_revenue,
  SUM(quantity)                     AS total_quantity
FROM airbridge_events
GROUP BY created_date, event_name, attr_channel, attr_campaign;

-- 4) RLS 정책 (service_role만 쓰기, anon은 읽기만)
ALTER TABLE airbridge_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_airbridge" ON airbridge_events
  FOR SELECT TO anon USING (true);

CREATE POLICY "service_write_airbridge" ON airbridge_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5) 포스트백 인증 키 저장 (간단한 Bearer token)
-- Vercel 환경변수로 관리: AIRBRIDGE_POSTBACK_SECRET
