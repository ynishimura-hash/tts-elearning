/**
 * 管理者向け: ユーザーに紐付いた公式LINE へテストメッセージを Push する。
 *
 * 連携が実際に効いているか（line_user_id_{channel} が有効か）を、
 * 管理画面のユーザー詳細から1タップで確認するための導線。
 *
 * POST /api/admin/users/[id]/line-test
 * Body: { channel: 'online' | 'offline' }
 *
 * pushLineMessage は失敗時に例外を投げず false を返すため、
 * 返り値を必ず判定して成否を正直に返す（送れていないのに success にしない）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { pushLineMessage } from '@/lib/line-push'
import type { LineChannel } from '@/types/database'

interface LineTestBody {
  channel?: LineChannel
}

async function ensureAdmin(): Promise<boolean> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('auth_id', user.id)
    .single()
  return profile?.is_admin === true
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, reason: 'forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: LineTestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, reason: 'invalid_input' }, { status: 400 })
  }
  const channel = body.channel
  if (channel !== 'online' && channel !== 'offline') {
    return NextResponse.json({ success: false, reason: 'invalid_input' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  const { data: target } = await admin
    .from('users')
    .select('id, full_name, line_user_id_online, line_user_id_offline')
    .eq('id', id)
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ success: false, reason: 'not_found' }, { status: 404 })
  }

  const lineUserId =
    channel === 'online' ? target.line_user_id_online : target.line_user_id_offline
  if (!lineUserId) {
    return NextResponse.json({ success: false, reason: 'not_linked' }, { status: 400 })
  }

  const channelLabel = channel === 'online' ? 'オンライン' : '対面'
  const text =
    `【テスト送信】${target.full_name}様\n\n` +
    `こちらは${channelLabel}公式LINEからのテスト送信です。\n` +
    `このメッセージが届いていれば、LINE連携は正常に完了しています。\n\n` +
    `TTS運営事務局`

  // pushLineMessage は失敗時 false（例外なし）→ 必ず判定する
  const ok = await pushLineMessage(lineUserId, text, channel)
  if (!ok) {
    return NextResponse.json({ success: false, reason: 'push_failed' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
