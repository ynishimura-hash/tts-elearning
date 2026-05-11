-- 最終ログイン日時カラム追加（2026-05-11）
-- ログイン時刻を記録し、管理画面のユーザー詳細で確認できるようにする

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

COMMENT ON COLUMN users.last_login_at IS '最終ログイン日時。ログイン成功時にアプリケーション側で更新';

-- 既存ユーザーは Supabase Auth の last_sign_in_at から初期値をバックフィル
UPDATE users u
SET last_login_at = au.last_sign_in_at
FROM auth.users au
WHERE au.id = u.auth_id
  AND u.last_login_at IS NULL
  AND au.last_sign_in_at IS NOT NULL;
