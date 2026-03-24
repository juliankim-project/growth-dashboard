-- ═══════════════════════════════════════════════════════
-- 체험단 선정 시스템 테이블
-- revu_campaigns  : 캠페인(크롤링 단위) 메타
-- revu_applicants : 캠페인별 신청자(인플루언서) 상세
-- revu_selections : 선정 이력 (누가 / 언제 / 어떤 기준으로)
-- ═══════════════════════════════════════════════════════

-- 1) 캠페인 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revu_campaigns (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id   TEXT        NOT NULL,              -- 레뷰 캠페인 ID (예: 1306557)
  campaign_title TEXT       NOT NULL DEFAULT '',
  platform      TEXT        NOT NULL DEFAULT 'naver', -- naver | instagram
  crawled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_count   INT         NOT NULL DEFAULT 0,
  modal_success INT,                                -- 네이버 모달 성공 수 (인스타는 null)
  version       TEXT,                               -- 크롤링 버전 (v5, v5-insta 등)
  raw_meta      JSONB,                              -- 원본 meta 전체
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 캠페인ID + 크롤링 시각 조합은 유니크
  UNIQUE (campaign_id, crawled_at)
);

CREATE INDEX IF NOT EXISTS idx_revu_campaigns_cid ON revu_campaigns (campaign_id);

-- 2) 신청자 ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revu_applicants (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_pk     BIGINT      NOT NULL REFERENCES revu_campaigns(id) ON DELETE CASCADE,
  campaign_id     TEXT        NOT NULL,              -- 조회 편의용 (denorm)
  platform        TEXT        NOT NULL DEFAULT 'naver',

  -- 공통 필드
  nickname        TEXT,
  gender          TEXT,
  age             TEXT,
  is_picked       BOOLEAN     DEFAULT false,         -- 레뷰 측 추천 여부
  is_duplicate    BOOLEAN     DEFAULT false,

  -- 네이버 전용
  media_name      TEXT,
  media_url       TEXT,
  avg_visitors    INT,
  top_exposure    BOOLEAN     DEFAULT false,
  blog_score      NUMERIC(3,1),
  category        TEXT,
  neighbors       INT,
  ad_activity     TEXT,
  avg_likes       INT,
  avg_comments    INT,
  post_freq_7d    INT,
  top_keyword_count INT,

  -- 인스타 전용
  instagram_handle TEXT,
  instagram_url   TEXT,
  follower_range  TEXT,
  exact_followers INT,
  post_count      INT,
  engagement_rate NUMERIC(6,3),
  avg_insta_likes INT,
  avg_insta_comments INT,

  -- AI 점수 (크롤링 시점 계산값)
  ai_score        NUMERIC(6,2),

  -- 원본 JSON 전체 (상세 모달 데이터 포함)
  raw_data        JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revu_applicants_cpk ON revu_applicants (campaign_pk);
CREATE INDEX IF NOT EXISTS idx_revu_applicants_cid ON revu_applicants (campaign_id);

-- 3) 선정 이력 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revu_selections (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_pk     BIGINT      NOT NULL REFERENCES revu_campaigns(id) ON DELETE CASCADE,
  applicant_pk    BIGINT      NOT NULL REFERENCES revu_applicants(id) ON DELETE CASCADE,
  selected_by     TEXT,                              -- 선정자 이메일 (auth.uid → email)
  selected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason          TEXT,                              -- 선정 사유 메모
  ai_score_at_selection NUMERIC(6,2),                -- 선정 시점 AI 점수 스냅샷

  UNIQUE (campaign_pk, applicant_pk)                 -- 동일 캠페인에서 중복 선정 방지
);

CREATE INDEX IF NOT EXISTS idx_revu_selections_cpk ON revu_selections (campaign_pk);

-- RLS (Row Level Security) ────────────────────────────
-- anon key 사용 시 인증된 사용자만 접근하도록
ALTER TABLE revu_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE revu_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE revu_selections ENABLE ROW LEVEL SECURITY;

-- 인증된 유저는 모두 읽기/쓰기 가능 (팀 내부 도구)
CREATE POLICY "team_full_access" ON revu_campaigns
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "team_full_access" ON revu_applicants
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "team_full_access" ON revu_selections
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- service_role은 RLS 무시하므로 revu_app.py(서버 측)에서는 제한 없음
