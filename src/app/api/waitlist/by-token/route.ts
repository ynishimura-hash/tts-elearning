import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// 招待トークンから空き待ち情報を取得（プリフィル用）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) {
    return NextResponse.json({ success: false, error: 'token が必要です' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, error: 'サーバー設定エラー' }, { status: 500 })
  }

  const admin = createServiceClient(supabaseUrl, serviceRoleKey)
  const { data } = await admin
    .from('waitlist_applications')
    .select('id, full_name, furigana, email, phone, birthdate, postal_code, address, referral_source, referral_detail, course_type, status, invite_expires_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ success: false, error: '招待リンクが見つかりません' }, { status: 404 })
  }
  if (data.status === 'converted') {
    return NextResponse.json({ success: false, error: 'この招待リンクは既に使用されています' }, { status: 400 })
  }
  if (data.status === 'cancelled') {
    return NextResponse.json({ success: false, error: 'この招待リンクは無効化されています' }, { status: 400 })
  }
  if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
    return NextResponse.json({ success: false, error: '招待リンクの有効期限が切れています。事務局までお問い合わせください' }, { status: 400 })
  }

  return NextResponse.json({ success: true, waitlist: data })
}
