import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { generateTempPassword } from '@/lib/email-broadcast'

// service-role クライアントの型エイリアス（generic を緩める）
type AdminClient = SupabaseClient

interface MigrateRequestBody {
  /** 'all' | 'offline' | 'online' | 'free' | 'specific'  */
  scope: 'all' | 'offline' | 'online' | 'free' | 'specific'
  /** scope='specific' のとき対象とする users.id 配列 */
  userIds?: string[]
  /** false の場合は実行せず、対象一覧と既存パスワード状況のみ返す */
  dryRun?: boolean
}

interface IssuedPassword {
  user_id: string
  email: string
  full_name: string
  customer_id: string | null
  temp_password: string
  status: 'created' | 'updated' | 'failed'
  error?: string
}

async function ensureAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('auth_id', user.id)
    .single()
  return profile?.is_admin === true
}

export async function POST(request: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { success: false, error: 'Supabase 環境変数が未設定です' },
      { status: 500 }
    )
  }

  let body: MigrateRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  // 対象ユーザー抽出
  let query = admin
    .from('users')
    .select('id, email, full_name, customer_id, auth_id, is_admin, is_online, is_free_user')
    .order('created_at', { ascending: true })

  if (body.scope === 'specific' && body.userIds?.length) {
    query = query.in('id', body.userIds)
  } else if (body.scope === 'offline') {
    query = query.eq('is_online', false).eq('is_free_user', false).eq('is_admin', false)
  } else if (body.scope === 'online') {
    query = query.eq('is_online', true).eq('is_free_user', false).eq('is_admin', false)
  } else if (body.scope === 'free') {
    query = query.eq('is_free_user', true)
  }
  // 'all' の場合はそのまま全件

  const { data: targetUsers, error: usersError } = await query
  if (usersError) {
    return NextResponse.json({ success: false, error: usersError.message }, { status: 500 })
  }
  if (!targetUsers?.length) {
    return NextResponse.json({ success: true, issued: [], total: 0 })
  }

  // dryRun: 対象一覧だけ返す
  if (body.dryRun) {
    return NextResponse.json({
      success: true,
      total: targetUsers.length,
      preview: targetUsers.map((u) => ({
        user_id: u.id,
        email: u.email,
        full_name: u.full_name,
        customer_id: u.customer_id,
        has_auth: !!u.auth_id,
      })),
    })
  }

  const issued: IssuedPassword[] = []

  for (const user of targetUsers) {
    const tempPassword = generateTempPassword(12)
    const status = await upsertAuthUser(admin, {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      authId: user.auth_id,
      password: tempPassword,
    })

    issued.push({
      user_id: user.id,
      email: user.email,
      full_name: user.full_name,
      customer_id: user.customer_id,
      temp_password: tempPassword,
      status: status.kind,
      error: status.kind === 'failed' ? status.error : undefined,
    })
  }

  return NextResponse.json({
    success: true,
    total: issued.length,
    issued,
    summary: {
      created: issued.filter((i) => i.status === 'created').length,
      updated: issued.filter((i) => i.status === 'updated').length,
      failed: issued.filter((i) => i.status === 'failed').length,
    },
  })
}

async function upsertAuthUser(
  admin: AdminClient,
  args: {
    userId: string
    email: string
    fullName: string
    authId: string | null
    password: string
  }
): Promise<{ kind: 'created' } | { kind: 'updated' } | { kind: 'failed'; error: string }> {
  // 既存の auth_id がある場合 → パスワードのみ更新
  if (args.authId) {
    const { error } = await admin.auth.admin.updateUserById(args.authId, {
      password: args.password,
    })
    if (error) return { kind: 'failed', error: error.message }
    return { kind: 'updated' }
  }

  // 新規作成（メール認証スキップ・パスワード設定）
  const { data, error } = await admin.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
    user_metadata: { full_name: args.fullName },
  })
  if (error) {
    // 既に Auth 上に存在するケース → メールで検索 → パスワード更新
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = list?.users.find((u) => u.email?.toLowerCase() === args.email.toLowerCase())
    if (!existing) return { kind: 'failed', error: error.message }
    const upd = await admin.auth.admin.updateUserById(existing.id, { password: args.password })
    if (upd.error) return { kind: 'failed', error: upd.error.message }
    // users テーブルへ auth_id を反映
    await admin.from('users').update({ auth_id: existing.id }).eq('id', args.userId)
    return { kind: 'updated' }
  }

  // 新規作成成功 → users.auth_id を反映
  await admin.from('users').update({ auth_id: data.user.id }).eq('id', args.userId)
  return { kind: 'created' }
}
