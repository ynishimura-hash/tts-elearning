/**
 * LINE 連携の確認・突合エンドポイント
 *
 * フローの最終ステップ:
 *   1. line_link_tokens の有効性を再確認
 *   2. 入力された氏名 + 電話番号で users テーブルを突合
 *   3. user の is_online と channel が一致するか確認（テスター仕様考慮）
 *   4. users.line_user_id_<channel> に line_user_id を保存
 *   5. line_link_tokens を used 状態に更新
 *   6. 完了メッセージを LINE で Push 通知
 *
 * POST /api/line/link/verify
 * Body: { token, channel, full_name, phone }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushLineMessage } from '@/lib/line-push'
import type { LineChannel } from '@/types/database'

interface VerifyBody {
  token?: string
  channel?: LineChannel
  full_name?: string
  phone?: string
}

interface VerifyResponse {
  success: boolean
  error?: string
  reason?:
    | 'invalid_input'
    | 'invalid_token'
    | 'no_match'
    | 'multiple_match'
    | 'channel_role_mismatch'
    | 'already_linked'
    | 'server_error'
}

/** 電話番号正規化: 数字のみ抽出（全角→半角、ハイフン等除去） */
function normalizePhone(s: string): string {
  return s
    .replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .replace(/\D/g, '')
}

/** 氏名正規化: 前後空白除去、全角スペースを半角に、連続空白を1つに */
function normalizeName(s: string): string {
  return s
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest): Promise<NextResponse<VerifyResponse>> {
  let body: VerifyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, reason: 'invalid_input' }, { status: 400 })
  }

  const { token, channel, full_name, phone } = body
  if (
    !token ||
    !channel ||
    !['online', 'offline'].includes(channel) ||
    !full_name?.trim() ||
    !phone?.trim()
  ) {
    return NextResponse.json({ success: false, reason: 'invalid_input' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }
  const sb = createClient(supabaseUrl, serviceRoleKey)

  // 1) トークン有効性確認
  const { data: tokenRow } = await sb
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

  // 2) users 突合
  const normalizedName = normalizeName(full_name)
  const normalizedPhone = normalizePhone(phone)
  if (normalizedPhone.length < 9) {
    return NextResponse.json({ success: false, reason: 'invalid_input' }, { status: 400 })
  }

  // 候補ユーザーを full_name の前方一致で取得し、phone を正規化比較
  // （full_name の表記揺れに耐えるため）
  const { data: candidates } = await sb
    .from('users')
    .select('id, full_name, phone, is_online, is_tester, line_user_id_online, line_user_id_offline')

  const matched = (candidates || []).filter((u) => {
    if (!u.phone) return false
    const userName = normalizeName(u.full_name || '')
    const userPhone = normalizePhone(u.phone)
    return userName === normalizedName && userPhone === normalizedPhone
  })

  if (matched.length === 0) {
    return NextResponse.json({ success: false, reason: 'no_match' }, { status: 404 })
  }
  if (matched.length > 1) {
    return NextResponse.json({ success: false, reason: 'multiple_match' }, { status: 409 })
  }

  const user = matched[0]

  // 3) channel と user の役割が一致するか確認
  // - channel='online'  → is_online=true または is_tester=true なら OK
  // - channel='offline' → is_online=false（テスター除外） なら OK
  const roleOk =
    channel === 'online'
      ? user.is_online === true || user.is_tester === true
      : user.is_online === false && user.is_tester !== true

  if (!roleOk) {
    return NextResponse.json(
      { success: false, reason: 'channel_role_mismatch' },
      { status: 400 }
    )
  }

  // 既に連携済みか確認
  const existingLineId =
    channel === 'online' ? user.line_user_id_online : user.line_user_id_offline
  if (existingLineId && existingLineId !== tokenRow.line_user_id) {
    // 別の LINE userId が既に紐付いている場合は事務局案件
    return NextResponse.json(
      { success: false, reason: 'already_linked' },
      { status: 409 }
    )
  }

  // 4) users に LINE userId を保存
  const updateColumn =
    channel === 'online' ? 'line_user_id_online' : 'line_user_id_offline'
  const { error: updateError } = await sb
    .from('users')
    .update({ [updateColumn]: tokenRow.line_user_id })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }

  // 5) トークンを used 状態に
  await sb
    .from('line_link_tokens')
    .update({
      used_at: new Date().toISOString(),
      linked_user_id: user.id,
    })
    .eq('token', token)

  // 6) 完了メッセージを LINE で Push
  await pushLineMessage(
    tokenRow.line_user_id,
    `${user.full_name}様\n\nLINE連携が完了しました。\n今後、勉強会のご案内などをこちらのトークでお送りします。`,
    channel
  )

  return NextResponse.json({ success: true })
}
