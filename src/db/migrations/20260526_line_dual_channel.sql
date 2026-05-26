-- 2026-05-26: LINE 公式アカウント 2チャネル化（オンライン + オフライン）
--
-- 目的:
--   1. 既存 users.line_user_id / applications.line_user_id を「オンライン公式LINE由来」として
--      _online カラムに引き継ぐ
--   2. オフライン公式LINE 用の紐付け先として _offline カラムを新規追加
--   3. LINE「連携」発言時のトークン発行先テーブルを新規作成
--      （氏名 + 電話番号で既存 users と突合する仕組みのため）
--
-- 想定影響範囲:
--   - users: 1列リネーム + 1列追加 + インデックス2本
--   - applications: 1列リネーム + 1列追加
--   - line_groups: 1列追加（channel）
--   - line_link_tokens: 新規テーブル + RLS + index 3本

BEGIN;

-- ============================================================================
-- 1) users テーブル: line_user_id を online/offline 2列に分割
-- ============================================================================
ALTER TABLE users RENAME COLUMN line_user_id TO line_user_id_online;
ALTER TABLE users ADD COLUMN line_user_id_offline TEXT;

CREATE INDEX IF NOT EXISTS idx_users_line_user_id_online
  ON users(line_user_id_online)
  WHERE line_user_id_online IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_line_user_id_offline
  ON users(line_user_id_offline)
  WHERE line_user_id_offline IS NOT NULL;

COMMENT ON COLUMN users.line_user_id_online IS 'オンライン公式LINE の LINE userId（テスター含む全オンライン会員）';
COMMENT ON COLUMN users.line_user_id_offline IS 'オフライン公式LINE の LINE userId（オフライン会員のみ。テスターは NULL）';

-- ============================================================================
-- 2) applications テーブル: 同様にリネーム + 新列追加
-- ============================================================================
ALTER TABLE applications RENAME COLUMN line_user_id TO line_user_id_online;
ALTER TABLE applications ADD COLUMN line_user_id_offline TEXT;

COMMENT ON COLUMN applications.line_user_id_online IS 'オンライン申込時に解決された LINE userId（オンライン公式LINE由来）';
COMMENT ON COLUMN applications.line_user_id_offline IS 'オフライン申込時に解決された LINE userId（オフライン公式LINE由来。現状は未使用）';

-- ============================================================================
-- 3) line_groups テーブル: どちらの公式LINE経由で登録されたかを記録
-- ============================================================================
ALTER TABLE line_groups
  ADD COLUMN channel TEXT NOT NULL DEFAULT 'online' CHECK (channel IN ('online', 'offline'));

COMMENT ON COLUMN line_groups.channel IS 'このグループ/トーク/個人がどちらの公式LINE経由で登録されたか';

-- ============================================================================
-- 4) line_link_tokens テーブル: LINE連携トークン（新規）
-- ============================================================================
-- 公式LINEで「連携」と発言したユーザーに発行されるトークン。
-- ユーザーは専用URL（/line-link/[channel]?token=xxx）で氏名 + 電話番号を入力し、
-- users テーブルと突合する。一致すれば users.line_user_id_xxx に LINE userId を保存する。

CREATE TABLE IF NOT EXISTS line_link_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('online', 'offline')),
  source_type TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  linked_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE line_link_tokens IS 'LINE 公式LINE で「連携」と発言したユーザーに発行されるトークン。氏名+電話番号フォームで既存 users と突合する';
COMMENT ON COLUMN line_link_tokens.channel IS 'どちらの公式LINE由来か（online / offline）';
COMMENT ON COLUMN line_link_tokens.linked_user_id IS '突合成功時に紐付いた users.id（成功した時のみセット）';

CREATE INDEX IF NOT EXISTS idx_line_link_tokens_line_user_id ON line_link_tokens(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_link_tokens_expires_at ON line_link_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_line_link_tokens_unused ON line_link_tokens(token) WHERE used_at IS NULL;

ALTER TABLE line_link_tokens ENABLE ROW LEVEL SECURITY;

-- 匿名で SELECT は許可（フォーム表示時にトークンの有効性を確認するため）
-- 期限切れ / 使用済みは見えない
CREATE POLICY "line_link_tokens_read_anon" ON line_link_tokens
  FOR SELECT TO anon USING (used_at IS NULL AND expires_at > NOW());

COMMIT;

-- ============================================================================
-- ロールバック手順（手動実行用）
-- ============================================================================
-- BEGIN;
-- DROP TABLE IF EXISTS line_link_tokens;
-- ALTER TABLE line_groups DROP COLUMN IF EXISTS channel;
-- ALTER TABLE applications DROP COLUMN IF EXISTS line_user_id_offline;
-- ALTER TABLE applications RENAME COLUMN line_user_id_online TO line_user_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS line_user_id_offline;
-- ALTER TABLE users RENAME COLUMN line_user_id_online TO line_user_id;
-- COMMIT;
