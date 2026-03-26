-- ═══════════════════════════════════════════════════════════════
-- marketing_data RLS 정책 추가 — anon + authenticated SELECT 허용
-- ═══════════════════════════════════════════════════════════════
-- 원인: marketing_data에 RLS가 활성화되어 있지만 SELECT 정책이 누락됨
--       - SSO(Keycloak) 로그인 → role=anon  → anon 정책 필요
--       - 매직링크 로그인     → role=authenticated → authenticated 정책 필요
--       → 어느 쪽이든 정책 없으면 0행 반환 (대시보드 전부 0)
-- 해결: anon + authenticated 모두 SELECT(읽기) 권한 추가
-- 실행: Supabase SQL Editor (https://supabase.com/dashboard) 에서 전체 복사 후 실행
-- ═══════════════════════════════════════════════════════════════

-- 1. RLS 활성화 확인 (이미 활성화면 무시됨)
ALTER TABLE marketing_data ENABLE ROW LEVEL SECURITY;

-- 2. anon SELECT 정책 추가 (SSO 로그인용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'marketing_data' AND policyname = 'anon_read_marketing_data'
  ) THEN
    EXECUTE 'CREATE POLICY "anon_read_marketing_data" ON marketing_data FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- 3. authenticated SELECT 정책 추가 (매직링크 로그인용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'marketing_data' AND policyname = 'authenticated_read_marketing_data'
  ) THEN
    EXECUTE 'CREATE POLICY "authenticated_read_marketing_data" ON marketing_data FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- 4. column_configs도 anon 읽기 추가 (없을 경우 대비)
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
