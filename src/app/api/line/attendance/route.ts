import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

async function sendLineMessage(lineUserId: string, message: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.log(`[LINE未設定] To: ${lineUserId}, Message: ${message}`)
    return false
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: 'text', text: message }],
    }),
  })
  return res.ok
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase()
    const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const { sessionId, type } = await request.json()

    // 勉強会情報取得
    const { data: session } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ success: false, message: '勉強会が見つかりません' })
    }

    // 対象ユーザー取得（オンライン/オフラインで分ける、テストアカウント除外）
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email, line_user_id, is_online, is_test')
      .eq('is_online', session.is_online)
      .eq('is_admin', false)
      .eq('is_test', false)

    if (!users || users.length === 0) {
      return NextResponse.json({ success: false, message: '対象ユーザーがいません' })
    }

    const sessionDate = new Date(session.session_date).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    })

    let targetUsers = users
    let sentCount = 0

    if (type === 'reminder') {
      // 未回答者のみ
      const { data: attendance } = await supabase
        .from('study_session_attendance')
        .select('user_id, status')
        .eq('session_id', sessionId)

      const respondedUserIds = new Set(
        (attendance || [])
          .filter(a => a.status !== 'pending')
          .map(a => a.user_id)
      )
      targetUsers = users.filter(u => !respondedUserIds.has(u.id))

      for (const user of targetUsers) {
        if (user.line_user_id) {
          const message = `【リマインド】${session.title}\n\n${sessionDate}\n${session.session_time || ''}\n\nまだ出欠のご回答をいただいておりません。\nお手数ですがご回答をお願いいたします。`
          const sent = await sendLineMessage(user.line_user_id, message)
          if (sent) sentCount++
        }
      }

      // リマインドカウント更新
      await supabase
        .from('study_session_attendance')
        .update({
          reminder_count: 1,
          last_reminder_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId)
        .eq('status', 'pending')

    } else {
      // 出欠案内（全員に送信）
      for (const user of targetUsers) {
        // 出欠レコードを作成（未回答状態）
        await supabase
          .from('study_session_attendance')
          .upsert({
            session_id: sessionId,
            user_id: user.id,
            status: 'pending',
          }, { onConflict: 'session_id,user_id' })

        if (user.line_user_id) {
          const locationInfo = session.is_online
            ? (session.zoom_url ? `\nZoom: ${session.zoom_url}` : '')
            : (session.location ? `\n場所: ${session.location}` : '')

          const message = `【勉強会のご案内】\n\n${session.title}\n日時: ${sessionDate}\n時間: ${session.session_time || '未定'}${locationInfo}\n\n出欠のご回答をお願いいたします。`
          const sent = await sendLineMessage(user.line_user_id, message)
          if (sent) sentCount++
        }
      }

      // 送信済みフラグ更新
      await supabase
        .from('study_sessions')
        .update({
          attendance_request_sent: true,
          attendance_request_sent_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
    }

    // LINE未設定の場合でも出欠レコードは作成済み
    const lineConfigured = !!LINE_CHANNEL_ACCESS_TOKEN
    const lineUsers = targetUsers.filter(u => u.line_user_id).length

    return NextResponse.json({
      success: true,
      sentCount: lineConfigured ? sentCount : 0,
      totalTargets: targetUsers.length,
      lineUsers,
      message: !lineConfigured
        ? `出欠レコードを${targetUsers.length}人分作成しました（LINE未設定のため通知は送信されていません）`
        : `${sentCount}人にLINE通知を送信しました`,
    })
  } catch (error) {
    console.error('Attendance notification error:', error)
    return NextResponse.json({ success: false, message: '処理中にエラーが発生しました' })
  }
}
