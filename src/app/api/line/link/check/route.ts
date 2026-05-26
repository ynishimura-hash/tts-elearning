/**
 * LINE 連携トークンの有効性を確認するエンドポイント
 *
 * フォームページ /line-link/[channel] がマウント時に呼び出す。
 * 期限切れ・使用済み・存在しないトークンは無効として返す。
 *
 * GET /api/line/link/check?token=xxx&channel=online
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { LineChannel } from '@/types/database'

interface CheckResponse {
  valid: boolean
  channel?: LineChannel
  reason?: 'not_found' | 'expired' | 'used' | 'channel_mismatch' | 'server_error'
}

export async function GET(request: NextRequest): Promise<NextResponse<CheckResponse>> {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const channelParam = searchParams.get('channel') as LineChannel | null

  if (!token || !channelParam || !['online', 'offline'].includes(channelParam)) {
    return NextResponse.json({ valid: false, reason: 'not_found' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ valid: false, reason: 'server_error' })
  }

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await sb
    .from('line_link_tokens')
    .select('token, channel, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ valid: false, reason: 'not_found' })
  }
  if (data.used_at) {
    return NextResponse.json({ valid: false, reason: 'used' })
  }
  if (new Date(data.expires_at) <= new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' })
  }
  if (data.channel !== channelParam) {
    return NextResponse.json({ valid: false, reason: 'channel_mismatch' })
  }

  return NextResponse.json({ valid: true, channel: data.channel })
}
