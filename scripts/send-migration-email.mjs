#!/usr/bin/env node
// CSV を読んで全員に「ログイン案内メール」を Gmail SMTP で配信する
// 使い方:
//   node scripts/send-migration-email.mjs --csv path/to/temp-passwords.csv          # 本番送信
//   node scripts/send-migration-email.mjs --csv ... --dry-run                       # 送信せず内容確認
//   node scripts/send-migration-email.mjs --csv ... --test y.nishimura@eis-reach.com # 自分宛にだけ送る

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import nodemailer from 'nodemailer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// .env.vercel.local 優先で読み込み（GMAIL_* がここにある）、無ければ .env.local
function loadEnv() {
  for (const f of ['.env.vercel.local', '.env.local']) {
    try {
      const content = readFileSync(join(projectRoot, f), 'utf-8')
      for (const line of content.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
        }
      }
    } catch { /* skip */ }
  }
}
loadEnv()

const args = process.argv.slice(2)
function arg(name) {
  const idx = args.indexOf(name)
  if (idx < 0) return undefined
  return args[idx + 1]
}
const csvPath = arg('--csv')
const dryRun = args.includes('--dry-run')
const testEmail = arg('--test')

if (!csvPath) {
  console.error('Usage: node scripts/send-migration-email.mjs --csv <path> [--dry-run] [--test <email>]')
  process.exit(1)
}

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const SENDER_NAME = process.env.GMAIL_SENDER_NAME || 'TTS e-ラーニング事務局'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://tts-e.vercel.app'
const LOGIN_URL = `${APP_URL}/login`

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('❌ GMAIL_USER / GMAIL_APP_PASSWORD が未設定です')
  process.exit(1)
}

// CSV パース（BOM・クオート対応）
function parseCsv(text) {
  text = text.replace(/^\ufeff/, '')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const split = (line) => {
    const out = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue }
      if (c === '"') { q = !q; continue }
      if (c === ',' && !q) { out.push(cur); cur = ''; continue }
      cur += c
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }
  const header = split(lines[0])
  const rows = []
  for (const line of lines.slice(1)) {
    const cols = split(line)
    const row = {}
    header.forEach((h, i) => (row[h] = cols[i]))
    rows.push(row)
  }
  return rows
}

const csvText = readFileSync(csvPath, 'utf-8')
const allRows = parseCsv(csvText)
// status=created or updated のみ送信対象
const rows = allRows.filter((r) => r.status === 'created' || r.status === 'updated')
console.log(`📋 CSV: ${csvPath}`)
console.log(`📊 全 ${allRows.length} 行 → 送信対象 ${rows.length} 名`)

if (rows.length === 0) {
  console.log('送信対象がありません')
  process.exit(0)
}

// テンプレート
const SUBJECT = '【TTS e-ラーニング】新システムへのログイン情報のご案内'
function buildBody(row) {
  return `${row.full_name} 様

いつも TTS e-ラーニングをご利用いただきありがとうございます。
TTS e-ラーニングは新しいシステムへ移行いたしました。
お手数ですが、下記の情報で初回ログインをお願いいたします。

────────────────────────────
ログインURL: ${LOGIN_URL}
メールアドレス: ${row.email}
仮パスワード: ${row.temp_password}
────────────────────────────

※初回ログイン後、マイページからパスワードの変更をお願いします。
※ご不明な点は、本メールへご返信ください。

引き続きよろしくお願いいたします。

────────────
TTS e-ラーニング事務局
${GMAIL_USER}`
}

function bodyToHtml(text) {
  const escape = (s) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  return text
    .split('\n')
    .map((l) => `<p style="margin:0 0 8px 0;line-height:1.7;">${escape(l) || '&nbsp;'}</p>`)
    .join('')
}

// プレビュー（最初の1名）
console.log('\n━━━ プレビュー（1人目）━━━')
console.log(`To: ${rows[0].email}`)
console.log(`Subject: ${SUBJECT}`)
console.log('---')
console.log(buildBody(rows[0]))
console.log('━━━━━━━━━━━━━━━━━━━━━━')

if (dryRun) {
  console.log('\n--dry-run のため送信しませんでした')
  process.exit(0)
}

// 送信
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
})
const from = `"${SENDER_NAME}" <${GMAIL_USER}>`

const targets = testEmail
  ? [{ ...rows[0], email: testEmail, full_name: 'テスト宛先' }]
  : rows

console.log(`\n📤 ${from} から ${targets.length} 通送信開始...`)

let sent = 0
let failed = 0
const errors = []

for (let i = 0; i < targets.length; i++) {
  const r = targets[i]
  const subject = testEmail ? `[テスト] ${SUBJECT}` : SUBJECT
  const text = buildBody(r)
  const html = bodyToHtml(text)
  try {
    await transporter.sendMail({ from, to: r.email, subject, text, html })
    sent++
    console.log(`  ✅ ${i + 1}/${targets.length} ${r.full_name} <${r.email}>`)
  } catch (err) {
    failed++
    const msg = err?.message || String(err)
    errors.push({ email: r.email, error: msg })
    console.log(`  ❌ ${i + 1}/${targets.length} ${r.full_name} <${r.email}> - ${msg}`)
  }
  // Gmail rate limit 配慮: 1 通毎に 200ms 待機
  await new Promise((resolve) => setTimeout(resolve, 200))
}

console.log('\n━━━━━━━━━━━━━━━━━━━━')
console.log(`送信結果: 成功 ${sent} / 失敗 ${failed} / 合計 ${targets.length}`)
if (errors.length > 0) {
  console.log('\n失敗詳細:')
  for (const e of errors) console.log(`  - ${e.email}: ${e.error}`)
}
