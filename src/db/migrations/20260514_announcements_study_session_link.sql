-- お知らせと勉強会の連動（2026-05-14）
-- 勉強会作成時に自動で対応するお知らせを追加できるよう、
-- announcements に study_session_id を追加して紐付け。

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS study_session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE;

COMMENT ON COLUMN announcements.study_session_id IS '紐付く勉強会ID。NULL=独立したお知らせ。勉強会削除時にお知らせも自動削除';

CREATE INDEX IF NOT EXISTS idx_announcements_study_session_id ON announcements(study_session_id);
