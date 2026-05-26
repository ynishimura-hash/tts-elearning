-- 申し込み受付停止 + 空き待ち機能（2026-05-26）
-- オンライン/オフライン申込の受付を管理画面から停止可能にし、
-- 停止中は空き待ちフォーム経由で受け付ける。
-- 停止解除後、管理者が個別に「招待」を送ることで、入力済みの情報が
-- プリフィルされた固有URL経由で正式申込フローに乗せる。

-- ===========================================
-- 1) 受付状態フラグ（1行運用）
-- ===========================================
CREATE TABLE IF NOT EXISTS application_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  online_paused BOOLEAN NOT NULL DEFAULT FALSE,
  offline_paused BOOLEAN NOT NULL DEFAULT FALSE,
  online_paused_at TIMESTAMPTZ,
  offline_paused_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE application_settings IS '申し込み受付状態（1行のみ運用）';
COMMENT ON COLUMN application_settings.online_paused IS 'オンライン受付停止フラグ';
COMMENT ON COLUMN application_settings.offline_paused IS 'オフライン受付停止フラグ';

-- 初期行を必ず1行入れる
INSERT INTO application_settings (id, online_paused, offline_paused)
VALUES (TRUE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE application_settings ENABLE ROW LEVEL SECURITY;

-- 全員に SELECT 許可（フォーム側で停止判定するため）
CREATE POLICY "application_settings_read_all" ON application_settings
  FOR SELECT USING (TRUE);

-- 管理者のみ UPDATE
CREATE POLICY "application_settings_admin_write" ON application_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = TRUE
    )
  );

-- ===========================================
-- 2) 空き待ち申込
-- ===========================================
CREATE TABLE IF NOT EXISTS waitlist_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 申込内容（既存 applications と同じ項目）
  full_name TEXT NOT NULL,
  furigana TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  birthdate DATE NOT NULL,
  postal_code TEXT NOT NULL,
  address TEXT NOT NULL,
  referral_source TEXT NOT NULL,
  referral_detail TEXT,
  course_type TEXT NOT NULL CHECK (course_type IN ('online', 'offline')),

  -- ステータス
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'invited', 'converted', 'cancelled')),

  -- 招待トークン（プリフィル用固有URL）
  invite_token UUID UNIQUE,
  invite_sent_at TIMESTAMPTZ,
  invite_expires_at TIMESTAMPTZ,

  -- 変換後の正式申込
  converted_application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  -- LINE連携（任意）
  line_user_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE waitlist_applications IS '空き待ち申込。停止中に受け付け、解除後に管理者が招待を送り正式申込に変換する';

CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist_applications(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_invite_token ON waitlist_applications(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist_applications(created_at DESC);

ALTER TABLE waitlist_applications ENABLE ROW LEVEL SECURITY;

-- 匿名 INSERT 許可（空き待ちフォーム送信）
CREATE POLICY "waitlist_insert_anon" ON waitlist_applications
  FOR INSERT TO anon WITH CHECK (TRUE);

-- 招待トークン経由の SELECT 許可（プリフィル）
-- ※ 実際の取得はサーバー側で service role を使うため、ここは緩めでよい
CREATE POLICY "waitlist_select_by_token" ON waitlist_applications
  FOR SELECT USING (invite_token IS NOT NULL);

-- 管理者は全権限
CREATE POLICY "waitlist_admin_all" ON waitlist_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = TRUE
    )
  );
