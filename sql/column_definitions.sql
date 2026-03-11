-- ═══════════════════════════════════════════
--  column_definitions + table_metadata
--  Supabase SQL Editor에서 실행
-- ═══════════════════════════════════════════

-- 1) 테이블 메타데이터
CREATE TABLE IF NOT EXISTS table_metadata (
  table_name   TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  date_column  TEXT
);

INSERT INTO table_metadata VALUES
  ('marketing_data',      '마케팅 데이터', 'date'),
  ('product_revenue_raw', '상품 매출',     'reservation_date')
ON CONFLICT (table_name) DO NOTHING;

-- 2) 컬럼 정의
CREATE TABLE IF NOT EXISTS column_definitions (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_key TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'metric',   -- metric | dimension | derived | computed | hidden
  label      TEXT NOT NULL DEFAULT '',
  fmt        TEXT NOT NULL DEFAULT 'number',    -- number | currency | pct | roas | text | date
  agg        TEXT,                              -- sum | avg | count | null
  formula    TEXT,                              -- 사람이 읽는 공식 (문서용)
  terms_json JSONB,                            -- computed용 — evalTerms 호환 형태
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (table_name, column_key)
);

CREATE INDEX IF NOT EXISTS idx_coldef_table ON column_definitions(table_name);

-- Realtime 활성화 (이미 추가되어 있으면 무시)
-- ALTER PUBLICATION supabase_realtime ADD TABLE column_definitions;

-- ═══════════════════════════════════════════
--  marketing_data 시드
-- ═══════════════════════════════════════════

-- 숨김
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, sort_order) VALUES
  ('marketing_data', 'date',          'hidden', '날짜',          'date', 0),
  ('marketing_data', 'sub_publisher', 'hidden', '서브 퍼블리셔', 'text', 1)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- 디멘전
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, sort_order) VALUES
  ('marketing_data', 'channel',      'dimension', '채널',          'text', 0),
  ('marketing_data', 'campaign',     'dimension', '캠페인',        'text', 1),
  ('marketing_data', 'ad_group',     'dimension', '광고그룹',      'text', 2),
  ('marketing_data', 'ad_creative',  'dimension', '크리에이티브',  'text', 3),
  ('marketing_data', 'content',      'dimension', '콘텐츠',        'text', 4),
  ('marketing_data', 'term',         'dimension', '검색어',        'text', 5)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- 지표
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, agg, sort_order) VALUES
  ('marketing_data', 'spend',        'metric', '광고비',                   'currency', 'sum', 0),
  ('marketing_data', 'impressions',  'metric', '노출',                     'number',   'sum', 1),
  ('marketing_data', 'clicks',       'metric', '클릭',                     'number',   'sum', 2),
  ('marketing_data', 'view_content', 'metric', '상세페이지 조회',          'number',   'sum', 3),
  ('marketing_data', 'signups',      'metric', '회원가입',                 'number',   'sum', 4),
  ('marketing_data', 'purchases',    'metric', '구매',                     'number',   'sum', 5),
  ('marketing_data', 'revenue',      'metric', '매출',                     'currency', 'sum', 6),
  ('marketing_data', 'installs',     'metric', '인스톨',                   'number',   'sum', 7),
  ('marketing_data', 'cpc',          'metric', 'CPC',                      'currency', 'avg', 8)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- 파생 (derived)
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, formula, sort_order) VALUES
  ('marketing_data', 'roas',     'derived', 'ROAS',     'roas',     'revenue / spend',              0),
  ('marketing_data', 'ctr',      'derived', 'CTR',      'pct',      '(clicks / impressions) * 100', 1),
  ('marketing_data', 'cpm',      'derived', 'CPM',      'currency', '(spend / impressions) * 1000', 2),
  ('marketing_data', 'cpa_view', 'derived', 'CPA(조회)', 'currency', 'spend / view_content',         3),
  ('marketing_data', 'cac',      'derived', 'CAC',      'currency', 'spend / signups',              4),
  ('marketing_data', 'cps',      'derived', 'CPS',      'currency', 'spend / purchases',            5),
  ('marketing_data', 'cvr_c',    'derived', 'CVR-C',    'pct',      '(signups / clicks) * 100',     6),
  ('marketing_data', 'cvr_s',    'derived', 'CVR-S',    'pct',      '(purchases / clicks) * 100',   7)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- ═══════════════════════════════════════════
