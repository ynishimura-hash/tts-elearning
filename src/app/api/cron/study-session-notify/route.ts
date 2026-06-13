/**
 * 勉強会 段階通知エンジン（Vercel Cron で 1日1回）
 *
 * 各勉強会の開催日を基準に、未送信の段階を自動送信する:
 *   - 1ヶ月前 / 2週間前 → 未回答者へ「催促」
 *   - 1週間前 / 1日前   → 出席者へ「リマインド」（オンライン=Zoom / 対面=場所）
 *
 * 作成が段階より直前の場合（stageDate < created_at）はその段階をスキップ。
 * cron が1日落ちても stageDate を過ぎていれば追いつく（送信済みフラグで二重送信は防止）。
 * 送信は1件ずつ study_session_notifications に記録（履歴）。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushLineMessage } from '@/lib/line-push'
import type { LineChannel } from '@/types/database'

interface SessionRow {
  id: string
  title: string
  session_date: string
  session_time: string | null
  location: string | null
  zoom_url: string | null
  is_online: boolean
  created_at: string
  notify_1month_at: string | null
  two_week_notify_sent_at: string | null
  remind_1week_at: string | null
  remind_1day_at: string | null
  notify_skip: string[] | null
}

interface MemberRow {
  id: string
  full_name: string
  line_user_id_online: string | null
  line_user_id_offline: string | null
  is_online: boolean
  is_tester: boolean
}

const DAY = 24 * 60 * 60 * 1000

type StageType = 'unanswered' | 'attendees'
interface StageDef {
  flag: 'notify_1month_at' | 'two_week_notify_sent_at' | 'remind_1week_at' | 'remind_1day_at'
  offsetDays: number
  type: StageType
  stage: string
  label: string
}

const STAGES: StageDef[] = [
  { flag: 'notify_1month_at', offsetDays: 30, type: 'unanswered', stage: 'remind_1month', label: '1ヶ月前催促' },
  { flag: 'two_week_notify_sent_at', offsetDays: 14, type: 'unanswered', stage: 'remind_2week', label: '2週間前催促' },
  { flag: 'remind_1week_at', offsetDays: 7, type: 'attendees', stage: 'attend_1week', label: '1週間前リマインド' },
  { flag: 'remind_1day_at', offsetDays: 1, type: 'attendees', stage: 'attend_1day', label: '1日前リマインド' },
]

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function resolveRecipient(u: MemberRow, sessionIsOnline: boolean): { lineUserId: string | null; channel: LineChannel } {
  const useOnline = sessionIsOnline || u.is_tester === true
  return {
    lineUserId: useOnline ? u.line_user_id_online : u.line_user_id_offline,
    channel: useOnline ? 'online' : 'offline',
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
}

function locationInfo(session: SessionRow): string {
  return session.is_online
    ? session.zoom_url ? `\nZoom: ${session.zoom_url}` : ''
    : session.location ? `\n場所: ${session.location}` : ''
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date()

  const { data: sessions, error } = await supabase
    .from('study_sessions')
    .select('id, title, session_date, session_time, location, zoom_url, is_online, created_at, notify_1month_at, two_week_notify_sent_at, remind_1week_at, remind_1day_at, notify_skip')
    .gt('session_date', now.toISOString())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { session: string; stage: string; sent: number; targets: number }[] = []

  for (const session of (sessions || []) as SessionRow[]) {
    const sessionDate = new Date(session.session_date)
    const createdAt = new Date(session.created_at)

    for (const st of STAGES) {
      if (session[st.flag]) continue // 送信済み
      if (session.notify_skip?.includes(st.flag)) continue // スキップ指定
      const stageDate = new Date(sessionDate.getTime() - st.offsetDays * DAY)
      // 段階の時刻が到来済み / 開催前 / 作成時点で既に過去でない
      if (!(now >= stageDate && now < sessionDate && stageDate >= createdAt)) continue

      const res =
        st.type === 'unanswered'
          ? await runUnanswered(supabase, session, st)
          : await runAttendees(supabase, session, st)

      await supabase.from('study_sessions').update({ [st.flag]: new Date().toISOString() }).eq('id', session.id)
      results.push({ session: session.title, stage: st.label, sent: res.sent, targets: res.targets })
    }
  }

  return NextResponse.json({ ok: true, executed: results })
}

/** 未回答者への催促（1ヶ月前 / 2週間前） */
async function runUnanswered(
  supabase: ReturnType<typeof getSupabase>,
  session: SessionRow,
  st: StageDef
): Promise<{ sent: number; targets: number }> {
  const base = supabase
    .from('users')
    .select('id, full_name, line_user_id_online, line_user_id_offline, is_online, is_tester')
    .eq('is_admin', false)
    .eq('is_test', false)
    .eq('study_notify_enabled', true)
  const { data: eligible } = session.is_online
    ? await base.eq('is_online', true)
    : await base.or('is_online.eq.false,is_tester.eq.true')

  const { data: att } = await supabase
    .from('study_session_attendance')
    .select('user_id, status')
    .eq('session_id', session.id)
  const respondedIds = new Set(
    (att || []).filter((a) => a.status === 'attending' || a.status === 'absent' || a.status === 'undecided').map((a) => a.user_id)
  )
  const targets = ((eligible || []) as MemberRow[]).filter((u) => !respondedIds.has(u.id))

  const dateStr = formatDate(session.session_date)
  const loc = locationInfo(session)
  let sent = 0
  for (const u of targets) {
    await supabase
      .from('study_session_attendance')
      .upsert({ session_id: session.id, user_id: u.id, status: 'pending' }, { onConflict: 'session_id,user_id' })

    const { lineUserId, channel } = resolveRecipient(u, session.is_online)
    let ok = false
    if (lineUserId) {
      const attendUrl = `https://tts-e.vercel.app${u.is_online ? '/online/study-sessions' : '/study-sessions'}`
      const msg =
        `【勉強会の出欠 ご回答のお願い】\n\n` +
        `${session.title}\n日時: ${dateStr}\n時間: ${session.session_time || '未定'}${loc}\n\n` +
        `まだ出欠のご回答をいただいておりません。お手数ですがご回答をお願いいたします。\n\n` +
        `▼ 出欠の回答はこちら\n${attendUrl}`
      ok = await pushLineMessage(lineUserId, msg, channel)
      if (ok) sent++
    }
    await supabase
      .from('study_session_notifications')
      .insert({ session_id: session.id, stage: st.stage, channel, user_id: u.id, full_name: u.full_name, success: ok })
    if (ok) {
      await supabase
        .from('study_session_attendance')
        .update({ last_reminder_at: new Date().toISOString() })
        .eq('session_id', session.id)
        .eq('user_id', u.id)
    }
  }
  return { sent, targets: targets.length }
}

