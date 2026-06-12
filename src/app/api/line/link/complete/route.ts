/**
 * LINE 連携の完了エンドポイント（ログインベース）
 *
 * 旧 /verify（氏名+電話照合）に代わる方式。
 * フロー:
 *   1. Authorization: Bearer <access_token> でログイン中ユーザーを特定
 *      （Cookie依存を避け、LINEアプリ内ブラウザでも確実に動くようにする）
 *   2. line_link_tokens の有効性を確認
 *   3. user の is_online / is_tester と channel の役割整合を確認
 *   4. users.line_user_id_<channel> に token の line_user_id を保存
 *   5. token を used に更新
 *   6. 完了メッセージを LINE で Push
 *
 * POST /api/line/link/complete
 * Header: Authorization: Bearer <supabase access_token>
 * Body: { token, channel }
 * 本人特定はアクセストークンで行うため、クライアントから user_id は受け取らない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { pushLineMessage } from '@/lib/line-push'
import type { LineChannel } from '@/types/database'

interface CompleteBody {
  token?: string
  channel?: LineChannel
}

type Reason =
  | 'invalid_input'
  | 'not_logged_in'
  | 'invalid_token'
  | 'channel_role_mismatch'
  | 'already_linked'
  | 'server_error'

interface CompleteResponse {
  success: boolean
  full_name?: string
  reason?: Reason
}

export async function POST(request: NextRequest): Promise<NextResponse<CompleteResponse>> {
  let body: CompleteBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, reason: 'invalid_input' }, { status: 400 })
  }

  const { token, channel } = body
  if (!token || !channel || !['online', 'offline'].includes(channel)) {
    return NextResponse.json({ success: false, reason: 'invalid_input' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  // 1) アクセストークンからログイン中ユーザーを特定
  const authHeader = request.headers.get('authorization') || ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!accessToken) {
    return NextResponse.json({ success: false, reason: 'not_logged_in' }, { status: 401 })
  }
  const {
    data: { user: authUser },
    error: authErr,
  } = await admin.auth.getUser(accessToken)
  if (authErr || !authUser) {
    return NextResponse.json({ success: false, reason: 'not_logged_in' }, { status: 401 })
  }

  // 2) プロフィール取得
  const { data: profile } = await admin
    .from('users')
    .select('id, full_name, is_online, is_tester, line_user_id_online, line_user_id_offline')
    .eq('auth_id', authUser.id)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }

  // 3) トークン検証
  const { data: tokenRow } = await admin
    .from('line_link_tokens')
    .select('token, line_user_id, channel, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()
  if (
    !tokenRow ||
    tokenRow.used_at ||
    tokenRow.channel !== channel ||
    new Date(tokenRow.expires_at) <= new Date()
  ) {
    return NextResponse.json({ success: false, reason: 'invalid_token' }, { status: 400 })
  }

  // 4) 役割整合（online: オンライン会員 or テスター / offline: オフライン会員かつテスター以外）
  const roleOk =
    channel === 'online'
      ? profile.is_online === true || profile.is_tester === true
      : profile.is_online === false && profile.is_tester !== true
  if (!roleOk) {
    return NextResponse.json({ success: false, reason: 'channel_role_mismatch' }, { status: 400 })
  }

  // 5) 既に別のLINEが紐付いている場合のみ弾く（同一IDの再連携は許可）
  const existing =
    channel === 'online' ? profile.line_user_id_online : profile.line_user_id_offline
  if (existing && existing !== tokenRow.line_user_id) {
    return NextResponse.json({ success: false, reason: 'already_linked' }, { status: 409 })
  }

  // 6) 紐付け保存
  const column = channel === 'online' ? 'line_user_id_online' : 'line_user_id_offline'
  const { error: updateError } = await admin
    .from('users')
    .update({ [column]: tokenRow.line_user_id })
    .eq('id', profile.id)
  if (updateError) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }

  // 7) トークンを used に
  await admin
    .from('line_link_tokens')
    .update({ used_at: new Date().toISOString(), linked_user_id: profile.id })
    .eq('token', token)

  // 8) 完了メッセージを LINE で Push
  await pushLineMessage(
    tokenRow.line_user_id,
    `${profile.full_name}様\n\nLINE連携が完了しました。\n今後、勉強会のご案内などをこちらのトークでお送りします。`,
    channel
  )

  return NextResponse.json({ success: true, full_name: profile.full_name })
}
