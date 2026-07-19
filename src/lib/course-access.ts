import { daysSince } from '@/lib/utils'
import type { Course, User } from '@/types/database'

/** 2年目以降コースが自動解放されるまでの日数 */
export const YEAR2_UNLOCK_DAYS = 365
/** 3年目以降コースが自動解放されるまでの日数 */
export const YEAR3_UNLOCK_DAYS = 730

/** 閲覧可否の判定に必要な受講生の項目 */
export type CourseAccessUser = Pick<User, 'account_issued_at'> & {
  year2_unlocked?: boolean
  year3_unlocked?: boolean
}

/** 閲覧可否の判定に必要なコースの項目 */
export type CourseAccessCourse = Pick<Course, 'is_2nd_year' | 'is_3rd_year' | 'viewable_after_days'>

/**
 * 受講生がそのコースを閲覧できるか。
 *
 * 2年目 / 3年目コースは、アカウント発行日からの経過日数で自動解放されるほか、
 * 管理画面で year2_unlocked / year3_unlocked を立てると経過日数を問わず解放される。
 * 1年目コースは従来どおり viewable_after_days による段階解放のみ。
 */
export function canViewCourse(
  user: CourseAccessUser | null | undefined,
  course: CourseAccessCourse
): boolean {
  if (!user) return false

  const elapsed = daysSince(user.account_issued_at)

  if (course.is_2nd_year) {
    if (user.year2_unlocked) return true
    return elapsed >= YEAR2_UNLOCK_DAYS && course.viewable_after_days <= elapsed
  }

  if (course.is_3rd_year) {
    if (user.year3_unlocked) return true
    return elapsed >= YEAR3_UNLOCK_DAYS && course.viewable_after_days <= elapsed
  }

  return course.viewable_after_days <= elapsed
}

/**
 * 2年目以降コース全体が解放されているか（案内メッセージの出し分け用）。
 * 個別コースの可否は canViewCourse を使うこと。
 */
export function isYear2Unlocked(user: CourseAccessUser | null | undefined): boolean {
  if (!user) return false
  return user.year2_unlocked === true || daysSince(user.account_issued_at) >= YEAR2_UNLOCK_DAYS
}

/** 3年目以降コース全体が解放されているか（案内メッセージの出し分け用） */
export function isYear3Unlocked(user: CourseAccessUser | null | undefined): boolean {
  if (!user) return false
  return user.year3_unlocked === true || daysSince(user.account_issued_at) >= YEAR3_UNLOCK_DAYS
}
