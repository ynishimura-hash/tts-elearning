-- 勉強会の2週間前自動LINE配信機能（2026-05-14）
-- 各勉強会ごとに ON/OFF を切り替え、Vercel Cron で1日1回チェックし
-- 開催14日前のものに自動で LINE 出欠案内を Push する。

ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS auto_notify_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_week_notify_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN study_sessions.auto_notify_enabled IS '2週間前LINE自動配信のON/OFF。デフォルトOFF';
COMMENT ON COLUMN study_sessions.two_week_notify_sent_at IS '2週間前LINE配信が実行された日時。NULL=未配信';

CREATE INDEX IF NOT EXISTS idx_study_sessions_auto_notify
  ON study_sessions(auto_notify_enabled, session_date)
  WHERE auto_notify_enabled = true AND two_week_notify_sent_at IS NULL;
