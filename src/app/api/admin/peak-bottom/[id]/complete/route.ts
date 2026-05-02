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

  // 完了通知は手動で行う方針のため、自動通知はしない
  return NextResponse.json({ success: true })
}
