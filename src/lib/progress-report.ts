/**
 * 進捗報告の共通ロジック（対象者・文面・送信チャネル）。
 * 自動催促cronと手動案内送信で同じ定義を使い、齟齬を防ぐ。
 */
import type { LineChannel } from '@/types/database'

/** 報告の推奨間隔（日）。この日数を超えて未報告なら催促対象。 */
export const PROGRESS_INTERVAL_DAYS = 14

/** 進捗報告ページのURL（会員種別で分岐） */
export function progressReportUrl(isOnline: boolean): string {
  return `https://tts-e.vercel.app${isOnline ? '/online/progress-report' : '/progress-report'}`
}

/** 自動催促・手動案内で使う共通文面 */
export function buildProgressInviteMessage(isOnline: boolean): string {
  return (
    `こんにちは！運営の工藤です！\n\n` +
    `テスターの皆さんへ、2週間に一度の進捗報告のお願いです。\n\n` +
    `Eラーニングシステムの「進捗報告」から、カリキュラムを今どこまで学習しているか、現在の進捗をご記録ください^ ^\n` +
    `（マイページ →「進捗報告」→「進捗を記録する」）\n\n` +
    `ご不明点があれば、質問受付の質問フォームからお気軽にどうぞ✨\n\n` +
    `▼ 進捗報告はこちら\n${progressReportUrl(isOnline)}\n\n` +
    `どうぞよろしくお願いします！`
  )
}

/** 送信チャネル。テスターはオンライン公式LINE から送る（勉強会の送信ロジックと一致）。 */
export function progressRecipientChannel(isOnline: boolean, isTester: boolean): LineChannel {
  return isOnline || isTester ? 'online' : 'offline'
}
