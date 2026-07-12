/**
 * 進捗報告 自動催促（Vercel Cron で 1日1回）
 *
 * 対象＝テスター。各自の「最終報告からの経過」で判定し、14日以上（未報告なら
 * アカウント発行から14日以上）経過し、かつ今周期にまだ催促していない人へLINE催促。
 * progress_reminded_at に送信時刻を記録し、日次cronでの重複送信を防ぐ。
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushLineMessage } from '@/lib/line-push'
import {
  PROGRESS_INTERVAL_DAYS,
  buildProgressInviteMessage,
  progressRecipientChannel,
} from '@/lib/progress-report'

interface TargetRow {
  id: string
  full_name: string
  is_online: boolean
  is_tester: boolean
  line_user_id_online: string | null
  line_user_id_offline: string | null
  account_issued_at: string | null
  progress_reminded_at: string | null
  study_notify_enabled: boolean | null
}

const DAY = 24 * 60 * 60 * 1000

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = Date.now()
  const intervalMs = PROGRESS_INTERVAL_DAYS * DAY

  const { data: targets, error } = await supabase
    .from('users')
    .select('id, full_name, is_online, is_tester, line_user_id_online, line_user_id_offline, account_issued_at, progress_reminded_at, study_notify_enabled')
    .eq('is_admin', false)
    .eq('is_test', false)
    .eq('is_tester', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { name: string; sent: boolean; reason?: string }[] = []

  for (const u of (targets ?? []) as TargetRow[]) {
    if (u.study_notify_enabled === false) continue

    // 最終報告日時（無ければ null）
    const { data: last } = await supabase
      .from('progress_reports')
      .select('reported_at')
      .eq('user_id', u.id)
      .order('reported_at', { ascending: false })
      .limit(1)
    const lastReportAt = last?.[0]?.reported_at ? new Date(last[0].reported_at).getTime() : null

    // 起点：最終報告 or 未報告ならアカウント発行日（無ければ now＝当面催促しない）
    const anchor = lastReportAt ?? (u.account_issued_at ? new Date(u.account_issued_at).getTime() : now)
    const due = now - anchor >= intervalMs
    // 今周期に既に催促済みなら送らない（14日以内に催促していればスキップ）
    const remindedRecently =
      !!u.progress_reminded_at && now - new Date(u.progress_reminded_at).getTime() < intervalMs
    if (!due || remindedRecently) continue

    const channel = progressRecipientChannel(u.is_online, u.is_tester)
    const lineUserId = channel === 'online' ? u.line_user_id_online : u.line_user_id_offline
    let sent = false
    if (lineUserId) {
      sent = await pushLineMessage(lineUserId, buildProgressInviteMessage(u.is_online), channel)
    }
    if (sent) {
      await supabase.from('users').update({ progress_reminded_at: new Date().toISOString() }).eq('id', u.id)
    }
    results.push({ name: u.full_name, sent, reason: lineUserId ? undefined : 'LINE未連携' })
  }

  return NextResponse.json({ ok: true, executed: results })
}

// 動作確認用 GET
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    hint: `POST with Bearer CRON_SECRET. Reminds testers ${PROGRESS_INTERVAL_DAYS}d since last progress report.`,
  })
}
