import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

interface SetPasswordBody {
  password: string
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }
  const { id: targetUserId } = await params

  let body: SetPasswordBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const password = body.password?.trim()
  if (!password || password.length < 6) {
    return NextResponse.json(
      { success: false, error: 'パスワードは 6 文字以上で指定してください' },
      { status: 400 }
    )
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

  // 対象ユーザーを取得
  const { data: target, error: fetchErr } = await admin
    .from('users')
    .select('id, email, full_name, auth_id')
    .eq('id', targetUserId)
    .single()
  if (fetchErr || !target) {
    return NextResponse.json(
      { success: false, error: '対象ユーザーが見つかりません' },
      { status: 404 }
    )
  }

  let authId = target.auth_id as string | null

  // Auth ユーザーが存在しなければ既存検索 → なければ新規作成
  if (!authId) {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = list?.users.find(
      (u) => u.email?.toLowerCase() === target.email.toLowerCase()
    )
    if (existing) {
      authId = existing.id
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: target.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: target.full_name },
      })
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
      authId = data.user.id
      await admin.from('users').update({ auth_id: authId }).eq('id', targetUserId)
      return NextResponse.json({
        success: true,
        action: 'created',
        message: `Authアカウントを新規作成し、パスワードを設定しました`,
      })
    }
    await admin.from('users').update({ auth_id: authId }).eq('id', targetUserId)
  }

  // パスワード更新
  const { error: updErr } = await admin.auth.admin.updateUserById(authId, { password })
  if (updErr) {
    return NextResponse.json({ success: false, error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    action: 'updated',
    message: 'パスワードを更新しました',
  })
}
