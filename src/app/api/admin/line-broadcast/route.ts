/**
 * 管理者向け: 会員種別ごとの LINE 一斉配信。
 *
 * - audience='online'  → オンライン会員（is_online=true）へ オンライン公式LINE から
 * - audience='offline' → 対面会員（is_online=false かつ非無料）へ 対面公式LINE から
 *
 * 対象は「連携済み（line_user_id がある）かつ 通知オン（study_notify_enabled≠false）」のみ。
 * pushLineMessage は失敗時 false を返すため、成否を1件ずつ集計して正直に返す。
 *
 * POST /api/admin/line-broadcast
 * Body: { audience: 'online' | 'offline', message: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { pushLineMessage } from '@/lib/line-push'
import { renderTemplate } from '@/lib/email-broadcast'
import type { LineChannel } from '@/types/database'

interface BroadcastBody {
  audience?: 'online' | 'offline'
  message?: string
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, reason: 'forbidden' }, { status: 403 })
  }

  let body: BroadcastBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, reason: 'invalid_input' }, { status: 400 })
  }
  const audience = body.audience
  const message = (body.message || '').trim()
  if ((audience !== 'online' && audience !== 'offline') || !message) {
    return NextResponse.json({ success: false, reason: 'invalid_input' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  const channel: LineChannel = audience === 'online' ? 'online' : 'offline'

  // 対象 = 連携済み かつ 通知オン の該当種別会員
  let query = admin
    .from('users')
    .select('id, full_name, line_user_id_online, line_user_id_offline')
    .eq('is_admin', false)
    .eq('is_test', false)
    .eq('study_notify_enabled', true)
  if (audience === 'online') {
    query = query.eq('is_online', true).not('line_user_id_online', 'is', null)
  } else {
    query = query.eq('is_online', false).eq('is_free_user', false).not('line_user_id_offline', 'is', null)
  }

  const { data: recipients, error } = await query
  if (error) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }
  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ success: true, sent: 0, failed: 0, total: 0 })
  }

  let sent = 0
  let failed = 0
  const failures: string[] = []
  for (const u of recipients) {
    const lineUserId =
      audience === 'online' ? u.line_user_id_online : u.line_user_id_offline
    if (!lineUserId) {
      failed++
      continue
    }
    // 氏名差し込み（{{full_name}} / {{name}}）
    const text = renderTemplate(message, { full_name: u.full_name, name: u.full_name })
    const ok = await pushLineMessage(lineUserId, text, channel)
    if (ok) sent++
    else {
      failed++
      failures.push(u.full_name)
    }
  }

  return NextResponse.json({ success: true, sent, failed, total: recipients.length, failures })
}
