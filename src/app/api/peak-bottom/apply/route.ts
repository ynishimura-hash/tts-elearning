import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface ApplyBody {
  tradingview_username: string
}

interface NotifyArgs {
  fullName: string
  email: string
  tradingviewUsername: string
  isUpdate: boolean
}

/**
 * GAS 連携用に Gmail SMTP 経由で通知メールを送信
 * 件名に「【TTS申請通知】」を含めることで GAS 側で振り分け可能
 */
async function notifyByEmail({ fullName, email, tradingviewUsername, isUpdate }: NotifyArgs): Promise<void> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return

  // Gmailの重複スレッド集約を防ぐため件名にタイムスタンプを混ぜる
  const stamp = new Date().toLocaleString('ja-JP', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  const subject = `【TTS申請通知】反対線ピークボトムツール${isUpdate ? '（再申請）' : ''} - ${fullName} (${stamp})`
  const text =
    `反対線ピークボトムツールの${isUpdate ? '再' : ''}利用申請がありました。\n\n` +
    `氏名: ${fullName}\n` +
    `メール: ${email}\n` +
    `TradingViewアカウント: ${tradingviewUsername}\n\n` +
    `管理画面で確認:\n` +
    `https://tts-e.vercel.app/admin/peak-bottom\n\n` +
    `――――――――\n` +
    `TTS e-ラーニング システム`

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    })
    await transporter.sendMail({
      from: `"TTS システム通知" <${user}>`,
      to: user, // 自分宛に送信（GAS が同じ受信箱を読む）
      subject,
      text,
    })
  } catch (err) {
    // 通知失敗しても申請自体は成功させる
    console.error('peak-bottom notify email failed:', err)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('auth_id', authUser.id)
    .single()
  if (!profile) {
    return NextResponse.json({ success: false, error: 'ユーザー情報が見つかりません' }, { status: 404 })
  }

  let body: ApplyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const username = body.tradingview_username?.trim()
  if (!username) {
    return NextResponse.json(
      { success: false, error: 'TradingView アカウント名を入力してください' },
      { status: 400 }
    )
  }
  if (username.length > 100) {
    return NextResponse.json(
      { success: false, error: 'アカウント名が長すぎます' },
      { status: 400 }
    )
  }

  // 既存の pending 申請があれば上書き、無ければ新規作成
  const { data: existing } = await supabase
    .from('peak_bottom_applications')
    .select('id')
    .eq('user_id', profile.id)
    .eq('status', 'pending')
    .maybeSingle()

  const isUpdate = !!existing
  if (existing) {
    // RLS 経由で更新 → 0 行で完了することを防ぐため select で確認
    const { data: updated, error } = await supabase
      .from('peak_bottom_applications')
      .update({
        tradingview_username: username,
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id')
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { success: false, error: '更新に失敗しました（権限不足の可能性）' },
        { status: 500 }
      )
    }
  } else {
    const { error } = await supabase.from('peak_bottom_applications').insert({
      user_id: profile.id,
      tradingview_username: username,
      status: 'pending',
    })
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
  }

  // GAS 連携用通知メール送信（失敗しても申請成功扱い）
  await notifyByEmail({
    fullName: profile.full_name,
    email: profile.email,
    tradingviewUsername: username,
    isUpdate,
  })

  return NextResponse.json({ success: true, action: isUpdate ? 'updated' : 'created' })
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', authUser.id)
    .single()
  if (!profile) {
    return NextResponse.json({ success: false, error: 'ユーザー情報が見つかりません' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('peak_bottom_applications')
    .select('id, tradingview_username, status, applied_at, completed_at')
    .eq('user_id', profile.id)
    .order('applied_at', { ascending: false })
    .limit(1)
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, application: data?.[0] || null })
}
