-- 勉強会 段階通知エンジン
-- ・段階ごとの送信済みフラグ（2週間前は既存 two_week_notify_sent_at を流用）
-- ・送信履歴テーブル（誰に・いつ・どの段階・成否）。RLS有効＝service role限定（閲覧は admin API 経由）

alter table public.study_sessions
  add column if not exists notify_1month_at timestamptz,
  add column if not exists remind_1week_at timestamptz,
  add column if not exists remind_1day_at timestamptz;

comment on column public.study_sessions.notify_1month_at is '1ヶ月前 未回答催促を送った日時';
comment on column public.study_sessions.remind_1week_at is '1週間前 出席者リマインドを送った日時';
comment on column public.study_sessions.remind_1day_at is '1日前 出席者リマインドを送った日時';

create table if not exists public.study_session_notifications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions(id) on delete cascade,
  stage text not null,
  channel text,
  user_id uuid references public.users(id) on delete set null,
  full_name text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_notifications_session on public.study_session_notifications(session_id);
alter table public.study_session_notifications enable row level security;
