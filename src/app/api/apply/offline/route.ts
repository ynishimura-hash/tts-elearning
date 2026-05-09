import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient as createServiceClient } from '@supabase/supabase-js'

interface ApplyBody {
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

const PAYPAL_LINK = 'https://www.paypal.com/ncp/payment/QDXMSCV3MUMCL'
const PAYPAL_GUIDE = 'https://docs.google.com/presentation/d/1S4_1QgiOxZ2ipdm-GCxFJO5BrghyYIP28unS6iXHvjI/edit?usp=sharing'

function buildAutoReplyText(b: ApplyBody): string {
  return `${b.full_name}様

TTS有料会員にお申し込みいただきありがとうございました！
以下のURLより入金をしていただき、事務局が確認でき次第、お申し込みが完了となります。

下記リンクより、TTS 1年目有料会員コンテンツ料のお支払いをお願いします。
${PAYPAL_LINK}

※PayPalでのお支払い方法についてご不明な方は下記URLからご確認ください。
${PAYPAL_GUIDE}

【お申し込み内容】
氏名: ${b.full_name}（${b.furigana}）
メールアドレス: ${b.email}
電話番号: ${b.phone}
生年月日: ${b.birthdate}
郵便番号: ${b.postal_code}
現住所: ${b.address}
受講のきっかけ: ${b.referral_source}${b.referral_detail ? `（${b.referral_detail}）` : ''}

ご入金が確認でき次第、3営業日以内にe-ラーニングのアカウント発行をさせていただきます。

一緒に永続的に勝ち続けるトレーダーを目指して頑張りましょう！

TTS運営事務局`
}

const SUBJECT = '【入金手続き依頼】TTS有料会員にお申し込みいただきありがとうございました！'
const ADMIN_NOTIFY_TO = process.env.PEAK_BOTTOM_NOTIFY_TO || 'kudo@creatte.jp'

async function sendAutoReply(b: ApplyBody): Promise<boolean> {
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
      text: buildAutoReplyText(b),
    })
    return true
  } catch (err) {
    console.error('apply-offline auto-reply failed:', err)
    return false
  }
}

export async function POST(request: NextRequest) {
  let body: ApplyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const required: (keyof ApplyBody)[] = ['full_name', 'furigana', 'email', 'phone', 'birthdate', 'postal_code', 'address', 'referral_source']
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

  const { data, error } = await admin.from('applications').insert({
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
    status: 'approved',
    payment_status: 'unpaid',
    auto_reply_sent: false,
  }).select('id').single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const sent = await sendAutoReply(body)
  if (sent) {
    await admin.from('applications').update({ auto_reply_sent: true }).eq('id', data.id)
  }

  return NextResponse.json({ success: true, id: data.id, auto_reply_sent: sent })
}
