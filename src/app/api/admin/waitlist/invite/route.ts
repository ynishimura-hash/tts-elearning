import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { randomUUID } from 'node:crypto'

const INVITE_VALIDITY_DAYS = 14

async function ensureAdmin(): Promise<boolean> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('auth_id', user.id)
    .single()
  return !!profile?.is_admin
}

interface WaitlistRow {
  id: string
  full_name: string
  email: string
  course_type: 'online' | 'offline'
  status: string
}

function buildInviteEmail(name: string, courseType: 'online' | 'offline', url: string, expiresAt: Date): string {
  const expiry = expiresAt.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  const courseLabel = courseType === 'online' ? 'TTSオンライン有料会員' : 'TTS有料会員（対面受講）'
  const officeName = courseType === 'online' ? 'TTSオンライン運営事務局' : 'TTS運営事務局'

  return `${name}様

お待たせいたしました。
${courseLabel}のお申し込み受付を再開いたしました。

下記のURLより、お申し込み手続きをお願いいたします。
ご入力いただいた内容をフォームに反映していますので、内容をご確認のうえお手続きください。

${url}

※このリンクは ${expiry} まで有効です。
※期限を過ぎますとリンクが無効になります。お早めにお手続きください。

ご不明な点がございましたら、事務局までお問い合わせください。

${officeName}`
}

async function sendInviteEmail(
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return false
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    })
    await transporter.sendMail({
      from: `"TTS運営事務局" <${user}>`,
      to,
      bcc: process.env.PEAK_BOTTOM_NOTIFY_TO || 'kudo@creatte.jp',
      subject,
      text,
    })
    return true
  } catch (err) {
    console.error('waitlist invite email failed:', err)
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }

  let body: { ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ success: false, error: '招待対象が指定されていません' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: 'サーバー設定エラー' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  const { data: rows, error: fetchErr } = await admin
    .from('waitlist_applications')
    .select('id, full_name, email, course_type, status')
    .in('id', ids)

  if (fetchErr) {
    return NextResponse.json({ success: false, error: fetchErr.message }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  const now = new Date()
  const expiresAt = new Date(now.getTime() + INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000)

  const results: { id: string; email: string; sent: boolean; error?: string }[] = []

  for (const row of (rows || []) as WaitlistRow[]) {
    if (row.status === 'converted') {
      results.push({ id: row.id, email: row.email, sent: false, error: '既に正式申込済みです' })
      continue
    }
    if (row.status === 'cancelled') {
      results.push({ id: row.id, email: row.email, sent: false, error: '無効化されています' })
      continue
    }

    const inviteToken = randomUUID()
    const path = row.course_type === 'online' ? '/apply/online' : '/apply/offline'
    const url = `${origin}${path}?waitlist=${inviteToken}`

    const { error: updateErr } = await admin
      .from('waitlist_applications')
      .update({
        invite_token: inviteToken,
        invite_sent_at: now.toISOString(),
        invite_expires_at: expiresAt.toISOString(),
        status: 'invited',
      })
      .eq('id', row.id)

    if (updateErr) {
      results.push({ id: row.id, email: row.email, sent: false, error: updateErr.message })
      continue
    }

    const subject = `【お申し込み受付再開】${row.course_type === 'online' ? 'TTSオンライン有料会員' : 'TTS有料会員（対面受講）'} お手続きのご案内`
    const text = buildInviteEmail(row.full_name, row.course_type, url, expiresAt)
    const sent = await sendInviteEmail(row.email, subject, text)
    results.push({ id: row.id, email: row.email, sent })
  }

  return NextResponse.json({
    success: true,
    total: results.length,
    sent: results.filter(r => r.sent).length,
    results,
  })
}
