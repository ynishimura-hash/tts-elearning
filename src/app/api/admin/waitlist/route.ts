/**
 * 管理者向け 空き待ち一覧・状態更新 API
 *   GET  : 空き待ち申込を全件返す（管理者のみ）
 *   PATCH: 状態変更（無効化など）（管理者のみ）
 *
 * waitlist_applications は RLS が有効だが admin ポリシーが壊れている
 * （users.id = auth.uid() と誤記。正しくは auth_id）ため、anon クライアントからは
 * 招待前（invite_token=NULL）の行が見えない。ここは service role で確実に扱う。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

async function requireAdmin(): Promise<boolean> {
  const authed = await createServerClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return false
  const { data: me } = await authed.from('users').select('is_admin').eq('auth_id', user.id).single()
  return !!me?.is_admin
}

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(): Promise<NextResponse> {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, message: '権限がありません' }, { status: 403 })
    }
    const { data, error } = await serviceClient()
      .from('waitlist_applications')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    return NextResponse.json({ success: true, rows: data ?? [] })
  } catch (error) {
    console.error('[admin/waitlist] GET failed:', error)
    return NextResponse.json({ success: false, message: '処理中にエラーが発生しました' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ success: false, message: '権限がありません' }, { status: 403 })
    }
    const { id, status } = (await request.json()) as { id?: string; status?: string }
    const allowed = ['waiting', 'invited', 'converted', 'cancelled']
    if (!id || !status || !allowed.includes(status)) {
      return NextResponse.json({ success: false, message: 'パラメータが不正です' }, { status: 400 })
    }
    const { error } = await serviceClient()
      .from('waitlist_applications')
      .update({ status })
      .eq('id', id)
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin/waitlist] PATCH failed:', error)
    return NextResponse.json({ success: false, message: '処理中にエラーが発生しました' }, { status: 500 })
  }
}
