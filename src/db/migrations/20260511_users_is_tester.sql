-- テスターフラグ追加（2026-05-11）
-- オンラインユーザーのうち、リアル勉強会にも参加可能なテスター区分を表す。
-- 既存の is_test（ダミーアカウント識別）とは別概念。

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_tester BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_tester IS 'テスター区分。trueの場合、オンライン受講生でもリアル勉強会の出欠回答が可能';

-- 対象5名にテスターフラグを付与
UPDATE users SET is_tester = true
WHERE email IN (
  'yohei.yamada.works@gmail.com',  -- 山田洋平
  'tsuy84334@gmail.com',           -- 露成早貴（つゆなる）
  'mkmc.0725@gmail.com',           -- 半田万左希（はんだ）
  'xxtomoxx5@gmail.com',           -- 松田智子
  'online@gmail.com'               -- オンライン用テストアカウント
);
