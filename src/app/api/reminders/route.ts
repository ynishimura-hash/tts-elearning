import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 勉強会リマインダー・催促API
// Cron Job や外部から定期的に呼び出す想定
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // 簡易認証（Cron Secretで保護）
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  // 3日以内の勉強会を取得
  const { data: upcomingSessions } = await supabase
    .from('study_sessions')
    .select('*')
    .gte('session_date', now.toISOString())
    .lte('session_date', threeDaysLater.toISOString())

  if (!upcomingSessions || upcomingSessions.length === 0) {
    return NextResponse.json({ message: 'No upcoming sessions' })
  }

  const results = []

  for (const session of upcomingSessions) {
    // 未回答のユーザーを取得
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, email, full_name, is_online')
      .eq('is_admin', false)
      .eq('is_free_user', false)
      .eq('is_online', session.is_online)

    if (!allUsers) continue

    const { data: responded } = await supabase
      .from('study_session_attendance')
      .select('user_id')
      .eq('session_id', session.id)

    const respondedIds = new Set(responded?.map(r => r.user_id) || [])
    const unresponded = allUsers.filter(u => !respondedIds.has(u.id))

    // 出席回答者にZoom URL送付
    if (session.is_online && session.zoom_url) {
      const { data: attending } = await supabase
        .from('study_session_attendance')
        .select('user_id')
        .eq('session_id', session.id)
        .eq('status', 'attending')

      if (attending) {
        const attendingUserIds = attending.map(a => a.user_id)
        const { data: attendingUsers } = await supabase
          .from('users')
          .select('email, full_name')
          .in('id', attendingUserIds)

        // Zoom URL送付メール
        for (const user of attendingUsers || []) {
          try {
            await fetch(new URL('/api/send-email', request.url).toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: user.email,
                subject: `【TTS】勉強会のご案内（${new Date(session.session_date).toLocaleDateString('ja-JP')}）`,
                html: `
                  <p>${user.full_name} 様</p>
                  <p>まもなく勉強会が開催されます。</p>
                  <p><strong>日時:</strong> ${new Date(session.session_date).toLocaleString('ja-JP')}</p>
                  ${session.zoom_url ? `<p><strong>Zoom URL:</strong> <a href="${session.zoom_url}">${session.zoom_url}</a></p>` : ''}
                  <p>TTS e-ラーニング事務局</p>
                `,
              }),
            })
          } catch (e) {
            console.error('Failed to send reminder to:', user.email)
          }
        }
      }
    }

    // 未回答者に催促メール
    for (const user of unresponded) {
      // 催促カウント更新
      await supabase
        .from('study_session_attendance')
        .upsert({
          session_id: session.id,
          user_id: user.id,
          status: 'pending',
          reminder_count: 1,
          last_reminder_at: now.toISOString(),
        }, { onConflict: 'session_id,user_id' })

      try {
        await fetch(new URL('/api/send-email', request.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: user.email,
            subject: `【TTS】勉強会の出欠をお知らせください（${new Date(session.session_date).toLocaleDateString('ja-JP')}）`,
            html: `
              <p>${user.full_name} 様</p>
              <p>勉強会の出欠がまだ回答されていません。</p>
              <p><strong>日時:</strong> ${new Date(session.session_date).toLocaleString('ja-JP')}</p>
              <p>e-ラーニングシステムにログインして出欠をご回答ください。</p>
              <p>TTS e-ラーニング事務局</p>
            `,
          }),
        })
      } catch (e) {
        console.error('Failed to send reminder to:', user.email)
      }
    }

    results.push({
      session: session.title,
      date: session.session_date,
      unrespondedCount: unresponded.length,
    })
  }

  // リマインド送信済みフラグ更新
  for (const session of upcomingSessions) {
    await supabase
      .from('study_sessions')
      .update({ reminder_sent: true })
      .eq('id', session.id)
  }

  return NextResponse.json({ results })
}
