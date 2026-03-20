-- ============================================================
-- pg_cron + pg_net: 매일 아침 10시(KST) 키워드 자동 수집
--
-- pg_cron은 UTC 기준 → 한국시간 10:00 = UTC 01:00
-- pg_net으로 Edge Function HTTP 호출
-- ============================================================

-- 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 기존 스케줄 있으면 삭제
SELECT cron.unschedule('keyword-trend-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'keyword-trend-daily');

-- 매일 UTC 01:00 (KST 10:00) 실행
SELECT cron.schedule(
  'keyword-trend-daily',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gjykjvevjuzjyuuopsns.supabase.co/functions/v1/keyword-collector',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeWtqdmV2anV6anl1dW9wc25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMzI5NDMsImV4cCI6MjA4NzcwODk0M30.dsO4N8NVYoIyH7SYmUPmJISYVQ0LyOes3mzRowBQ"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 스케줄 관리 테이블 (대시보드 UI 연동용)
CREATE TABLE IF NOT EXISTS scheduler_config (
  id          TEXT PRIMARY KEY DEFAULT 'keyword-collector',
  enabled     BOOLEAN DEFAULT TRUE,
  cron_expr   TEXT DEFAULT '0 1 * * *',
  description TEXT DEFAULT '매일 아침 10시 키워드 수집',
  last_run    TIMESTAMPTZ,
  last_status TEXT,
  last_result JSONB,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 데이터
INSERT INTO scheduler_config (id, enabled, cron_expr, description)
VALUES ('keyword-collector', true, '0 1 * * *', '매일 아침 10시 키워드 수집')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE scheduler_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheduler_config_select" ON scheduler_config FOR SELECT USING (true);
CREATE POLICY "scheduler_config_update" ON scheduler_config FOR UPDATE USING (true);
