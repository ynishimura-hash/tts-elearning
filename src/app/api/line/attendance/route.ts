/**
 * 管理画面から手動で勉強会の出欠案内・リマインドを送信するエンドポイント
 *
 * チャネル別送信:
 *   - オンライン勉強会 → 全員 オンライン公式LINE から
 *   - 対面勉強会:
 *     - テスター      → オンライン公式LINE から
 *     - オフライン会員 → オフライン公式LINE から
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushLineMessage } from '@/lib/line-push'

interface UserRow {
  id: string
  full_name: string
  email: string
  line_user_id_online: string | null
  line_user_id_offline: string | null
  is_online: boolean
  is_tester: boolean
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** session の is_online と user の is_tester から、送信に使うチャネルと line_user_id を決める */
function resolveRecipient(
  user: UserRow,
  sessionIsOnline: boolean
): { lineUserId: string | null; channel: 'online' | 'offline' } {
  const useOnline = sessionIsOnline || user.is_tester === true
  return {
    lineUserId: useOnline ? user.line_user_id_online : user.line_user_id_offline,
    channel: useOnline ? 'online' : 'offline',
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getSupabase()
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

    // 対象ユーザー取得
    // - オンライン勉強会: is_online=true
    // - 対面勉強会: is_online=false または is_tester=true（テスター含む）
    const usersQuery = supabase
      .from('users')
      .select('id, full_name, email, line_user_id_online, line_user_id_offline, is_online, is_tester')
      .eq('is_admin', false)
      .eq('is_test', false)
      .eq('study_notify_enabled', true) // 通知オフの会員は対象外

    const { data: users } = session.is_online
      ? await usersQuery.eq('is_online', true)
      : await usersQuery.or('is_online.eq.false,is_tester.eq.true')

    if (!users || users.length === 0) {
      return NextResponse.json({ success: false, message: '対象ユーザーがいません' })
    }

    const sessionDate = new Date(session.session_date).toLocaleDateString('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    })

    let targetUsers: UserRow[] = users as UserRow[]
    let sentCount = 0

    if (type === 'reminder') {
      // 未回答者のみ
      const { data: attendance } = await supabase
        .from('study_session_attendance')
        .select('user_id, status')
        .eq('session_id', sessionId)

      const respondedUserIds = new Set(
        (attendance || [])
          .filter((a) => a.status !== 'pending')
          .map((a) => a.user_id)
      )
      targetUsers = targetUsers.filter((u) => !respondedUserIds.has(u.id))

      for (const user of targetUsers) {
        const { lineUserId, channel } = resolveRecipient(user, session.is_online)
        let sent = false
        if (lineUserId) {
          const attendUrl = `https://tts-e.vercel.app${user.is_online ? '/online/study-sessions' : '/study-sessions'}`
          const message = `【リマインド】${session.title}\n\n${sessionDate}\n${session.session_time || ''}\n\nまだ出欠のご回答をいただいておりません。\nお手数ですがご回答をお願いいたします。\n\n▼ 出欠の回答はこちら\n${attendUrl}`
          sent = await pushLineMessage(lineUserId, message, channel)
          if (sent) sentCount++
        }
        await supabase.from('study_session_notifications').insert({
          session_id: sessionId, stage: 'manual_reminder', channel, user_id: user.id, full_name: user.full_name, success: sent,
        })
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

        const { lineUserId, channel } = resolveRecipient(user, session.is_online)
        let sent = false
        if (lineUserId) {
          // オンラインのZoom URLは未回答者に渡さない（出席者リマインドでのみ共有）
          const locationInfo = session.is_online
            ? ''
            : (session.location ? `\n場所: ${session.location}` : '')

          const attendUrl = `https://tts-e.vercel.app${user.is_online ? '/online/study-sessions' : '/study-sessions'}`
          const message = `【勉強会のご案内】\n\n${session.title}\n日時: ${sessionDate}\n時間: ${session.session_time || '未定'}${locationInfo}\n\n出欠のご回答をお願いいたします。\n\n▼ 出欠の回答はこちら\n${attendUrl}`
          sent = await pushLineMessage(lineUserId, message, channel)
          if (sent) sentCount++
        }
        await supabase.from('study_session_notifications').insert({
          session_id: sessionId, stage: 'invite_manual', channel, user_id: user.id, full_name: user.full_name, success: sent,
        })
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

    // LINE 連携済みユーザー数（送信先チャネルに line_user_id があるユーザー）
    const lineUsers = targetUsers.filter((u) => {
      const { lineUserId } = resolveRecipient(u, session.is_online)
      return !!lineUserId
    }).length

    const tokenConfigured =
      !!process.env.LINE_CHANNEL_ACCESS_TOKEN_ONLINE ||
      !!process.env.LINE_CHANNEL_ACCESS_TOKEN ||
      !!process.env.LINE_CHANNEL_ACCESS_TOKEN_OFFLINE

    return NextResponse.json({
      success: true,
      sentCount: tokenConfigured ? sentCount : 0,
      totalTargets: targetUsers.length,
      lineUsers,
      message: !tokenConfigured
        ? `出欠レコードを${targetUsers.length}人分作成しました（LINE未設定のため通知は送信されていません）`
        : `${sentCount}人にLINE通知を送信しました`,
    })
  } catch (error) {
    console.error('Attendance notification error:', error)
    return NextResponse.json({ success: false, message: '処理中にエラーが発生しました' })
  }
}
