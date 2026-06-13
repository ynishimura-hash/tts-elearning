/**
 * パスワード再設定（公開エンドポイント）
 *
 * ログアウト状態の利用者が「パスワードをお忘れの方」から申請する。
 * 既存の管理画面 set-password と同じく、サーバ側で仮パスワードを生成して
 * Supabase Auth に上書き設定し、実績のあるメール経路（email-broadcast）で本人へ送る。
 *
 * セキュリティ:
 *  - メールアドレスの存在有無を漏らさないため、結果は常に { success: true }（列挙防止）
 *  - 仮パスワードはサーバ生成のみ。クライアントから受け取らない
 *  - Service Role はこのサーバルート内でのみ使用
 *
 * 注意: 第三者が他人のメールで申請すると、その人のパスワードが新しい仮パスワードに
 *       変わる（＝旧パスワードは無効化される）。仮パスワードは本人のメールにしか
 *       届かないため資格情報の漏洩にはならないが、軽微な妨害の余地はある。
 *
 * POST /api/auth/forgot-password
 * Body: { email }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  generateTempPassword,
  sendTransactionalEmail,
  textToHtml,
  getEmailFooterHtml,
} from '@/lib/email-broadcast'

interface ForgotBody {
  email?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // メール存在を漏らさないため、入口の不備でも汎用成功を返す
  const generic = NextResponse.json({ success: true })

  let body: ForgotBody
  try {
    body = await request.json()
  } catch {
    return generic
  }

  const email = body.email?.trim().toLowerCase()
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return generic
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return generic
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  // メールで会員を検索（見つからなくても汎用成功）
  const { data: target } = await admin
    .from('users')
    .select('id, email, full_name, auth_id')
    .ilike('email', email)
    .maybeSingle()
  if (!target) {
    return generic
  }

  const tempPassword = generateTempPassword(10)

  // Auth ユーザーを解決（無ければ作成）してから仮パスワードを設定
  let authId = target.auth_id as string | null
  if (!authId) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = list?.users.find(
      (u) => u.email?.toLowerCase() === target.email.toLowerCase()
    )
    if (existing) {
      authId = existing.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: target.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: target.full_name },
      })
      if (error || !data.user) {
        return generic
      }
      authId = data.user.id
      await admin.from('users').update({ auth_id: authId }).eq('id', target.id)
      // 新規作成時は createUser で仮パスワード設定済み → メール送信へ進む
      await deliverTempPassword(target.email, target.full_name, tempPassword)
      return generic
    }
    await admin.from('users').update({ auth_id: authId }).eq('id', target.id)
  }

  // 既存 Auth ユーザーの仮パスワード上書き
  const { error: updErr } = await admin.auth.admin.updateUserById(authId, {
    password: tempPassword,
  })
  if (updErr) {
    return generic
  }

  await deliverTempPassword(target.email, target.full_name, tempPassword)
  return generic
}

/** 仮パスワードを実績メール経路で本人へ送る */
async function deliverTempPassword(
  email: string,
  fullName: string | null,
  tempPassword: string
): Promise<void> {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://tts-e.vercel.app'}/login`
  const bodyText =
    `${fullName || ''}様\n\n` +
    `パスワード再設定のお申し込みを受け付けました。\n` +
    `新しいパスワードは下記のとおりです。\n\n` +
    `新しいパスワード: ${tempPassword}\n\n` +
    `下記からログインしてください。\n` +
    `${loginUrl}\n\n` +
    `ログイン後、マイページでお好きなパスワードに変更できます。\n` +
    `お心当たりがない場合は、このメールは破棄してください。`

  await sendTransactionalEmail({
    to: email,
    subject: '【TTS e-ラーニング】パスワードを再設定しました',
    html: textToHtml(bodyText) + getEmailFooterHtml(email),
  })
}
