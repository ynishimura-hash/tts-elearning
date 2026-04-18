// 休学・退会ステータスの初期適用（一回限り）
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// is_on_leave 列の存在チェック（試しに SELECT してみる）
const { error: probeErr } = await sb.from('users').select('is_on_leave').limit(1)
if (probeErr && /is_on_leave/.test(probeErr.message)) {
  console.log('⚠ is_on_leave カラム未作成。Supabase ダッシュボードで以下の SQL を実行してください:')
  console.log('  ALTER TABLE users ADD COLUMN is_on_leave BOOLEAN DEFAULT FALSE;')
  process.exit(2)
}
console.log('✅ is_on_leave カラム存在確認')

const updates = [
  {
    email: 'masato.namba1009@gmail.com',
    set: { withdrew_at: '2026-04-18T00:00:00Z' },
    label: '難波雅人 → 退会済み',
  },
  {
    email: 'kansai.y-orange.102@ezweb.ne.jp',
    set: { is_on_leave: true },
    label: '大西祐平 → 休学中',
  },
  {
    email: 's310mito@icloud.com',
    set: { is_on_leave: true },
    label: '澤山未翔 → 休学中',
  },
]
for (const u of updates) {
  const { error, data } = await sb.from('users').update(u.set).eq('email', u.email).select()
  if (error) console.log(`❌ ${u.label}:`, error.message)
  else if (!data?.length) console.log(`⚠ ${u.label}: 該当ユーザーなし`)
  else console.log(`✅ ${u.label}`)
}
