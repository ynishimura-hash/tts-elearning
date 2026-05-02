import { NextResponse } from 'next/server'
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

export async function GET() {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: '環境変数未設定' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await admin
    .from('peak_bottom_applications')
    .select(`
      id, tradingview_username, status, applied_at, completed_at, note,
      user:users!peak_bottom_applications_user_id_fkey ( id, full_name, email, customer_id )
    `)
    .order('applied_at', { ascending: false })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, applications: data })
}
