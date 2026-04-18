import { createClient as createServiceClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

/**
 * 一斉配信ライブラリ（管理画面 /admin/broadcasts 用）
 * - 受講者ごとに変数置換して 1 通ずつ送信
 * - 配信停止リスト（email_unsubscribes）に登録された宛先は自動スキップ
 *
 * 送信トランスポートは以下の優先順:
 *   1. Gmail SMTP   (GMAIL_USER + GMAIL_APP_PASSWORD)  ← 推奨
 *   2. Resend       (RESEND_API_KEY)
 *   3. モック        (環境変数なし。コンソールに出力するだけ)
 */

export const TTS_SENDER = {
  name: process.env.GMAIL_SENDER_NAME || 'TTS e-ラーニング事務局',
  email: process.env.GMAIL_USER || 'trademasternikkei225@gmail.com',
}

export interface RecipientVariables {
  email: string
  full_name?: string | null
  customer_id?: string | null
  temp_password?: string | null
  /** その他の動的変数（テンプレート展開用） */
  extra?: Record<string, string | null | undefined>
}

export interface BroadcastResult {
  total: number
  sent: number
  failed: number
  skipped: number
  errors: { email: string; error: string }[]
}

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://tts-e.vercel.app'

/** 環境変数に基づくシステム標準変数（ホスト名・ログイン URL 等） */
function getSystemVariables() {
  return {
    login_url: `${APP_BASE_URL}/login`,
    app_url: APP_BASE_URL,
  }
}

/** {{key}} 形式のプレースホルダーを置換 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = vars[key]
    return value == null ? '' : String(value)
  })
}

/** プレーンテキストを HTML パラグラフへ */
export function textToHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => `<p style="margin:0 0 8px 0;line-height:1.7;">${escapeHtml(line) || '&nbsp;'}</p>`)
    .join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function generateUnsubscribeToken(email: string): string {
  return Buffer.from(email).toString('base64url')
}

export function getEmailFooterHtml(_recipientEmail: string): string {
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;">
      <p style="margin:0 0 4px 0;font-weight:600;color:#64748b;">TTS e-ラーニング事務局</p>
      <p style="margin:0;">このメールは TTS e-ラーニングから配信しています。</p>
    </div>
  `
}

type SendResult = { success: true } | { success: false; error: string }

interface SendArgs {
  from: string
  to: string
  subject: string
  html: string
  headers?: Record<string, string>
}

/** Gmail SMTP トランスポート（GMAIL_USER + GMAIL_APP_PASSWORD が必要） */
function getGmailTransport() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  })
}

async function sendViaGmail(args: SendArgs): Promise<SendResult> {
  const transporter = getGmailTransport()
  if (!transporter) return { success: false, error: 'Gmail SMTP not configured' }
  try {
    await transporter.sendMail({
      from: args.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      headers: args.headers,
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

interface ResendOk {
  id: string
}

async function sendViaResend(args: SendArgs & { apiKey: string }): Promise<SendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      headers: args.headers,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    return { success: false, error: `Resend ${res.status}: ${text}` }
  }
  await res.json() as ResendOk
  return { success: true }
}

interface SendBroadcastArgs {
  recipients: RecipientVariables[]
  subject: string
  bodyText: string
  /** 上書き用 HTML（省略時は bodyText から自動生成） */
  bodyHtml?: string
  senderName?: string
  senderEmail?: string
}

/**
 * 一斉配信を実行する。
 * - 配信停止リストにある宛先はスキップ
 * - 受講者ごとに件名・本文の {{var}} を置換
 * - フッター（配信停止リンク）は自動付与
 */
export async function sendBroadcast(args: SendBroadcastArgs): Promise<BroadcastResult> {
  const result: BroadcastResult = {
    total: args.recipients.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  }

  const gmailReady = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
  const resendApiKey = process.env.RESEND_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // 配信停止リストを取得
  let unsubscribed = new Set<string>()
  if (supabaseUrl && serviceRoleKey) {
    const supabase = createServiceClient(supabaseUrl, serviceRoleKey)
    const { data } = await supabase.from('email_unsubscribes').select('email')
    unsubscribed = new Set((data || []).map((u: { email: string }) => u.email.toLowerCase()))
  }

  const senderName = args.senderName || TTS_SENDER.name
  const senderEmail = args.senderEmail || TTS_SENDER.email
  const from = `"${senderName}" <${senderEmail}>`
  const systemVars = getSystemVariables()

  for (const recipient of args.recipients) {
    if (unsubscribed.has(recipient.email.toLowerCase())) {
      result.skipped++
      continue
    }

    const vars: Record<string, string | null | undefined> = {
      ...systemVars,
      ...recipient.extra,
      email: recipient.email,
      full_name: recipient.full_name ?? '',
      customer_id: recipient.customer_id ?? '',
      temp_password: recipient.temp_password ?? '',
    }

    const personalSubject = renderTemplate(args.subject, vars)
    const baseHtml = args.bodyHtml ?? textToHtml(args.bodyText)
    const personalHtml = renderTemplate(baseHtml, vars) + getEmailFooterHtml(recipient.email)

    const sendArgs = {
      from,
      to: recipient.email,
      subject: personalSubject,
      html: personalHtml,
    }

    let res: SendResult
    if (gmailReady) {
      res = await sendViaGmail(sendArgs)
    } else if (resendApiKey) {
      res = await sendViaResend({ ...sendArgs, apiKey: resendApiKey })
    } else {
      console.log(`[broadcast mock] ${from} -> ${recipient.email}: ${personalSubject}`)
      res = { success: true }
    }

    if (res.success) {
      result.sent++
    } else {
      result.failed++
      result.errors.push({ email: recipient.email, error: res.error })
    }
  }

  return result
}

/** 12 桁のランダムな仮パスワードを生成（英大小数字・記号） */
export function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  // 暗号学的乱数で生成（Node 実行環境前提）
  const array = new Uint32Array(length)
  if (typeof globalThis.crypto !== 'undefined' && 'getRandomValues' in globalThis.crypto) {
    globalThis.crypto.getRandomValues(array)
  } else {
    for (let i = 0; i < length; i++) array[i] = Math.floor(Math.random() * 0xffffffff)
  }
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[array[i] % chars.length]
  }
  return out
}
