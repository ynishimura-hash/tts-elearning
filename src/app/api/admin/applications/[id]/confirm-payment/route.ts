import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { randomInt } from 'node:crypto'
import { pushLineMessage } from '@/lib/line-push'

type AdminClient = SupabaseClient

async function ensureAdmin(): Promise<string | null> {
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

interface DriveDuplicateResult {
  ok: boolean
  folderUrl?: string
  error?: string
}

async function duplicateDriveFolder(studentName: string, customerId: string): Promise<DriveDuplicateResult> {
  const url = process.env.GAS_DRIVE_WEBAPP_URL
  const token = process.env.GAS_DRIVE_TOKEN
  if (!url) return { ok: false, error: 'GAS_DRIVE_WEBAPP_URL 未設定（手動でフォルダURL登録してください）' }
  try {
    // GASのリダイレクトに対応する必要があるが Node fetch はデフォルトで follow するためそのままでOK
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName, customerId, token }),
      redirect: 'follow',
    })
    const text = await res.text()
    let data: { folderUrl?: string; error?: string }
    try {
      data = JSON.parse(text)
    } catch {
      return { ok: false, error: 'GASレスポンスがJSONではない: ' + text.slice(0, 200) }
    }
    if (data.folderUrl) return { ok: true, folderUrl: data.folderUrl }
    return { ok: false, error: data.error || 'GAS応答が不正' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

interface WelcomeMailArgs {
  fullName: string
  email: string
  password: string
  driveFolderUrl: string | null
  joinedAt: string
}

async function sendWelcomeEmail(args: WelcomeMailArgs): Promise<boolean> {
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
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await ensureAdmin()
  if (!adminId) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }
  const { id } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: '環境変数未設定' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  // 申込取得
  const { data: app, error: fetchErr } = await admin
    .from('applications')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchErr || !app) {
    return NextResponse.json({ success: false, error: '申込が見つかりません' }, { status: 404 })
  }
  if (app.payment_status === 'paid' && app.user_id) {
    return NextResponse.json({ success: false, error: '既に処理済みです' }, { status: 409 })
  }

  // 既存ユーザーチェック
  const { data: existingUser } = await admin
    .from('users')
    .select('id, auth_id, customer_id')
    .eq('email', app.email)
    .maybeSingle()

  // customer_id を確定（既存があれば再利用、なければ次番）
  const customerId = existingUser?.customer_id || (await nextOnlineCustomerId(admin))

  // 1. Drive フォルダ複製（customer_id を含めて命名: 0005_松田智子様）
  const drive = await duplicateDriveFolder(app.full_name, customerId)

  // 2. users にレコード作成 / 更新
  let userId: string
  if (existingUser) {
    userId = existingUser.id
    const updates: Record<string, unknown> = { is_online: true }
    if (drive.ok && drive.folderUrl) updates.drive_folder_url = drive.folderUrl
    if (!existingUser.customer_id) updates.customer_id = customerId
    await admin.from('users').update(updates).eq('id', userId)
  } else {
    const now = new Date().toISOString()
    const { data: created, error: createErr } = await admin.from('users').insert({
      email: app.email,
      full_name: app.full_name,
      customer_id: customerId,
      is_admin: false,
      is_online: true,
      is_free_user: false,
      is_test: false,
      joined_at: now,
      account_issued_at: now,
      drive_folder_url: drive.ok ? drive.folderUrl : null,
    }).select('id').single()
    if (createErr) {
      return NextResponse.json({ success: false, error: 'ユーザー作成失敗: ' + createErr.message }, { status: 500 })
    }
    userId = created.id
  }

  // 3. Supabase Auth に作成 + 仮pw
  const password = generatePassword(12)
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingAuth = list?.users.find(u => u.email?.toLowerCase() === app.email.toLowerCase())
  if (existingAuth) {
    const { error } = await admin.auth.admin.updateUserById(existingAuth.id, { password })
    if (error) return NextResponse.json({ success: false, error: 'パスワード更新失敗: ' + error.message }, { status: 500 })
    await admin.from('users').update({ auth_id: existingAuth.id }).eq('id', userId)
  } else {
    const { data: createdAuth, error } = await admin.auth.admin.createUser({
      email: app.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: app.full_name },
    })
    if (error) return NextResponse.json({ success: false, error: 'Auth作成失敗: ' + error.message }, { status: 500 })
    await admin.from('users').update({ auth_id: createdAuth.user.id }).eq('id', userId)
  }

  // 4. ウェルカムメール
  const joinedAt = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  const mailSent = await sendWelcomeEmail({
    fullName: app.full_name,
    email: app.email,
    password,
    driveFolderUrl: drive.ok ? drive.folderUrl ?? null : null,
    joinedAt,
  })

  // 5. applications を更新
  await admin.from('applications').update({
    payment_status: 'paid',
    payment_confirmed_at: new Date().toISOString(),
    payment_confirmed_by: adminId,
    status: 'approved',
    user_id: userId,
    processed_at: new Date().toISOString(),
  }).eq('id', id)

  // 6. users.last_payment_* も更新（手動入金完了でも記録）
  await admin.from('users').update({
    last_payment_at: new Date().toISOString(),
  }).eq('id', userId)

  // 7. line_user_id 紐付けがあれば本人にLINE通知
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
    success: true,
    drive_ok: drive.ok,
    drive_error: drive.error,
    mail_sent: mailSent,
    line_pushed: linePushed,
  })
}
