import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import { pushLineMessage } from '@/lib/line-push'

type AdminClient = SupabaseClient

interface PaypalNotifyBody {
  token: string
  customer_email: string
  customer_name?: string
  subscription_id?: string
  transaction_id: string
  amount?: number
  currency?: string
  raw_payload?: unknown
}

const PW_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
function generatePassword(length = 12): string {
  let out = ''
  for (let i = 0; i < length; i++) out += PW_CHARS[randomInt(PW_CHARS.length)]
  return out
}

async function nextOnlineCustomerId(admin: AdminClient): Promise<string> {
  const { data } = await admin
    .from('users')
    .select('customer_id')
    .eq('is_online', true)
    .not('customer_id', 'is', null)
  let max = 0
  for (const r of data || []) {
    const id = String(r.customer_id || '')
    if (/^\d{1,4}$/.test(id)) {
      const n = parseInt(id, 10)
      if (n > max) max = n
    }
  }
  return String(max + 1).padStart(4, '0')
}

interface DriveResult {
  ok: boolean
  folderUrl?: string
  error?: string
}

async function duplicateDriveFolder(studentName: string, customerId: string): Promise<DriveResult> {
  const url = process.env.GAS_DRIVE_WEBAPP_URL
  const token = process.env.GAS_DRIVE_TOKEN
  if (!url) return { ok: false, error: 'GAS_DRIVE_WEBAPP_URL 未設定' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName, customerId, token }),
      redirect: 'follow',
    })
    const text = await res.text()
    let data: { folderUrl?: string; error?: string }
    try { data = JSON.parse(text) }
    catch { return { ok: false, error: 'GAS応答が不正: ' + text.slice(0, 200) } }
    if (data.folderUrl) return { ok: true, folderUrl: data.folderUrl }
    return { ok: false, error: data.error || 'GAS応答が不正' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function sendWelcomeEmail(args: {
  fullName: string
  email: string
  password: string
  driveFolderUrl: string | null
  joinedAt: string
}): Promise<boolean> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return false

  const text = `${args.fullName}様


TTSオンライン（トレーダー養成訓練学校オンライン）の有料会員に申し込みいただきありがとうございます！
これから一緒に、永続的に勝ち続けるマイルール作りを行い、勝ち続けることができるトレーダーになっていきましょうね！


今後のステップについてご説明させていただきます。


① e-ラーニングのログイン情報について

以下のURLよりe-ラーニングシステムにアクセスし、アカウント情報を入力し、ログインをしましょう。
マイページよりパスワードは変更することが可能です。

＜e-ラーニングログインURL＞
https://tts-e.vercel.app/login

＜アカウント情報＞
アカウント名：
${args.email}

パスワード：
${args.password}

有料会員の有効期限についてですが、
${args.joinedAt}からとなっており、毎月の自動更新となっております。


② 会員用のLINE公式アカウントについて

今後のやりとりが円滑にできるようにするために、会員用のLINE公式アカウントを準備しておりますので、下記URLよりご登録をお願いいたします。

LINE公式アカウント：
https://lin.ee/QaffxXm


③ 売買記録表・プログラムツールについて
${args.driveFolderUrl ? `
売買記録表は以下のフォルダに用意しておりますので、ご活用ください。
${args.driveFolderUrl}
` : ''}
基礎知識編が終了し、検証訓練編を進める際に必要な売買記録表や王道ルールなどはe-ラーニングシステムからもダウンロード可能です。

また、TradingViewのピークボトムのプログラムツールなどは、e-ラーニングシステムの「検証ツール」ページから申請可能です。


④ 質問会について

TTSオンラインでは、カリキュラムでの不明点をe-ラーニングシステムの「質問受付」からフォーム入力にて受け付けており、その内容をもとに随時Zoomでの質問会を実施しています。
Zoom URLは日程が確定次第、有料会員ページ（e-ラーニング）のTOPページからアクセスいただけます。
TTSオンラインではインプットだけでなく、アウトプットやフィードバックも重要だと考えていますので、できる限り参加していただけたら幸いです。


それでは勝ち続けることができるトレーダーを目指して、一緒に頑張りましょう！
最初は分からないことばかりで大変だと思いますが、何度も動画を見返して、一歩ずつ進んでいきましょう！


TTSオンライン運営事務局`

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user, pass },
    })
    await transporter.sendMail({
      from: `"TTSオンライン運営事務局" <${user}>`,
      to: args.email,
      bcc: process.env.PEAK_BOTTOM_NOTIFY_TO || 'kudo@creatte.jp',
      subject: '【重要】有料会員アカウント発行のお知らせ【TTSオンライン運営事務局】',
      text,
    })
    return true
  } catch (err) {
    console.error('welcome email failed:', err)
    return false
  }
}

