-- ═══════════════════════════════════════════════════════════════
-- marketing_data RLS 정책 추가 — anon SELECT 허용
-- ═══════════════════════════════════════════════════════════════
-- 원인: marketing_data에 RLS가 활성화되어 있지만 anon SELECT 정책이 없음
--       → 앱에서 anon 키로 조회 시 0행 반환 (데이터 설정 "0행", 대시보드 전부 0)
-- 해결: anon에게 SELECT(읽기) 권한 추가
-- 실행: Supabase SQL Editor (https://supabase.com/dashboard) 에서 전체 복사 후 실행
-- ═══════════════════════════════════════════════════════════════

-- 1. RLS 활성화 확인 (이미 활성화면 무시됨)
ALTER TABLE marketing_data ENABLE ROW LEVEL SECURITY;

-- 2. anon SELECT 정책 추가
CREATE POLICY "anon_read_marketing_data"
  ON marketing_data
  FOR SELECT
  TO anon
  USING (true);

-- 3. column_configs도 anon 읽기 추가 (없을 경우 대비)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'column_configs' AND policyname = 'anon_read_column_configs'
  ) THEN
    EXECUTE 'CREATE POLICY "anon_read_column_configs" ON column_configs FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리: 정책이 제대로 추가됐는지 확인
-- ═══════════════════════════════════════════════════════════════
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('marketing_data', 'column_configs')
ORDER BY tablename, policyname;
