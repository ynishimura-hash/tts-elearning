import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

async function ensureAdmin(): Promise<boolean> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('auth_id', user.id)
    .single()
  return profile?.is_admin === true
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }
  const { id } = await params
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // 入金完了済みは削除不可（誤操作防止）
  const { data: app } = await admin
    .from('applications')
    .select('id, payment_status, user_id')
    .eq('id', id)
    .single()
  if (!app) {
    return NextResponse.json({ success: false, error: '申込が見つかりません' }, { status: 404 })
  }
  if (app.payment_status === 'paid' || app.user_id) {
    return NextResponse.json(
      { success: false, error: '入金完了済みの申込は削除できません（受講生データに影響するため）' },
      { status: 409 }
    )
  }
  const { error } = await admin.from('applications').delete().eq('id', id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
