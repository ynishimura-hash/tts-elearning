-- 2年目 / 3年目コースを DB 層（RLS）でも保護する
--
-- 背景: courses / contents の SELECT ポリシーが USING (TRUE) だったため、
-- ログイン済みであれば未解放のコース・教材も API から取得できてしまっていた。
-- 画面側のガードに加えて DB 層でも塞ぐ。
--
-- 前提: 20260720_users_year_unlock.sql（year2_unlocked / year3_unlocked 追加）適用済み
--
-- ⚠ 適用前に必ず「検証手順」（ファイル末尾）を実施すること。
--   誤ると全受講生がコースを閲覧できなくなる。ロールバック SQL も末尾に用意。

-- 受講生の解放状況を RLS をバイパスして取得するヘルパー。
-- SECURITY DEFINER にすることで、ポリシー内で users を参照する際の
-- 再帰的なポリシー評価とパフォーマンス劣化を避ける。
CREATE OR REPLACE FUNCTION public.current_course_access()
RETURNS TABLE (is_admin BOOLEAN, year2_ok BOOLEAN, year3_ok BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(u.is_admin, FALSE),
    COALESCE(u.year2_unlocked, FALSE)
      OR COALESCE(u.account_issued_at <= NOW() - INTERVAL '365 days', FALSE),
    COALESCE(u.year3_unlocked, FALSE)
      OR COALESCE(u.account_issued_at <= NOW() - INTERVAL '730 days', FALSE)
  FROM users u
  WHERE u.auth_id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_course_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_course_access() TO authenticated;

-- コース: 未解放の2年目 / 3年目コースは取得させない
DROP POLICY IF EXISTS "courses_select_authenticated" ON courses;
CREATE POLICY "courses_select_authenticated" ON courses FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.current_course_access() a
    WHERE a.is_admin
       OR (
            (NOT courses.is_2nd_year OR a.year2_ok)
        AND (NOT courses.is_3rd_year OR a.year3_ok)
       )
  )
);

-- コンテンツ: 所属コースが閲覧できない場合は教材も取得させない
DROP POLICY IF EXISTS "contents_select_authenticated" ON contents;
CREATE POLICY "contents_select_authenticated" ON contents FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM courses c, public.current_course_access() a
    WHERE c.id = contents.course_id
      AND (
        a.is_admin
        OR (
              (NOT c.is_2nd_year OR a.year2_ok)
          AND (NOT c.is_3rd_year OR a.year3_ok)
        )
      )
  )
);

-- 注: 1年目コースの viewable_after_days による段階解放は、
-- 意図的にこのポリシーへ含めていない（学習ペース調整であり非公開情報ではないため）。
-- DB 層で締めると account_issued_at 未設定の受講生が全コースを失うリスクがあるため画面側の制御に留める。


-- ============================================================
-- 検証手順（適用直後に必ず実施）
-- ============================================================
-- 1) 1年以上経過した受講生の auth_id で、courses が従来どおり全件見えること
-- 2) 1年未満・フラグなしの受講生で、is_2nd_year のコースが 0 件になること
-- 3) その受講生に year2_unlocked = TRUE を立てると 2年目コースが見えること
-- 4) 管理者アカウントで管理画面のコース管理が全件見えること
-- 5) 受講生画面（ホーム / コース一覧 / コース詳細）が真っ白にならないこと
--
-- 例: 特定ユーザー視点での見え方を確認する
--   SELECT c.name, c.is_2nd_year, c.is_3rd_year
--   FROM courses c ORDER BY c.sort_order;
--   （Supabase SQL Editor は service role のため RLS を迂回する点に注意。
--     実際の検証は必ずアプリにログインして行うこと）

-- ============================================================
-- ロールバック（問題が出たら即実行）
-- ============================================================
-- DROP POLICY IF EXISTS "courses_select_authenticated" ON courses;
-- CREATE POLICY "courses_select_authenticated" ON courses FOR SELECT TO authenticated USING (TRUE);
-- DROP POLICY IF EXISTS "contents_select_authenticated" ON contents;
-- CREATE POLICY "contents_select_authenticated" ON contents FOR SELECT TO authenticated USING (TRUE);
-- DROP FUNCTION IF EXISTS public.current_course_access();
