CREATE TABLE IF NOT EXISTS excluded_users (
  id BIGSERIAL PRIMARY KEY,
  guest_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 누구나 조회·수정 가능 (대시보드 내부용)
ALTER TABLE excluded_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all" ON excluded_users FOR ALL USING (true) WITH CHECK (true);