--  product_revenue_raw 시드
-- ═══════════════════════════════════════════

-- 숨김 — ID/키
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, sort_order) VALUES
  ('product_revenue_raw', 'id',                'hidden', '',       'number', 0),
  ('product_revenue_raw', 'no',                'hidden', '',       'number', 1),
  ('product_revenue_raw', 'guest_type',        'hidden', '',       'number', 2),
  ('product_revenue_raw', 'guest_id',          'hidden', '',       'number', 3),
  ('product_revenue_raw', 'user_id',           'hidden', '',       'number', 4),
  ('product_revenue_raw', 'branch_id',         'hidden', '',       'number', 5),
  ('product_revenue_raw', 'roomtype_id',       'hidden', '',       'number', 6),
  ('product_revenue_raw', 'room_id',           'hidden', '',       'number', 7),
  ('product_revenue_raw', 'channel_id',        'hidden', '',       'number', 8)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- 숨김 — 날짜
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, sort_order) VALUES
  ('product_revenue_raw', 'reservation_date',  'hidden', '예약일',   'date', 10),
  ('product_revenue_raw', 'check_in_date',     'hidden', '체크인일', 'date', 11),
  ('product_revenue_raw', 'check_in',          'hidden', '체크인',   'date', 12),
  ('product_revenue_raw', 'check_out',         'hidden', '체크아웃', 'date', 13),
  ('product_revenue_raw', 'reserved_at',       'hidden', '예약시각', 'date', 14),
  ('product_revenue_raw', 'created_at',        'hidden', '',         'date', 15),
  ('product_revenue_raw', 'updated_at',        'hidden', '',         'date', 16)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- 숨김 — 플래그/기타
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, sort_order) VALUES
  ('product_revenue_raw', 'channel_resv_no1',  'hidden', '',       'number', 20),
  ('product_revenue_raw', 'channel_resv_no2',  'hidden', '',       'number', 21),
  ('product_revenue_raw', 'vehicle_num',       'hidden', '',       'number', 22),
  ('product_revenue_raw', 'has_gift',          'hidden', '',       'number', 23),
  ('product_revenue_raw', 'gift_memo',         'hidden', '',       'number', 24),
  ('product_revenue_raw', 'operator',          'hidden', '',       'number', 25),
  ('product_revenue_raw', 'alim_status',       'hidden', '',       'number', 26),
  ('product_revenue_raw', 'is_extend',         'hidden', '',       'number', 27),
  ('product_revenue_raw', 'prohibit_move',     'hidden', '',       'number', 28),
  ('product_revenue_raw', 'early_check_in',    'hidden', '',       'number', 29),
  ('product_revenue_raw', 'late_check_out',    'hidden', '',       'number', 30),
  ('product_revenue_raw', 'is_long',           'hidden', '',       'number', 31),
  ('product_revenue_raw', 'status',            'hidden', '상태',   'text',   32),
  -- room_type2는 dimension으로 이동
  ('product_revenue_raw', 'product_option_name','hidden','상품옵션',       'text', 34),
  ('product_revenue_raw', 'display_product_name','hidden','표시상품명',    'text', 35)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- 디멘전
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, sort_order) VALUES
  ('product_revenue_raw', 'brand_name',     'dimension', '브랜드명',   'text', 0),
  ('product_revenue_raw', 'branch_name',    'dimension', '지점명',     'text', 1),
  ('product_revenue_raw', 'channel_name',   'dimension', '채널명',     'text', 2),
  ('product_revenue_raw', 'channel_group',  'dimension', '채널그룹',   'text', 3),
  ('product_revenue_raw', 'area',           'dimension', '지역명',     'text', 4),
  ('product_revenue_raw', 'room_type_name', 'dimension', '객실명',     'text', 5),
  ('product_revenue_raw', 'room_type2',     'dimension', '객실타입',   'text', 6)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- 파생 디멘전 (조합 컬럼)
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, sort_order, terms_json) VALUES
  ('product_revenue_raw', 'branch_room_type', 'derived_dimension', '지점-객실타입', 'text', 7,
    '[{"type":"concat","cols":["branch_name","room_type2"],"separator":" - "}]')
