#!/usr/bin/env node
// 全ユーザーに 12 桁のランダム仮パスワードを発行し、Supabase Auth へ反映する。
// 結果は scripts/output/temp-passwords-YYYYMMDD-HHmmss.csv に保存。
//
// 実行方法:
//   node scripts/issue-temp-passwords.mjs           # 全員（管理者除く）
//   node scripts/issue-temp-passwords.mjs --all     # 管理者も含めて全員
//   node scripts/issue-temp-passwords.mjs --dry-run # 対象一覧だけ確認

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomInt } from 'node:crypto'

// 除外するテストアカウント（pw 上書きしない）
const EXCLUDED_EMAILS = new Set([
  'test@tts.com',
  'user@tts.com',
  'admin@tts.com',
])

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// .env.local を読み込み
function loadDotEnv() {
  const envPath = join(projectRoot, '.env.local')
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
loadDotEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です')
  process.exit(1)
}

const args = process.argv.slice(2)
const includeAdmins = args.includes('--all')
const dryRun = args.includes('--dry-run')

const PW_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
function generatePassword(length = 12) {
  let out = ''
  for (let i = 0; i < length; i++) out += PW_CHARS[randomInt(PW_CHARS.length)]
  return out
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main() {
  console.log('🔍 ユーザー一覧を取得中...')
  const today = new Date().toISOString()
  let q = supabase
    .from('users')
    .select('id, email, full_name, customer_id, auth_id, is_admin, is_online, is_free_user, is_test, is_on_leave, withdrew_at')
    .order('created_at', { ascending: true })
  if (!includeAdmins) q = q.eq('is_admin', false)
  // テストアカウント除外
  q = q.eq('is_test', false)
  // 退会済み（withdrew_at <= 今日）は除外。未来日や NULL は対象。
  q = q.or(`withdrew_at.is.null,withdrew_at.gt.${today}`)
  const { data: users, error } = await q
  if (error) {
    console.error('❌ users 取得失敗:', error.message)
    process.exit(1)
  }
  if (!users?.length) {
    console.log('対象ユーザーがいません')
    return
  }

  // テストアカウント除外
  const excluded = users.filter((u) => EXCLUDED_EMAILS.has(u.email.toLowerCase()))
  const filteredUsers = users.filter((u) => !EXCLUDED_EMAILS.has(u.email.toLowerCase()))
  if (excluded.length > 0) {
    console.log(`⚠ 除外されたテストアカウント: ${excluded.length} 件`)
    for (const u of excluded) console.log(`  - ${u.full_name} <${u.email}>`)
  }
  // 以降は filteredUsers を使用
  users.length = 0
  users.push(...filteredUsers)

  console.log(`✅ 対象 ${users.length} 名${includeAdmins ? '（管理者含む）' : '（管理者除く）'}`)
  if (dryRun) {
    for (const u of users) {
      const kind = u.is_free_user ? 'free' : u.is_online ? 'online' : 'offline'
      const auth = u.auth_id ? 'auth有' : 'auth無'
      const flags = [kind, auth]
      if (u.is_on_leave) flags.push('休学中')
      console.log(`  - ${u.full_name} <${u.email}> [${flags.join('] [')}]`)
    }
    console.log('\n--dry-run のため実際の発行はスキップしました')
    return
  }

  // Auth に既に存在するユーザーをメールで検索するための事前取得
  console.log('🔍 既存 Auth ユーザーを取得中...')
  const authByEmail = new Map()
  let page = 1
  while (true) {
    const { data, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (listErr) {
      console.error('❌ Auth ユーザー一覧取得失敗:', listErr.message)
      process.exit(1)
    }
    for (const u of data.users) {
      if (u.email) authByEmail.set(u.email.toLowerCase(), u)
    }
    if (!data.users.length || data.users.length < 1000) break
    page++
  }
  console.log(`✅ Auth 上に ${authByEmail.size} 名`)

  const results = []
  let i = 0
  for (const u of users) {
    i++
    const password = generatePassword(12)
    const existingAuth = authByEmail.get(u.email.toLowerCase())
    const targetAuthId = u.auth_id || existingAuth?.id

    let status = ''
    let errorMsg = ''
    try {
      if (targetAuthId) {
        const { error: updErr } = await supabase.auth.admin.updateUserById(targetAuthId, {
          password,
        })
        if (updErr) throw updErr
        status = 'updated'
        // users.auth_id を反映（不一致なら）
        if (!u.auth_id) {
          await supabase.from('users').update({ auth_id: targetAuthId }).eq('id', u.id)
        }
      } else {
        const { data, error: createErr } = await supabase.auth.admin.createUser({
          email: u.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        })
        if (createErr) throw createErr
        status = 'created'
        await supabase.from('users').update({ auth_id: data.user.id }).eq('id', u.id)
      }
    } catch (err) {
      status = 'failed'
      errorMsg = err?.message || String(err)
    }

    results.push({
      email: u.email,
      full_name: u.full_name,
      customer_id: u.customer_id || '',
      kind: u.is_free_user ? 'free' : u.is_online ? 'online' : 'offline',
      temp_password: status === 'failed' ? '' : password,
      status,
      error: errorMsg,
    })

    if (i % 10 === 0 || i === users.length) {
      console.log(`  処理中 ${i}/${users.length}`)
    }
  }

  // CSV 出力
  const outDir = join(projectRoot, 'scripts', 'output')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const stamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14) // YYYYMMDDHHmmss
  const outPath = join(outDir, `temp-passwords-${stamp}.csv`)
  const header = 'email,full_name,customer_id,kind,temp_password,status,error\n'
  const rows = results
    .map((r) =>
      [r.email, r.full_name, r.customer_id, r.kind, r.temp_password, r.status, r.error]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n')
  writeFileSync(outPath, '\ufeff' + header + rows, 'utf-8')

  // サマリー
  const summary = {
    total: results.length,
    created: results.filter((r) => r.status === 'created').length,
    updated: results.filter((r) => r.status === 'updated').length,
    failed: results.filter((r) => r.status === 'failed').length,
  }
  console.log('\n━━━━━━━━━━━━━━━━━━━━')
  console.log('発行完了')
  console.log(`  対象: ${summary.total} 名`)
  console.log(`  新規作成: ${summary.created} 件`)
  console.log(`  パスワード更新: ${summary.updated} 件`)
  console.log(`  失敗: ${summary.failed} 件`)
  console.log(`📄 CSV 出力: ${outPath}`)
  if (summary.failed > 0) {
    console.log('\n失敗したユーザー:')
    for (const r of results.filter((x) => x.status === 'failed')) {
      console.log(`  - ${r.email}: ${r.error}`)
    }
  }
}

main().catch((err) => {
  console.error('❌ 実行エラー:', err)
  process.exit(1)
})
