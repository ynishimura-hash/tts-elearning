import { NextRequest, NextResponse } from 'next/server'
import { handleLineWebhook } from '@/lib/line-webhook'

/**
 * オンライン公式LINE の Webhook エンドポイント
 * LINE Developers コンソールでこのURLを設定する:
 *   https://tts-e.vercel.app/api/line/webhook/online
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleLineWebhook(request, 'online')
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, channel: 'online', hint: 'POST your LINE webhook here' })
}
