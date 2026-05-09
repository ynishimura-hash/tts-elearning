import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GAS から呼ばれる軽量チェックエンドポイント
 * 入金待ちの申込が1件以上あるかだけを返す
 * GET /api/payments/has-pending?token=xxx
 */
export async function GET(request: NextRequest) {
  const expectedToken = process.env.PAYPAL_NOTIFY_TOKEN
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'env not set' }, { status: 500 })
  }
  const sb = createClient(supabaseUrl, serviceRoleKey)

  const { count, error } = await sb
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('payment_status', 'unpaid')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    has_pending: (count || 0) > 0,
    count: count || 0,
  })
}
