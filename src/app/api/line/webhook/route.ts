import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { pushLineMessage } from '@/lib/line-push'

interface LineEvent {
  type: string
  source: {
    type: 'user' | 'group' | 'room'
    userId?: string
    groupId?: string
    roomId?: string
  }
  message?: {
    type: string
    text?: string
  }
  replyToken?: string
}

interface LineWebhookBody {
  events: LineEvent[]
}

// LINE 署名検証
function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET
  if (!secret) return true // 未設定時は素通し（開発時用）
  if (!signature) return false
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

async function replyToLine(replyToken: string, text: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return
  await fetch('https://api.line.me/v2/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  }).catch(() => {})
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: LineWebhookBody
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: '環境変数未設定' }, { status: 500 })
  }
  const sb = createClient(supabaseUrl, serviceRoleKey)

  for (const event of payload.events || []) {
    const sourceType = event.source.type
    const groupId =
      event.source.groupId || event.source.roomId || event.source.userId
    if (!groupId) continue

    // line_groups に upsert
    await sb.from('line_groups').upsert(
      {
        group_id: groupId,
        source_type: sourceType,
        last_event_type: event.type,
        last_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id', ignoreDuplicates: false }
    )

    const text = event.message?.text || ''
    const lineUserId = event.source.userId

    // 「申し込み」「申込」テキストで token 発行 + 専用URLを Push 送信
    // ※ LINE OA の「一律応答」が reply_token を先に消費する場合があるため、
    //   reply ではなく Push API を使う（reply_tokenに依存しない）
    if (
      event.type === 'message' &&
      event.message?.type === 'text' &&
      lineUserId &&
      /^(申し?込み?|apply)$/i.test(text.trim())
    ) {
      // 既存の未使用トークンがあれば再利用、なければ新規発行
      const { data: existing } = await sb
        .from('apply_invite_tokens')
        .select('token, expires_at')
        .eq('line_user_id', lineUserId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let token: string
      if (existing) {
        token = existing.token
      } else {
        const { data: created, error } = await sb
          .from('apply_invite_tokens')
          .insert({
            line_user_id: lineUserId,
            source_type: sourceType,
            course_type: 'online',
          })
          .select('token')
          .single()
        if (error || !created) {
          await pushLineMessage(lineUserId, '申込URLの発行に失敗しました。お手数ですが事務局までご連絡ください。')
          continue
        }
        token = created.token
      }

      const applyUrl = `https://tts-e.vercel.app/apply/online?token=${token}`
      await pushLineMessage(
        lineUserId,
        `TTSオンライン有料会員のお申込みは下記URLからどうぞ。\n\n` +
        `${applyUrl}\n\n` +
        `※ このURLは7日間有効です。\n` +
        `※ フォーム送信後、PayPalお支払いリンクをこちらのトークと、ご入力いただいたメールアドレス宛にお送りします。`
      )
      continue
    }

    // 「ID教えて」みたいなテキストでIDを返信
    if (
      event.type === 'message' &&
      event.message?.type === 'text' &&
      event.replyToken &&
      /(\bID\b|教えて|id)/i.test(text)
    ) {
      await replyToLine(
        event.replyToken,
        `このトークの ID:\n${groupId}\n\n種別: ${sourceType}`
      )
    }
  }

  return NextResponse.json({ ok: true })
}

// LINE webhook 検証 (GET で疎通確認)
export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST your LINE webhook here' })
}
