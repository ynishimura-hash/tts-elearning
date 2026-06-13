-- 段階通知エンジン：手動催促時などに、特定段階の自動送信をスキップするための配列
alter table public.study_sessions
  add column if not exists notify_skip text[] not null default '{}';
comment on column public.study_sessions.notify_skip is
  '自動送信をスキップする段階フラグ名の配列（notify_1month_at / two_week_notify_sent_at / remind_1week_at / remind_1day_at）';
