-- 確認用アカウント（西村のテスト用など）。
-- 送信（催促・配信）は届くが、勉強会の未回答カウント/一覧/ダッシュボードの表示からは除外する。
alter table public.users
  add column if not exists is_verifier boolean not null default false;
comment on column public.users.is_verifier is
  '確認用アカウント。送信は届くが勉強会の未回答カウント/一覧の表示からは除外する。';
