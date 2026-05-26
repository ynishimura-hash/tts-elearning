/**
 * LINE Messaging API を使った Push 送信ヘルパー
 *
 * 2チャネル運用対応:
 *   - 'online'  → LINE_CHANNEL_ACCESS_TOKEN_ONLINE
 *   - 'offline' → LINE_CHANNEL_ACCESS_TOKEN_OFFLINE
 *
 * 後方互換のため LINE_CHANNEL_ACCESS_TOKEN（旧キー）も fallback で参照する
 * （Vercel env の差し替え過渡期の安全弁）。差し替え完了後は削除予定。
 */

import type { LineChannel } from '@/types/database'

function resolveAccessToken(channel: LineChannel): string | undefined {
  if (channel === 'online') {
    return (
      process.env.LINE_CHANNEL_ACCESS_TOKEN_ONLINE ||
      process.env.LINE_CHANNEL_ACCESS_TOKEN
    )
  }
  return process.env.LINE_CHANNEL_ACCESS_TOKEN_OFFLINE
}

/**
 * LINE Push API でメッセージを送信する。
 *
 * @param to       LINE userId / groupId / roomId
 * @param text     送信テキスト
 * @param channel  どちらの公式LINE から送信するか
 * @returns        送信成功時 true、失敗または未設定時 false
 */
export async function pushLineMessage(
  to: string,
  text: string,
  channel: LineChannel
): Promise<boolean> {
  const token = resolveAccessToken(channel)
  if (!token) {
    console.warn(
      `LINE_CHANNEL_ACCESS_TOKEN_${channel.toUpperCase()} 未設定のため Push をスキップ (to=${to.slice(0, 6)}…)`
    )
    return false
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }],
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.error(`LINE push failed (${channel}, ${res.status}): ${body}`)
      return false
    }
    return true
  } catch (err) {
    console.error(`LINE push error (${channel}):`, err)
    return false
  }
}

/**
 * 同一テキストを複数の宛先に送信する。channel ごとにまとめて送るバッチ用ヘルパー。
 * 返り値は { sent: 成功件数, failed: 失敗件数 }。
 */
export async function pushLineMessages(
  recipients: Array<{ to: string; channel: LineChannel }>,
  text: string
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  for (const r of recipients) {
    const ok = await pushLineMessage(r.to, text, r.channel)
    if (ok) sent++
    else failed++
  }
  return { sent, failed }
}
