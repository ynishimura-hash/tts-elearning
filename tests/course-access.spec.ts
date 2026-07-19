import { test, expect } from '@playwright/test'
import { canViewCourse, isYear2Unlocked } from '../src/lib/course-access'

/** elapsed 日前の ISO 文字列を作る */
function issuedDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

const year1 = { is_2nd_year: false, is_3rd_year: false, viewable_after_days: 30 }
const year2 = { is_2nd_year: true, is_3rd_year: false, viewable_after_days: 0 }
const year3 = { is_2nd_year: false, is_3rd_year: true, viewable_after_days: 0 }

test('SC2: 1年未満・フラグなしは2年目コースを見られない（従来どおり）', () => {
  const u = { account_issued_at: issuedDaysAgo(100) }
  expect(canViewCourse(u, year2)).toBe(false)
  expect(isYear2Unlocked(u)).toBe(false)
})

test('SC4: 1年未満でも year2_unlocked なら2年目コースを見られる', () => {
  const u = { account_issued_at: issuedDaysAgo(100), year2_unlocked: true }
  expect(canViewCourse(u, year2)).toBe(true)
  expect(isYear2Unlocked(u)).toBe(true)
})

test('SC5: year2_unlocked だけでは3年目コースは解放されない', () => {
  const u = { account_issued_at: issuedDaysAgo(100), year2_unlocked: true }
  expect(canViewCourse(u, year3)).toBe(false)
})

test('SC5: year3_unlocked なら3年目コースを見られる', () => {
  const u = { account_issued_at: issuedDaysAgo(100), year3_unlocked: true }
  expect(canViewCourse(u, year3)).toBe(true)
})

test('従来の経過日数による自動解放は維持される（365日 / 730日）', () => {
  expect(canViewCourse({ account_issued_at: issuedDaysAgo(364) }, year2)).toBe(false)
  expect(canViewCourse({ account_issued_at: issuedDaysAgo(366) }, year2)).toBe(true)
  expect(canViewCourse({ account_issued_at: issuedDaysAgo(729) }, year3)).toBe(false)
  expect(canViewCourse({ account_issued_at: issuedDaysAgo(731) }, year3)).toBe(true)
})

test('1年目コースの段階解放（viewable_after_days）は従来どおり', () => {
  expect(canViewCourse({ account_issued_at: issuedDaysAgo(10) }, year1)).toBe(false)
  expect(canViewCourse({ account_issued_at: issuedDaysAgo(40) }, year1)).toBe(true)
  // 解放フラグは1年目コースの段階解放には影響しない
  expect(canViewCourse({ account_issued_at: issuedDaysAgo(10), year2_unlocked: true }, year1)).toBe(false)
})

test('未ログイン（user なし）は閲覧不可', () => {
  expect(canViewCourse(null, year2)).toBe(false)
  expect(canViewCourse(undefined, year1)).toBe(false)
})

test('account_issued_at が未設定なら経過0日扱い（従来どおり）', () => {
  expect(canViewCourse({ account_issued_at: null }, year2)).toBe(false)
  // ただし手動解放は効く
  expect(canViewCourse({ account_issued_at: null, year2_unlocked: true }, year2)).toBe(true)
})
