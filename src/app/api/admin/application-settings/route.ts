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
  return !!profile?.is_admin
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: 'サーバー設定エラー' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await admin
    .from('application_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, settings: data })
}

export async function POST(request: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }

  let body: { online_paused?: boolean; offline_paused?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエストが不正です' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: 'サーバー設定エラー' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { updated_at: now }
  if (typeof body.online_paused === 'boolean') {
    updates.online_paused = body.online_paused
    updates.online_paused_at = body.online_paused ? now : null
  }
  if (typeof body.offline_paused === 'boolean') {
    updates.offline_paused = body.offline_paused
    updates.offline_paused_at = body.offline_paused ? now : null
  }

  const { data, error } = await admin
    .from('application_settings')
    .update(updates)
    .eq('id', true)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, settings: data })
}
