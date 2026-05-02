import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

async function ensureAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, is_admin')
    .eq('auth_id', user.id)
    .single()
  if (!profile?.is_admin) return null
  return profile.id as string
}

async function pushLine(to: string, message: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return false
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, messages: [{ type: 'text', text: message }] }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await ensureAdmin()
  if (!adminId) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }
  const { id } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: '環境変数未設定' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  // 申請を取得
  const { data: app, error: fetchErr } = await admin
    .from('peak_bottom_applications')
    .select('id, status, tradingview_username, user_id')
    .eq('id', id)
    .single()
  if (fetchErr || !app) {
    return NextResponse.json({ success: false, error: '申請が見つかりません' }, { status: 404 })
  }
  if (app.status === 'completed') {
    return NextResponse.json({ success: false, error: '既に登録完了済みです' }, { status: 409 })
  }

  // ステータス更新
  const { error: updErr } = await admin
    .from('peak_bottom_applications')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: adminId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (updErr) {
    return NextResponse.json({ success: false, error: updErr.message }, { status: 500 })
  }

  // 申請者本人へ LINE 通知（line_user_id があれば）
  const { data: targetUser } = await admin
    .from('users')
    .select('full_name, line_user_id')
    .eq('id', app.user_id)
    .single()

  let lineSent = false
  if (targetUser?.line_user_id) {
    const message =
      `【反対線ピークボトムツール】\n\n` +
      `${targetUser.full_name} 様\n\n` +
      `TradingView インジケータの登録が完了いたしました。\n` +
      `アカウント名: ${app.tradingview_username}\n\n` +
      `TradingView をご確認ください。\n\nTTS事務局`
    lineSent = await pushLine(targetUser.line_user_id, message)
  }

  return NextResponse.json({ success: true, line_sent: lineSent })
}