/** 出席者へのリマインド（1週間前 / 1日前・Zoom/場所付き） */
async function runAttendees(
  supabase: ReturnType<typeof getSupabase>,
  session: SessionRow,
  st: StageDef
): Promise<{ sent: number; targets: number }> {
  const { data: att } = await supabase
    .from('study_session_attendance')
    .select('user_id')
    .eq('session_id', session.id)
    .eq('status', 'attending')
  const ids = (att || []).map((a) => a.user_id)
  if (ids.length === 0) return { sent: 0, targets: 0 }

  const { data: attendees } = await supabase
    .from('users')
    .select('id, full_name, line_user_id_online, line_user_id_offline, is_online, is_tester')
    .in('id', ids)

  const dateStr = formatDate(session.session_date)
  const loc = locationInfo(session)
  const nuance = st.offsetDays >= 7 ? 'いよいよ来週、勉強会です。' : '明日はいよいよ勉強会です。'
  let sent = 0
  for (const u of (attendees || []) as MemberRow[]) {
    const { lineUserId, channel } = resolveRecipient(u, session.is_online)
    let ok = false
    if (lineUserId) {
      const msg =
        `【勉強会リマインド】\n\n` +
        `${session.title}\n日時: ${dateStr}\n時間: ${session.session_time || '未定'}${loc}\n\n` +
        `${nuance}当日お待ちしております。`
      ok = await pushLineMessage(lineUserId, msg, channel)
      if (ok) sent++
    }
    await supabase
      .from('study_session_notifications')
      .insert({ session_id: session.id, stage: st.stage, channel, user_id: u.id, full_name: u.full_name, success: ok })
  }
  return { sent, targets: ids.length }
}

// 動作確認用 GET
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, hint: 'POST with Bearer CRON_SECRET. Stages: 1month/2week=unanswered, 1week/1day=attendees' })
}