export async function POST(request: NextRequest) {
  // 認証
  const expectedToken = process.env.PAYPAL_NOTIFY_TOKEN
  if (!expectedToken) {
    return NextResponse.json({ error: 'PAYPAL_NOTIFY_TOKEN 未設定' }, { status: 500 })
  }

  let body: PaypalNotifyBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  if (body.token !== expectedToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'env not set' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  const payerEmail = body.customer_email?.trim().toLowerCase()
  const subscriptionId = body.subscription_id?.trim() || null
  const transactionId = body.transaction_id?.trim()

  if (!payerEmail || !transactionId) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  // 重複検知（同じ取引IDを2回処理しない）
  const { data: existing } = await admin
    .from('paypal_payments')
    .select('id, is_initial, user_id')
    .eq('transaction_id', transactionId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({
      status: existing.is_initial ? 'duplicate_initial' : 'duplicate_recurring',
      message: '同じ取引IDを処理済み',
    })
  }

  // 入金待ちの申込を email で検索（これだけが処理対象）
  const { data: app } = await admin
    .from('applications')
    .select('*')
    .eq('email', payerEmail)
    .eq('payment_status', 'unpaid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!app) {
    // 該当なし = 月額継続課金 or 既存ユーザー
    // paypal_payments には保存せず、users.last_payment_* のみ更新
    const { data: matchedUser } = await admin
      .from('users')
      .select('id, full_name, paypal_subscription_id')
      .eq('email', payerEmail)
      .maybeSingle()

    if (!matchedUser) {
      return NextResponse.json({
        status: 'no_action',
        message: '該当ユーザーなし',
        user_id: null,
      })
    }

    const updates: Record<string, unknown> = {
      last_payment_at: new Date().toISOString(),
      last_payment_amount: body.amount || null,
      last_payment_transaction_id: transactionId,
    }
    if (subscriptionId && !matchedUser.paypal_subscription_id) {
      updates.paypal_subscription_id = subscriptionId
    }
    await admin.from('users').update(updates).eq('id', matchedUser.id)

    return NextResponse.json({
      status: 'no_action',
      message: '既存ユーザーの月額継続課金（last_payment_at 更新）',
      user_id: matchedUser.id,
      full_name: matchedUser.full_name,
    })
  }

  // ③ 初回処理: 自動でアカウント発行
  // 既存ユーザーがメールで存在するか
  const { data: existingUser } = await admin
    .from('users')
    .select('id, customer_id')
    .eq('email', payerEmail)
    .maybeSingle()
  const customerId = existingUser?.customer_id || (await nextOnlineCustomerId(admin))

  // Drive複製
  const drive = await duplicateDriveFolder(app.full_name, customerId)

  // ユーザー作成 or 更新
  let userId: string
  if (existingUser) {
    userId = existingUser.id
    const updates: Record<string, unknown> = {
      is_online: true,
      paypal_subscription_id: subscriptionId,
    }
    if (drive.ok && drive.folderUrl) updates.drive_folder_url = drive.folderUrl
    if (!existingUser.customer_id) updates.customer_id = customerId
    await admin.from('users').update(updates).eq('id', userId)
  } else {
    const now = new Date().toISOString()
    const { data: created, error: createErr } = await admin.from('users').insert({
      email: payerEmail,
      full_name: app.full_name,
      customer_id: customerId,
      is_admin: false,
      is_online: true,
      is_free_user: false,
      is_test: false,
      joined_at: now,
      account_issued_at: now,
      drive_folder_url: drive.ok ? drive.folderUrl : null,
      paypal_subscription_id: subscriptionId,
    }).select('id').single()
    if (createErr) {
      return NextResponse.json({ status: 'error', error: 'ユーザー作成失敗: ' + createErr.message }, { status: 500 })
    }
    userId = created.id
  }

  // Supabase Auth 作成 + 仮pw
  const password = generatePassword(12)
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingAuth = list?.users.find(u => u.email?.toLowerCase() === payerEmail)
  if (existingAuth) {
    await admin.auth.admin.updateUserById(existingAuth.id, { password })
    await admin.from('users').update({ auth_id: existingAuth.id }).eq('id', userId)
  } else {
    const { data: createdAuth, error } = await admin.auth.admin.createUser({
      email: payerEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: app.full_name },
    })
    if (error) {
      return NextResponse.json({ status: 'error', error: 'Auth作成失敗: ' + error.message }, { status: 500 })
    }
    await admin.from('users').update({ auth_id: createdAuth.user.id }).eq('id', userId)
  }

  // ウェルカムメール
  const joinedAt = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  const mailSent = await sendWelcomeEmail({
    fullName: app.full_name,
    email: payerEmail,
    password,
    driveFolderUrl: drive.ok ? drive.folderUrl ?? null : null,
    joinedAt,
  })

  // applications を更新
  await admin.from('applications').update({
    payment_status: 'paid',
    payment_confirmed_at: new Date().toISOString(),
    status: 'approved',
    user_id: userId,
    processed_at: new Date().toISOString(),
    paypal_subscription_id: subscriptionId,
  }).eq('id', app.id)

  // users の最終入金情報を更新
  await admin.from('users').update({
    last_payment_at: new Date().toISOString(),
    last_payment_amount: body.amount || null,
    last_payment_transaction_id: transactionId,
  }).eq('id', userId)

  // 入金履歴に記録（初回のみ paypal_payments に保存）
  await admin.from('paypal_payments').insert({
    transaction_id: transactionId,
    subscription_id: subscriptionId,
    payer_email: payerEmail,
    payer_name: body.customer_name || app.full_name,
    amount: body.amount || null,
    currency: body.currency || 'JPY',
    is_initial: true,
    user_id: userId,
    application_id: app.id,
    raw_payload: body.raw_payload || null,
  })

  // LINE Push（line_user_id があれば）
  let linePushed = false
  if (app.line_user_id) {
    const message =
      `${app.full_name}様\n\n` +
      `お支払いを確認いたしました。\n` +
      `e-ラーニングのアカウントを発行しましたので、\n` +
      `ご入力いただいたメールアドレス宛にログイン情報をお送りしています。\n\n` +
      `ご確認のほど、よろしくお願いいたします。\n\n` +
      `▼ ログインURL\n` +
      `https://tts-e.vercel.app/login\n\n` +
      `TTSオンライン運営事務局`
    linePushed = await pushLineMessage(app.line_user_id, message)
  }

  return NextResponse.json({
    status: 'processed',
    is_initial: true,
    user_id: userId,
    application_id: app.id,
    full_name: app.full_name,
    customer_id: customerId,
    drive_ok: drive.ok,
    drive_error: drive.error,
    mail_sent: mailSent,
    line_pushed: linePushed,
  })
}
