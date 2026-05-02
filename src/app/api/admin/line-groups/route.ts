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

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }
  const { data, error } = await getAdmin()
    .from('line_groups')
    .select('*')
    .order('last_event_at', { ascending: false, nullsFirst: false })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, groups: data })
}

interface PatchBody {
  display_name?: string
  is_peak_bottom_target?: boolean
}

export async function PATCH(request: NextRequest) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  }
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'id 必須' }, { status: 400 })

  let body: PatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'リクエスト不正' }, { status: 400 })
  }

  const admin = getAdmin()
  // 排他: 1グループだけが target になるように
  if (body.is_peak_bottom_target) {
    await admin.from('line_groups').update({ is_peak_bottom_target: false }).neq('id', id)
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.display_name !== undefined) update.display_name = body.display_name
  if (body.is_peak_bottom_target !== undefined) update.is_peak_bottom_target = body.is_peak_bottom_target

  const { error } = await admin.from('line_groups').update(update).eq('id', id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
