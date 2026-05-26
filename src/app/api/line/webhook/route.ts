import { NextRequest, NextResponse } from 'next/server'
import { handleLineWebhook } from '@/lib/line-webhook'

/**
 * 旧 Webhook エンドポイント（後方互換）
 *
 * LINE Developers コンソールで Webhook URL を /api/line/webhook/online に
 * 切り替えた後、このルートは削除可能。それまでは online チャネル扱いで処理する。
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleLineWebhook(request, 'online')
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    deprecated: true,
    hint: 'このURLは後方互換用です。新しい URL: /api/line/webhook/online',
  })
}
