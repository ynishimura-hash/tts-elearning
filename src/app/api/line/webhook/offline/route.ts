import { NextRequest, NextResponse } from 'next/server'
import { handleLineWebhook } from '@/lib/line-webhook'

/**
 * オフライン公式LINE の Webhook エンドポイント
 * LINE Developers コンソールでこのURLを設定する:
 *   https://tts-e.vercel.app/api/line/webhook/offline
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleLineWebhook(request, 'offline')
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, channel: 'offline', hint: 'POST your LINE webhook here' })
}
