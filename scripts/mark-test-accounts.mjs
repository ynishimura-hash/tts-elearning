// テストアカウントとしてマークする（一回限り）
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

const TEST_EMAILS = [
  'test@gmail.com',
  'user1@gmail.com',
  'user2@gmail.com',
  'user3@gmail.com',
  'online@gmail.com',
]

for (const email of TEST_EMAILS) {
  const { error, data } = await sb.from('users').update({ is_test: true }).eq('email', email).select()
  if (error) console.log(`❌ ${email}:`, error.message)
  else if (!data?.length) console.log(`⚠ ${email}: 該当なし`)
  else console.log(`✅ ${email} → is_test=true`)
}
