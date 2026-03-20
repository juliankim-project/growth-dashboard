-- ============================================================
-- keyword_trends: 일별 키워드 검색량 스냅샷
-- 네이버 검색광고 API에서 매일 수집한 데이터 저장
-- ============================================================

CREATE TABLE IF NOT EXISTS keyword_trends (
  id            BIGSERIAL PRIMARY KEY,
  collected_at  DATE NOT NULL DEFAULT CURRENT_DATE,        -- 수집 일자
  keyword       TEXT NOT NULL,                              -- 검색 키워드
  region        TEXT,                                       -- 권역 (수도권, 제주, 동남권 등)
  area          TEXT,                                       -- 지역 (서울, 제주, 부산 등)
  category      TEXT DEFAULT 'general',                     -- branded / regional / generic / room
  monthly_pc    INTEGER DEFAULT 0,                          -- 월간 PC 검색량
  monthly_mobile INTEGER DEFAULT 0,                         -- 월간 모바일 검색량
  monthly_total INTEGER DEFAULT 0,                          -- 월간 총 검색량
  competition   TEXT,                                       -- 경쟁 정도 (높음/중간/낮음)
  comp_idx      REAL,                                       -- 경쟁지수 (0~100)
  is_hint       BOOLEAN DEFAULT FALSE,                      -- 직접 검색한 키워드인지 여부
  raw_json      JSONB,                                      -- API 원본 응답

  UNIQUE(collected_at, keyword)                             -- 같은 날 같은 키워드 중복 방지
);

-- 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_kt_date ON keyword_trends(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_kt_region ON keyword_trends(region);
CREATE INDEX IF NOT EXISTS idx_kt_area ON keyword_trends(area);
CREATE INDEX IF NOT EXISTS idx_kt_keyword ON keyword_trends(keyword);
CREATE INDEX IF NOT EXISTS idx_kt_category ON keyword_trends(category);

-- RLS 활성화
ALTER TABLE keyword_trends ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 읽기 허용
CREATE POLICY "keyword_trends_select" ON keyword_trends
  FOR SELECT USING (true);

-- Edge Function(service_role)만 쓰기 허용
CREATE POLICY "keyword_trends_insert" ON keyword_trends
  FOR INSERT WITH CHECK (true);

CREATE POLICY "keyword_trends_update" ON keyword_trends
  FOR UPDATE USING (true);
