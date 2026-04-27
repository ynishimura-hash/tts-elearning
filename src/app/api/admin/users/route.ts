import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface CreateUserBody {
  email: string
  password: string
  full_name: string
  customer_id?: string | null
  curriculum?: string | null
  drive_folder_url?: string | null
  is_online?: boolean
  is_free_user?: boolean
  is_admin?: boolean
  is_test?: boolean
  community_member?: boolean
  myrule_permitted?: boolean
  is_on_leave?: boolean
  joined_at?: string | null
  account_issued_at?: string | null
  debut_date?: string | null
  withdrew_at?: string | null
}

async function ensureAdmin(): Promise<boolean> {
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

  let body: CreateUserBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password?.trim()
  const fullName = body.full_name?.trim()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ success: false, error: 'メールアドレスが不正です' }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { success: false, error: 'パスワードは6文字以上で指定してください' },
      { status: 400 }
    )
  }
  if (!fullName) {
    return NextResponse.json({ success: false, error: '氏名は必須です' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { success: false, error: 'Supabase 環境変数が未設定です' },
      { status: 500 }
    )
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  // 既存メール重複チェック
  const { data: existing } = await admin.from('users').select('id').eq('email', email).maybeSingle()
  if (existing) {
    return NextResponse.json(
      { success: false, error: 'このメールアドレスは既に登録されています' },
      { status: 409 }
    )
  }

  // users テーブルへ INSERT
  const now = new Date().toISOString()
  const { data: newUser, error: insertErr } = await admin
    .from('users')
    .insert({
      email,
      full_name: fullName,
      customer_id: body.customer_id || null,
      curriculum: body.curriculum || null,
      drive_folder_url: body.drive_folder_url || null,
      is_online: body.is_online ?? false,
      is_free_user: body.is_free_user ?? false,
      is_admin: body.is_admin ?? false,
      is_test: body.is_test ?? false,
      community_member: body.community_member ?? false,
      myrule_permitted: body.myrule_permitted ?? false,
      is_on_leave: body.is_on_leave ?? false,
      joined_at: body.joined_at || now,
      account_issued_at: body.account_issued_at || now,
      debut_date: body.debut_date || null,
      withdrew_at: body.withdrew_at || null,
    })
    .select('id')
    .single()
  if (insertErr) {
    return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 })
  }

  // Auth 作成
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existingAuth = list?.users.find((u) => u.email?.toLowerCase() === email)
  let authId: string
  if (existingAuth) {
    const upd = await admin.auth.admin.updateUserById(existingAuth.id, { password })
    if (upd.error) {
      return NextResponse.json({ success: false, error: upd.error.message }, { status: 500 })
    }
    authId = existingAuth.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error) {
      // users 側はロールバック
      await admin.from('users').delete().eq('id', newUser.id)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    authId = data.user.id
  }
  await admin.from('users').update({ auth_id: authId }).eq('id', newUser.id)

  return NextResponse.json({ success: true, id: newUser.id })
}
