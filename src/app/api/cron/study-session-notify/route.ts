import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushLineMessage } from '@/lib/line-push'

// 2週間前の勉強会自動LINE配信 (Vercel Cron で 1日1回呼ぶ)
// auto_notify_enabled=true, two_week_notify_sent_at IS NULL の
// session_date が今日から14日後 ± 1日に該当するものを対象に通知。

interface NotifyResult {
  session_id: string
  title: string
  is_online: boolean
  sent: number
  errors: string[]
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const targetFrom = new Date(now.getTime() + 13 * 24 * 60 * 60 * 1000)
  const targetTo = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)

  const { data: sessions, error: fetchError } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('auto_notify_enabled', true)
    .is('two_week_notify_sent_at', null)
    .gte('session_date', targetFrom.toISOString())
    .lte('session_date', targetTo.toISOString())

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ message: '対象の勉強会なし', target_count: 0, results: [] })
  }

  const results: NotifyResult[] = []

  for (const session of sessions) {
    const result: NotifyResult = {
      session_id: session.id,
      title: session.title,
      is_online: session.is_online,
      sent: 0,
      errors: [],
    }

    // 対象ユーザー: テスト・管理者を除く、当該タイプの受講生
    // リアル勉強会の場合: オフラインユーザー + テスター
    // オンライン勉強会の場合: オンラインユーザー
    const usersQuery = supabase
      .from('users')
      .select('id, line_user_id, full_name, is_online, is_tester')
      .eq('is_admin', false)
      .eq('is_test', false)

    const { data: users } = session.is_online
      ? await usersQuery.eq('is_online', true)
      : await usersQuery.or('is_online.eq.false,is_tester.eq.true')

    if (!users || users.length === 0) {
      result.errors.push('対象ユーザーなし')
      results.push(result)
      continue
    }

    const sessionDate = new Date(session.session_date).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    })

    for (const user of users) {
      // 出欠レコード作成（pending）
      await supabase
        .from('study_session_attendance')
        .upsert({
          session_id: session.id,
          user_id: user.id,
          status: 'pending',
        }, { onConflict: 'session_id,user_id' })

      if (user.line_user_id) {
        const locationInfo = session.is_online
          ? (session.zoom_url ? `\nZoom: ${session.zoom_url}` : '')
          : (session.location ? `\n場所: ${session.location}` : '')

        const message =
          `【勉強会のご案内（2週間前）】\n\n` +
          `${session.title}\n` +
          `日時: ${sessionDate}\n` +
          `時間: ${session.session_time || '未定'}${locationInfo}\n\n` +
          `出欠のご回答をお願いいたします。`

        const sent = await pushLineMessage(user.line_user_id, message)
        if (sent) result.sent++
      }
    }

    // 配信済みフラグ更新
    await supabase
      .from('study_sessions')
      .update({ two_week_notify_sent_at: new Date().toISOString() })
      .eq('id', session.id)

    results.push(result)
  }

  return NextResponse.json({
    message: `${sessions.length}件の勉強会に2週間前通知を実行`,
    target_count: sessions.length,
    results,
  })
}

// 動作確認用 GET（cron secret なしでも呼べる、結果は返さない）
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    hint: 'POST with Bearer CRON_SECRET to trigger 2-week notifications',
  })
}
