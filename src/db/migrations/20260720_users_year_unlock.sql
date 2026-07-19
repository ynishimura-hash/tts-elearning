-- 2年目 / 3年目コースの手動解放フラグ
-- 通常は account_issued_at からの経過日数（365日 / 730日）で自動解放されるが、
-- 管理画面でこのフラグを立てた受講生は経過日数を問わず閲覧できる。
-- 既定 FALSE のため、既存受講生の見え方は変わらない。

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS year2_unlocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS year3_unlocked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.year2_unlocked IS '2年目以降コースを経過日数に関わらず解放する（管理画面で手動設定）';
COMMENT ON COLUMN users.year3_unlocked IS '3年目以降コースを経過日数に関わらず解放する（管理画面で手動設定）';
