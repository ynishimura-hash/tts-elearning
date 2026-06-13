/**
 * LINE Webhook 共通ハンドラ
 *
 * online / offline 2チャネルの Webhook で共通利用する。
 * 各チャネルは個別の Channel Secret で署名検証する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import { pushLineMessage } from '@/lib/line-push'
import type { LineChannel } from '@/types/database'

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

/** 該当チャネルの Channel Secret を解決する */
function resolveChannelSecret(channel: LineChannel): string | undefined {
  if (channel === 'online') {
    // 後方互換: 旧 LINE_CHANNEL_SECRET も fallback で参照
    return (
      process.env.LINE_CHANNEL_SECRET_ONLINE ||
      process.env.LINE_CHANNEL_SECRET
    )
  }
  return process.env.LINE_CHANNEL_SECRET_OFFLINE
}

function verifySignature(body: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret) return true // 未設定時は素通し（開発時用）
  if (!signature) return false
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64')
  return hash === signature
}

async function replyToLine(replyToken: string, text: string, channel: LineChannel): Promise<void> {
  const token =
    channel === 'online'
      ? process.env.LINE_CHANNEL_ACCESS_TOKEN_ONLINE || process.env.LINE_CHANNEL_ACCESS_TOKEN
      : process.env.LINE_CHANNEL_ACCESS_TOKEN_OFFLINE
  if (!token) return
  await fetch('https://api.line.me/v2/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }),
  }).catch(() => {})
}

/**
 * LINE Webhook を処理する共通ハンドラ。
 * @param request  NextRequest
 * @param channel  どちらの公式LINE 経由かを明示
 */
export async function handleLineWebhook(
  request: NextRequest,
  channel: LineChannel
): Promise<NextResponse> {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')
  const secret = resolveChannelSecret(channel)

  if (!verifySignature(rawBody, signature, secret)) {
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
    const groupId = event.source.groupId || event.source.roomId || event.source.userId
    if (!groupId) continue

    // line_groups に upsert（channel 別に記録）
    await sb.from('line_groups').upsert(
      {
        group_id: groupId,
        source_type: sourceType,
        channel,
        last_event_type: event.type,
        last_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id', ignoreDuplicates: false }
    )

    const text = event.message?.text || ''
    const lineUserId = event.source.userId

    // ============================================================
    // 「連携」発言 → line_link_tokens にトークン発行 → 専用URLを Push
    // ============================================================
    if (
      event.type === 'message' &&
      event.message?.type === 'text' &&
      lineUserId &&
      /^(連携|れんけい|link|LINE連携)$/i.test(text.trim())
    ) {
      // 既存の未使用トークンがあれば再利用
      const { data: existing } = await sb
        .from('line_link_tokens')
        .select('token, expires_at')
        .eq('line_user_id', lineUserId)
        .eq('channel', channel)
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
          .from('line_link_tokens')
          .insert({
            line_user_id: lineUserId,
            channel,
            source_type: sourceType,
          })
          .select('token')
          .single()
        if (error || !created) {
          await pushLineMessage(
            lineUserId,
            '連携URLの発行に失敗しました。お手数ですが事務局までご連絡ください。',
            channel
          )
          continue
        }
        token = created.token
      }

      const linkUrl = `https://tts-e.vercel.app/line-link/${channel}?token=${token}`
      await pushLineMessage(
        lineUserId,
        `TTS会員アカウントとLINEの連携を行います。\n\n` +
          `下記URLを開き、TTSアカウントにログインしてください。\n` +
          `ログインすると連携が完了します。\n\n` +
          `${linkUrl}\n\n` +
          `※ ログインは、ご登録時のメールアドレスとパスワードです。\n` +
          `※ このURLは7日間有効です。`,
        channel
      )
      continue
    }

    // ============================================================
    // 「申し込み」発言（オンライン専用）→ apply_invite_tokens 発行
    // オフライン側で発言された場合は別案内
    // ============================================================
    if (
      event.type === 'message' &&
      event.message?.type === 'text' &&
      lineUserId &&
      /^(申し?込み?|apply)$/i.test(text.trim())
    ) {
      if (channel === 'offline') {
        // オフライン申込は一旦スコープ外
        await pushLineMessage(
          lineUserId,
          'オフラインのお申し込みについては事務局までお問い合わせください。\n\nLINE連携をご希望の場合は「連携」と送信してください。',
          'offline'
        )
        continue
      }

      // オンラインの場合（既存ロジック）
      const { data: existing } = await sb
        .from('apply_invite_tokens')
        .select('token, expires_at')
        .eq('line_user_id', lineUserId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let applyToken: string
      if (existing) {
        applyToken = existing.token
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
          await pushLineMessage(
            lineUserId,
            '申込URLの発行に失敗しました。お手数ですが事務局までご連絡ください。',
            'online'
          )
          continue
        }
        applyToken = created.token
      }

      const applyUrl = `https://tts-e.vercel.app/apply/online?token=${applyToken}`

      // 受付状態を確認（停止中なら空き待ち案内に切替・PayPalくだりは除く）
      const { data: settings } = await sb
        .from('application_settings')
        .select('online_paused')
        .eq('id', true)
        .maybeSingle()
      const isPaused = !!settings?.online_paused

      const message = isPaused
        ? `現在、TTSオンライン有料会員のお申し込み受付を一時停止しております。\n\n` +
          `下記URLより「空き待ちフォーム」へのご登録をお願いいたします。\n\n` +
          `${applyUrl}\n\n` +
          `※ このURLは7日間有効です。\n` +
          `※ 受付再開の際に、ご入力いただいたメールアドレス宛に、正式なお申し込みのご案内をお送りいたします。`
        : `TTSオンライン有料会員のお申込みは下記URLからどうぞ。\n\n` +
          `${applyUrl}\n\n` +
          `※ このURLは7日間有効です。\n` +
          `※ フォーム送信後、PayPalお支払いリンクをこちらのトークと、ご入力いただいたメールアドレス宛にお送りします。`

      await pushLineMessage(lineUserId, message, 'online')
      continue
    }

    // ============================================================
    // 「ID教えて」→ ID 返信（既存仕様、両チャネル共通）
    // ============================================================
    if (
      event.type === 'message' &&
      event.message?.type === 'text' &&
      event.replyToken &&
      /(\bID\b|教えて|id)/i.test(text)
    ) {
      await replyToLine(
        event.replyToken,
        `このトークの ID:\n${groupId}\n\n種別: ${sourceType}\nチャネル: ${channel}`,
        channel
      )
    }
  }

  return NextResponse.json({ ok: true })
}
