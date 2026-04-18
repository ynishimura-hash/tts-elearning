-- メール配信機能（2026-04-18 追加）
-- 管理画面からの一斉配信履歴と、配信停止リスト

-- 配信履歴
CREATE TABLE IF NOT EXISTS email_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB,
  variables_used TEXT[],
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_broadcasts_created_at
  ON email_broadcasts (created_at DESC);

-- 配信停止リスト
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribes_email
  ON email_unsubscribes (lower(email));

-- RLS
ALTER TABLE email_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- 管理者のみ配信履歴を操作可能
CREATE POLICY "email_broadcasts_admin"
  ON email_broadcasts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE));

-- 配信停止: 匿名でも INSERT 可能（フッターリンクから）、SELECT/UPDATE/DELETE は管理者のみ
CREATE POLICY "email_unsubscribes_insert_anon"
  ON email_unsubscribes FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "email_unsubscribes_admin"
  ON email_unsubscribes FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "email_unsubscribes_admin_modify"
  ON email_unsubscribes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE));

CREATE POLICY "email_unsubscribes_admin_delete"
  ON email_unsubscribes FOR DELETE
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND is_admin = TRUE));
