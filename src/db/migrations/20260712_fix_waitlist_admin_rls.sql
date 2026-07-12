-- 空き待ち管理が「登録済みなのに表示されない」不具合の根本修正。
-- 旧 admin ポリシーが users.id = auth.uid() と誤記されており（正しくは auth_id）、
-- 管理者判定が常に偽 → 招待前（invite_token=NULL）の行が管理画面から見えなかった。
--
-- ※ アプリ側は service role のサーバーAPI（/api/admin/waitlist）に切替済みで、
--    このポリシー修正が無くても管理画面は動作する。これは DB 側の整合性を正す補修。

drop policy if exists "waitlist_admin_all" on public.waitlist_applications;

create policy "waitlist_admin_all" on public.waitlist_applications
  for all using (
    exists (
      select 1 from public.users
      where public.users.auth_id = auth.uid() and public.users.is_admin = true
    )
  );
