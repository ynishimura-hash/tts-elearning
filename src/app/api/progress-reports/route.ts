/**
 * 受講生の進捗報告 API
 *   POST: 進捗を提出（提出後は編集不可）。本人は認証セッションから特定するので詐称不可。
 *   GET : ログイン中ユーザー自身の報告一覧を返す。
 *
 * progress_reports は RLS ロック（service role のみ）。ここで service role で読み書きする。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** 認証セッションから users レコードを引く（詐称防止のため body の id は使わない） */
async function resolveProfile(): Promise<{ id: string; is_online: boolean; is_tester: boolean } | null> {
  const authed = await createServerClient()
  const { data: { user } } = await authed.auth.getUser()
  if (!user) return null
  const { data: profile } = await authed
    .from('users')
    .select('id, is_online, is_tester')
    .eq('auth_id', user.id)
    .single()
  return (profile as { id: string; is_online: boolean; is_tester: boolean } | null) ?? null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const profile = await resolveProfile()
    if (!profile) return NextResponse.json({ success: false, message: 'ログインが必要です' }, { status: 401 })

    const body = (await request.json()) as { currentTopic?: string; content?: string }
    const content = (body.content ?? '').trim()
    if (!content) return NextResponse.json({ success: false, message: '進捗内容を入力してください' }, { status: 400 })
    const currentTopic = (body.currentTopic ?? '').trim() || null

    const { error } = await serviceClient()
      .from('progress_reports')
      .insert({ user_id: profile.id, current_topic: currentTopic, content })
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[progress-reports] POST failed:', error)
    return NextResponse.json({ success: false, message: '処理中にエラーが発生しました' }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const profile = await resolveProfile()
    if (!profile) return NextResponse.json({ success: false, message: 'ログインが必要です' }, { status: 401 })

    const { data, error } = await serviceClient()
      .from('progress_reports')
      .select('id, current_topic, content, reported_at')
      .eq('user_id', profile.id)
      .order('reported_at', { ascending: false })
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })

    return NextResponse.json({ success: true, reports: data ?? [] })
  } catch (error) {
    console.error('[progress-reports] GET failed:', error)
    return NextResponse.json({ success: false, message: '処理中にエラーが発生しました' }, { status: 500 })
  }
}
