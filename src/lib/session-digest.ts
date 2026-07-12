/**
 * まとめ案内（今後の勉強会 + 各自の出欠状況を1通に）の共通ロジック。
 * 勉強会が終わった翌日やリマインド連絡の代わりに、参加可能な今後の勉強会を
 * 出欠状況付きでまとめて送り、取りこぼしを減らす。
 */

export const DEFAULT_DIGEST_INTRO =
  `こんにちは！\n` +
  `先日ご参加いただいた方はお疲れ様でした！\n` +
  `運営の工藤です！\n\n` +
  `今回は、有料会員特典の勉強会に関するご案内です！\n\n` +
  `次回以降の日程はこちらになっております！\n` +
  `今回の予定からは、TTS e-ラーニングシステムにログインし、メニューにある「勉強会」ページから参加可否のご回答をお願いします^ ^`

export const DEFAULT_DIGEST_CLOSING = `どうぞよろしくお願いします✨`

export type DigestStatus = '出席' | '欠席' | '未定' | '未回答'

export interface DigestSessionLine {
  dateLabel: string // 例: 7月19日(日)
  time: string | null
  isOnline: boolean
  status: DigestStatus
}

/** 1人分のまとめ案内メッセージを組み立てる（出欠回答リンクは呼び出し側で各自URLを渡す） */
export function buildDigestMessage(
  intro: string,
  closing: string,
  lines: DigestSessionLine[],
  attendUrl: string
): string {
  const body = lines
    .map((l) => `・${l.dateLabel}${l.time ? ` ${l.time}` : ''} ${l.isOnline ? 'オンライン' : '対面'} … ${l.status}`)
    .join('\n')
  const hasUnanswered = lines.some((l) => l.status === '未回答')
  const guide = hasUnanswered
    ? `\n\n未回答の勉強会は、ログインして「勉強会」ページから出欠のご回答をお願いします。\n\n▼ 出欠の回答はこちら\n${attendUrl}`
    : `\n\n出欠の変更は「勉強会」ページから行えます。\n${attendUrl}`
  return `${intro}\n\n＜今後の勉強会＞\n${body}${guide}\n\n${closing}`
}