ON CONFLICT (table_name, column_key) DO NOTHING;

-- 지표
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, agg, sort_order) VALUES
  ('product_revenue_raw', 'payment_amount',         'metric', '결제금액',       'currency', 'sum', 0),
  ('product_revenue_raw', 'original_price',         'metric', '정가',           'currency', 'sum', 1),
  ('product_revenue_raw', 'staypass_discount',      'metric', '스테이패스할인', 'currency', 'sum', 2),
  ('product_revenue_raw', 'promo_discount',         'metric', '프로모할인',     'currency', 'sum', 3),
  ('product_revenue_raw', 'coupon_discount_amount', 'metric', '쿠폰할인',       'currency', 'sum', 4),
  ('product_revenue_raw', 'point_amount',           'metric', '포인트사용',     'currency', 'sum', 5),
  ('product_revenue_raw', 'nights',                 'metric', '결제박수',       'number',   'sum', 6),
  ('product_revenue_raw', 'peoples',                'metric', '인원',           'number',   'sum', 7),
  ('product_revenue_raw', 'lead_time',              'metric', '리드타임',       'number',   'avg', 8)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- lead_time을 computed로 전환 (check_in_date - reservation_date 일수 차이)
UPDATE column_definitions
SET category = 'computed',
    formula = 'check_in_date - reservation_date (일수)',
    terms_json = '[{"type":"date_diff","col1":"check_in_date","col2":"reservation_date","unit":"days","sign":"+"}]'::jsonb
WHERE table_name = 'product_revenue_raw' AND column_key = 'lead_time';

-- 산술 (computed)
INSERT INTO column_definitions (table_name, column_key, category, label, fmt, agg, formula, terms_json, sort_order) VALUES
  ('product_revenue_raw', 'cc_order_count', 'computed', '결제건수',   'number',   'count_distinct',
    'COUNT(DISTINCT no)', '[{"type":"distinct","col":"no"}]'::jsonb, 0),
  ('product_revenue_raw', 'cc_net_revenue', 'computed', '총 결제금액', 'currency', NULL,
    'payment_amount - (staypass_discount + promo_discount + coupon_discount_amount + point_amount)',
    '[{"col":"payment_amount","sign":"+"},{"col":"staypass_discount","sign":"-"},{"col":"promo_discount","sign":"-"},{"col":"coupon_discount_amount","sign":"-"},{"col":"point_amount","sign":"-"}]'::jsonb, 1),
  ('product_revenue_raw', 'cc_los', 'computed', 'LOS', 'number', NULL,
    'SUM(nights) / COUNT(*)',
    '[{"col":"nights","sign":"+"},{"col":"cc_order_count","sign":"/"}]'::jsonb, 2),
  ('product_revenue_raw', 'cc_adr', 'computed', 'ADR', 'currency', NULL,
    'SUM(payment_amount) / SUM(nights)',
    '[{"col":"payment_amount","sign":"+"},{"col":"nights","sign":"/"}]'::jsonb, 3),
  ('product_revenue_raw', 'cc_unit_price', 'computed', '객단가', 'currency', NULL,
    'SUM(payment_amount) / COUNT(*)',
    '[{"col":"payment_amount","sign":"+"},{"col":"cc_order_count","sign":"/"}]'::jsonb, 4)
ON CONFLICT (table_name, column_key) DO NOTHING;

-- RLS (필요 시)
-- ALTER TABLE column_definitions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "authenticated read" ON column_definitions FOR SELECT TO authenticated USING (true);
-- ALTER TABLE table_metadata ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "authenticated read" ON table_metadata FOR SELECT TO authenticated USING (true);
