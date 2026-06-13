/**
 * 管理者向け: 勉強会の送信履歴（催促・案内・リマインド）を取得する。
 * study_session_notifications は RLS 有効・service role 限定のため、ここで読む。
 *
 * GET /api/admin/study-sessions/[id]/notifications
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

async function ensureAdmin(): Promise<boolean> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('auth_id', user.id)
    .single()
  return profile?.is_admin === true
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, reason: 'forbidden' }, { status: 403 })
  }
  const { id } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }
  const admin = createServiceClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await admin
    .from('study_session_notifications')
    .select('stage, channel, full_name, success, created_at')
    .eq('session_id', id)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) {
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 })
  }

  return NextResponse.json({ success: true, notifications: data || [] })
}
