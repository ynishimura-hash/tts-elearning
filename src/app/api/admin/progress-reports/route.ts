/**
 * 管理者向け 進捗報告 API
 *   GET: 全受講生の進捗報告を返す（管理者のみ）。画面側で users と突き合わせて表示する。
 */
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse> {
  try {
    const authed = await createServerClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ success: false, message: 'ログインが必要です' }, { status: 401 })

    const { data: me } = await authed.from('users').select('is_admin').eq('auth_id', user.id).single()
    if (!me?.is_admin) return NextResponse.json({ success: false, message: '権限がありません' }, { status: 403 })

    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: reports, error } = await svc
      .from('progress_reports')
      .select('id, user_id, current_topic, content, reported_at')
      .order('reported_at', { ascending: false })
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    return NextResponse.json({ success: true, reports: reports ?? [] })
  } catch (error) {
    console.error('[admin/progress-reports] GET failed:', error)
    return NextResponse.json({ success: false, message: '処理中にエラーが発生しました' }, { status: 500 })
  }
}
