/**
 * まとめ案内を送信する（管理者のみ）。
 * 各受講生に対し、その人が参加可能な「今後の勉強会」を出欠状況付きで1通にまとめてLINE送信する。
 *   - オンライン勉強会 → オンライン会員
 *   - 対面勉強会       → 対面会員 + テスター
 * 参加可能な今後の勉強会が無い人には送らない。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { pushLineMessage } from '@/lib/line-push'
import {
  DEFAULT_DIGEST_INTRO,
  DEFAULT_DIGEST_CLOSING,
  buildDigestMessage,
  type DigestStatus,
  type DigestSessionLine,
} from '@/lib/session-digest'

interface SessionRow {
  id: string
  session_date: string
  session_time: string | null
  is_online: boolean
}
interface UserRow {
  id: string
  full_name: string
  is_online: boolean
  is_tester: boolean
  line_user_id_online: string | null
  line_user_id_offline: string | null
  study_notify_enabled: boolean | null
}

const STATUS_JP: Record<string, DigestStatus> = {
  attending: '出席', absent: '欠席', undecided: '未定', pending: '未回答',
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
}

/** その勉強会の対象者か（オンライン勉強会=オンライン会員 / 対面=対面会員+テスター） */
function isEligible(user: UserRow, sessionIsOnline: boolean): boolean {
  return sessionIsOnline ? user.is_online : (!user.is_online || user.is_tester === true)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authed = await createServerClient()
    const { data: { user } } = await authed.auth.getUser()
    if (!user) return NextResponse.json({ success: false, message: 'ログインが必要です' }, { status: 401 })
    const { data: me } = await authed.from('users').select('is_admin').eq('auth_id', user.id).single()
    if (!me?.is_admin) return NextResponse.json({ success: false, message: '権限がありません' }, { status: 403 })

    const body = (await request.json()) as { intro?: string; closing?: string; userIds?: string[] }
    const intro = (body.intro ?? '').trim() || DEFAULT_DIGEST_INTRO
    const closing = (body.closing ?? '').trim() || DEFAULT_DIGEST_CLOSING

    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 今後の勉強会（開催日が未来）
    const nowIso = new Date().toISOString()
    const { data: sessions } = await svc
      .from('study_sessions')
      .select('id, session_date, session_time, is_online')
      .gt('session_date', nowIso)
      .order('session_date', { ascending: true })
    const futureSessions = (sessions ?? []) as SessionRow[]
    if (futureSessions.length === 0) {
      return NextResponse.json({ success: false, message: '今後の勉強会がありません' })
    }

    // 対象受講生（管理者・テスト・無料・通知オフを除外）
    const { data: allUsers } = await svc
      .from('users')
      .select('id, full_name, is_online, is_tester, line_user_id_online, line_user_id_offline, study_notify_enabled')
      .eq('is_admin', false)
      .eq('is_test', false)
      .eq('is_free_user', false)
      .eq('study_notify_enabled', true)
    let users = (allUsers ?? []) as UserRow[]
    if (Array.isArray(body.userIds) && body.userIds.length > 0) {
      const idSet = new Set(body.userIds)
      users = users.filter((u) => idSet.has(u.id))
    }

    // 今後の勉強会の出欠レコード
    const sessionIds = futureSessions.map((s) => s.id)
    const { data: attendance } = await svc
      .from('study_session_attendance')
      .select('session_id, user_id, status')
      .in('session_id', sessionIds)
    // key: `${sessionId}:${userId}` → status
    const statusMap = new Map<string, string>()
    for (const a of attendance ?? []) statusMap.set(`${a.session_id}:${a.user_id}`, a.status)

    let sentCount = 0
    let targetCount = 0
    for (const u of users) {
      const mySessions = futureSessions.filter((s) => isEligible(u, s.is_online))
      if (mySessions.length === 0) continue // 参加可能な今後の勉強会が無ければ送らない
      targetCount++

      const useOnline = u.is_online || u.is_tester === true
      const lineUserId = useOnline ? u.line_user_id_online : u.line_user_id_offline
      if (!lineUserId) continue

      const lines: DigestSessionLine[] = mySessions.map((s) => ({
        dateLabel: dateLabel(s.session_date),
        time: s.session_time,
        isOnline: s.is_online,
        status: STATUS_JP[statusMap.get(`${s.id}:${u.id}`) ?? 'pending'] ?? '未回答',
      }))
      const attendUrl = `https://tts-e.vercel.app${u.is_online ? '/online/study-sessions' : '/study-sessions'}`
      const message = buildDigestMessage(intro, closing, lines, attendUrl)
      const ok = await pushLineMessage(lineUserId, message, useOnline ? 'online' : 'offline')
      if (ok) sentCount++
    }

    return NextResponse.json({ success: true, sentCount, targetCount })
  } catch (error) {
    console.error('[line/session-digest] failed:', error)
    return NextResponse.json({ success: false, message: '処理中にエラーが発生しました' }, { status: 500 })
  }
}
