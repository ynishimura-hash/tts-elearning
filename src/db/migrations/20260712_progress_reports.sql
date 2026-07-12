-- 進捗報告（受講生の自己申告・提出後は編集不可・振り返り用ログ）
-- アクセスは全てサーバーAPI（service role）経由。RLS は有効化しつつポリシー無し＝
-- anon/authenticated からの直接アクセスを遮断し、service role のみ操作可能にする。

create table if not exists public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- 現在どこを学習中か（短文・任意）
  current_topic text,
  -- 進捗内容・気づき（自由記述・必須）
  content text not null,
  -- 報告日時（＝提出時刻。日付・時間の管理はこの列で行う）
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.progress_reports is '受講生の進捗報告（提出後は編集不可。2週間ごとに催促）';
comment on column public.progress_reports.current_topic is '現在の学習箇所（短文・任意）';
comment on column public.progress_reports.content is '進捗内容・気づき（自由記述・必須）';
comment on column public.progress_reports.reported_at is '報告日時（提出時刻）';

create index if not exists idx_progress_reports_user
  on public.progress_reports(user_id, reported_at desc);

-- RLS は有効化するがポリシーは作らない＝service role のみ（サーバーAPI経由）で読み書き
alter table public.progress_reports enable row level security;

-- 進捗報告の自動催促（LINE）で「この周期はもう催促した」を記録し、日次cronの重複送信を防ぐ
alter table public.users
  add column if not exists progress_reminded_at timestamptz;
comment on column public.users.progress_reminded_at is '進捗報告の自動催促を最後に送った日時（cronの重複送信防止）';
