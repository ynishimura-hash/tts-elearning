import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import {
  sendBroadcast,
  textToHtml,
  TTS_SENDER,
  type RecipientVariables,
} from '@/lib/email-broadcast'

interface BroadcastRequestBody {
  subject: string
  bodyText: string
  recipients: RecipientVariables[]
  testEmail?: string
}

async function ensureAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, is_admin')
    .eq('auth_id', user.id)
    .single()
  if (!profile?.is_admin) return null
  return profile.id as string
}

export async function POST(request: NextRequest) {
  const adminUserId = await ensureAdmin()
  if (!adminUserId) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }

  let body: BroadcastRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const { subject, bodyText, recipients, testEmail } = body
  if (!subject || !bodyText) {
    return NextResponse.json(
      { success: false, error: '件名と本文は必須です' },
      { status: 400 }
    )
  }

  // テスト送信モード（自分宛に1通）
  if (testEmail) {
    const result = await sendBroadcast({
      subject: `[テスト] ${subject}`,
      bodyText,
      recipients: [{ email: testEmail, full_name: 'テスト宛先' }],
    })
    return NextResponse.json({ success: true, result, test: true })
  }

  if (!recipients?.length) {
    return NextResponse.json(
      { success: false, error: '宛先がありません' },
      { status: 400 }
    )
  }

  const result = await sendBroadcast({ subject, bodyText, recipients })

  // 履歴保存
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceRoleKey) {
    const admin = createServiceClient(supabaseUrl, serviceRoleKey)
    const variablesUsed = extractVariables(`${subject}\n${bodyText}`)
    await admin.from('email_broadcasts').insert({
      subject,
      body_html: textToHtml(bodyText),
      body_text: bodyText,
      sender_email: TTS_SENDER.email,
      sender_name: TTS_SENDER.name,
      total_recipients: result.total,
      sent_count: result.sent,
      failed_count: result.failed,
      skipped_count: result.skipped,
      errors: result.errors.length ? result.errors : null,
      variables_used: variablesUsed,
      created_by: adminUserId,
    })
  }

  return NextResponse.json({ success: true, result })
}

export async function GET() {
  const adminUserId = await ensureAdmin()
  if (!adminUserId) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: true, data: [] })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await admin
    .from('email_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, data })
}

function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)
  const set = new Set<string>()
  for (const m of matches) set.add(m[1])
  return Array.from(set)
}
