-- 勉強会通知のユーザー個別オン/オフ
-- 既定 ON。OFF にした会員は出欠案内・催促・2週間前自動通知の対象外になる。
-- 追加のみ・非破壊（既存会員は全員 true ＝ 現状の挙動を維持）。

alter table public.users
  add column if not exists study_notify_enabled boolean not null default true;

comment on column public.users.study_notify_enabled is
  '勉強会通知（出欠案内・催促・2週間前自動通知）を送るか。false で対象外。既定 true';
