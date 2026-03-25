-- ═══════════════════════════════════════════════════════════════
-- SSO(Keycloak) 로그인 시 대시보드 데이터 안 보이는 문제 수정
-- ═══════════════════════════════════════════════════════════════
-- 원인: SSO 로그인은 Supabase auth 세션이 없어서 role='anon'
--       아래 4개 테이블이 authenticated 전용 정책이라 anon 차단됨
-- 해결: anon에게 SELECT(읽기) 권한 추가
-- 실행: Supabase SQL Editor에서 전체 복사 후 실행
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. product_revenue_raw ───
-- 기존: auth_read ({authenticated}, SELECT), auth_write ({authenticated}, ALL)
-- 추가: anon SELECT

CREATE POLICY "anon_read_product_revenue"
  ON product_revenue_raw
  FOR SELECT
  TO anon
  USING (true);


-- ─── 2. dashboard_config ───
-- 기존: authenticated_read ({authenticated}, SELECT), authenticated_write
-- 추가: anon SELECT

CREATE POLICY "anon_read_dashboard_config"
  ON dashboard_config
  FOR SELECT
  TO anon
  USING (true);


-- ─── 3. column_definitions ───
-- 기존: authenticated read ({authenticated}, SELECT)
-- 추가: anon SELECT

CREATE POLICY "anon_read_column_definitions"
  ON column_definitions
  FOR SELECT
  TO anon
  USING (true);


-- ─── 4. table_metadata ───
-- 기존: authenticated read ({authenticated}, SELECT)
-- 추가: anon SELECT

CREATE POLICY "anon_read_table_metadata"
  ON table_metadata
  FOR SELECT
  TO anon
  USING (true);


-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리: 실행 후 아래로 확인
-- ═══════════════════════════════════════════════════════════════
-- SELECT schemaname, tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE tablename IN (
--   'product_revenue_raw','dashboard_config',
--   'column_definitions','table_metadata'
-- )
-- ORDER BY tablename, policyname;
