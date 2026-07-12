/**
 * 進捗報告の案内を「今すぐ」手動でLINE送信する（管理者のみ）。
 * 自動催促(cron)とは別に、管理画面のボタンから対象テスター全員へ即時案内する用途。
 */
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { pushLineMessage } from '@/lib/line-push'
import { buildProgressInviteMessage, progressRecipientChannel } from '@/lib/progress-report'

interface TargetRow {
  id: string
  full_name: string
  is_online: boolean
  is_tester: boolean
  line_user_id_online: string | null
  line_user_id_offline: string | null
  study_notify_enabled: boolean | null
}

export async function POST(): Promise<NextResponse> {
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
    const { data: targets } = await svc
      .from('users')
      .select('id, full_name, is_online, is_tester, line_user_id_online, line_user_id_offline, study_notify_enabled')
      .eq('is_admin', false)
      .eq('is_test', false)
      .eq('is_tester', true)

    let sentCount = 0
    let targetCount = 0
    for (const u of (targets ?? []) as TargetRow[]) {
      if (u.study_notify_enabled === false) continue
      targetCount++
      const channel = progressRecipientChannel(u.is_online, u.is_tester)
      const lineUserId = channel === 'online' ? u.line_user_id_online : u.line_user_id_offline
      if (lineUserId) {
        const ok = await pushLineMessage(lineUserId, buildProgressInviteMessage(u.is_online), channel)
        if (ok) sentCount++
      }
    }

    return NextResponse.json({ success: true, sentCount, targetCount })
  } catch (error) {
    console.error('[line/progress-invite] failed:', error)
    return NextResponse.json({ success: false, message: '処理中にエラーが発生しました' }, { status: 500 })
  }
}
