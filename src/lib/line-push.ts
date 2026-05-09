/**
 * LINE Messaging API を使った Push 送信ヘルパー
 * userId / groupId / roomId のいずれにも送信可能
 */
export async function pushLineMessage(to: string, text: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.warn('LINE_CHANNEL_ACCESS_TOKEN 未設定のため Push をスキップ')
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
      console.error(`LINE push failed (${res.status}): ${body}`)
      return false
    }
    return true
  } catch (err) {
    console.error('LINE push error:', err)
    return false
  }
}
