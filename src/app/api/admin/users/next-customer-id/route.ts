import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

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

export async function GET(request: NextRequest) {
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
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  // ?is_online=true|false で絞り込み（無指定は全件）
  const { searchParams } = new URL(request.url)
  const isOnlineParam = searchParams.get('is_online')
  let query = admin
    .from('users')
    .select('customer_id')
    .not('customer_id', 'is', null)
  if (isOnlineParam === 'true') query = query.eq('is_online', true)
  else if (isOnlineParam === 'false') query = query.eq('is_online', false)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // 数字4桁形式のIDから最大値を取得し +1
  let maxNum = 0
  for (const row of data || []) {
    const id = String(row.customer_id || '')
    if (/^\d{1,4}$/.test(id)) {
      const n = parseInt(id, 10)
      if (n > maxNum) maxNum = n
    }
  }
  const next = String(maxNum + 1).padStart(4, '0')
  return NextResponse.json({ success: true, next_customer_id: next })
}
