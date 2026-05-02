import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface ApplyBody {
  tradingview_username: string
}

async function notifyAdminLineGroup(message: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!token || !supabaseUrl || !serviceKey) return

  const sb = createServiceClient(supabaseUrl, serviceKey)
  const { data: target } = await sb
    .from('line_groups')
    .select('group_id')
    .eq('is_peak_bottom_target', true)
    .maybeSingle()
  if (!target?.group_id) return

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      to: target.group_id,
      messages: [{ type: 'text', text: message }],
    }),
  }).catch(() => {})
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('auth_id', authUser.id)
    .single()
  if (!profile) {
    return NextResponse.json({ success: false, error: 'ユーザー情報が見つかりません' }, { status: 404 })
  }

  let body: ApplyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const username = body.tradingview_username?.trim()
  if (!username) {
    return NextResponse.json(
      { success: false, error: 'TradingView アカウント名を入力してください' },
      { status: 400 }
    )
  }
  if (username.length > 100) {
    return NextResponse.json(
      { success: false, error: 'アカウント名が長すぎます' },
      { status: 400 }
    )
  }

  // 既存の pending 申請があれば上書き、無ければ新規作成
  const { data: existing } = await supabase
    .from('peak_bottom_applications')
    .select('id')
    .eq('user_id', profile.id)
    .eq('status', 'pending')
    .maybeSingle()

  const isUpdate = !!existing
  if (existing) {
    const { error } = await supabase
      .from('peak_bottom_applications')
      .update({
        tradingview_username: username,
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
  } else {
    const { error } = await supabase.from('peak_bottom_applications').insert({
      user_id: profile.id,
      tradingview_username: username,
      status: 'pending',
    })
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
  }

  // 管理者LINEグループへ通知
  await notifyAdminLineGroup(
    `【反対線ピークボトム ${isUpdate ? '再' : ''}申請】\n\n` +
    `氏名: ${profile.full_name}\n` +
    `メール: ${profile.email}\n` +
    `TradingView: ${username}\n\n` +
    `管理画面: https://tts-e.vercel.app/admin/peak-bottom`
  )

  return NextResponse.json({ success: true, action: isUpdate ? 'updated' : 'created' })
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()
  if (!profile) {
    return NextResponse.json({ success: false, error: 'ユーザー情報が見つかりません' }, { status: 404 })
  }

  // 最新の申請（pending 優先 → 直近の completed）
  const { data, error } = await supabase
    .from('peak_bottom_applications')
    .select('id, tradingview_username, status, applied_at, completed_at')
    .eq('user_id', profile.id)
    .order('applied_at', { ascending: false })
    .limit(1)
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, application: data?.[0] || null })
}
