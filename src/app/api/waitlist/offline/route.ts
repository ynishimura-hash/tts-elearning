import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { pushLineMessage } from '@/lib/line-push'

interface WaitlistBody {
  full_name: string
  furigana: string
  email: string
  phone: string
  birthdate: string
  postal_code: string
  address: string
  referral_source: string
  referral_detail?: string
}

function buildConfirmationText(b: WaitlistBody): string {
  return `${b.full_name}様

このたびはTTS有料会員（対面受講）へのお申し込みをご検討いただきありがとうございます。

現在、お申し込みの受付を一時停止しております。
ご記入いただいた内容で「空き待ち」としてお預かりいたしました。

受付再開の際には、改めて事務局よりご案内のメールをお送りいたします。
そのメールに記載のURLから、入力済みの内容をご確認のうえ、
正式なお申し込みお手続きにお進みいただけます。

【ご登録内容】
氏名: ${b.full_name}（${b.furigana}）
メールアドレス: ${b.email}
電話番号: ${b.phone}
生年月日: ${b.birthdate}
郵便番号: ${b.postal_code}
現住所: ${b.address}
受講のきっかけ: ${b.referral_source}${b.referral_detail ? `（${b.referral_detail}）` : ''}

ご登録内容に変更がある場合や、お問い合わせは事務局までご連絡ください。
今しばらくお待ちくださいますよう、お願い申し上げます。

TTS運営事務局`
}

const SUBJECT = '【空き待ち受付】TTS有料会員（対面受講）お申し込みについて'
const ADMIN_NOTIFY_TO = process.env.PEAK_BOTTOM_NOTIFY_TO || 'kudo@creatte.jp'

async function sendConfirmation(b: WaitlistBody): Promise<boolean> {
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
      to: b.email,
      bcc: ADMIN_NOTIFY_TO,
      subject: SUBJECT,
      text: buildConfirmationText(b),
    })
    return true
  } catch (err) {
    console.error('waitlist-offline confirmation failed:', err)
    return false
  }
}

export async function POST(request: NextRequest) {
  let body: WaitlistBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const required: (keyof WaitlistBody)[] = ['full_name', 'furigana', 'email', 'phone', 'birthdate', 'postal_code', 'address', 'referral_source']
  for (const key of required) {
    if (!body[key]?.toString().trim()) {
      return NextResponse.json({ success: false, error: `${key} は必須項目です` }, { status: 400 })
    }
  }
  if (!body.email.includes('@')) {
    return NextResponse.json({ success: false, error: 'メールアドレスが不正です' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: 'サーバー設定エラー' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  const { data: settings } = await admin
    .from('application_settings')
    .select('offline_paused')
    .eq('id', true)
    .maybeSingle()

  if (!settings?.offline_paused) {
    return NextResponse.json(
      { success: false, error: '現在は通常の申し込みを受け付けております。申込フォームをご利用ください。' },
      { status: 400 }
    )
  }

  const { data, error } = await admin.from('waitlist_applications').insert({
    full_name: body.full_name.trim(),
    furigana: body.furigana.trim(),
    email: body.email.trim().toLowerCase(),
    phone: body.phone.trim(),
    birthdate: body.birthdate,
    postal_code: body.postal_code.trim(),
    address: body.address.trim(),
    referral_source: body.referral_source,
    referral_detail: body.referral_detail?.trim() || null,
    course_type: 'offline',
    status: 'waiting',
  }).select('id').single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const sent = await sendConfirmation(body)

  let adminGroupNotified = false
  try {
    const { data: adminGroup } = await admin
      .from('line_groups')
      .select('group_id')
      .eq('is_peak_bottom_target', true)
      .limit(1)
      .maybeSingle()

    if (adminGroup?.group_id) {
      const referralLine = body.referral_detail
        ? `${body.referral_source}（${body.referral_detail}）`
        : body.referral_source
      const groupMessage =
        `⏳ 空き待ち申し込みがありました！（対面）\n\n` +
        `氏名: ${body.full_name.trim()}（${body.furigana.trim()}）\n` +
        `メール: ${body.email.trim().toLowerCase()}\n` +
        `電話: ${body.phone.trim()}\n` +
        `生年月日: ${body.birthdate}\n` +
        `住所: 〒${body.postal_code.trim()} ${body.address.trim()}\n` +
        `きっかけ: ${referralLine}\n\n` +
        `空き待ちID: ${data.id}\n` +
        `※受付再開時、管理画面から招待を送信してください。`
      adminGroupNotified = await pushLineMessage(adminGroup.group_id, groupMessage)
    }
  } catch (err) {
    console.error('admin group notify failed:', err)
  }

  return NextResponse.json({
    success: true,
    id: data.id,
    confirmation_sent: sent,
    admin_group_notified: adminGroupNotified,
  })
}
