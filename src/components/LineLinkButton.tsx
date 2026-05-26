'use client'

import { CheckCircle2, MessageCircle, ExternalLink } from 'lucide-react'
import type { LineChannel } from '@/types/database'

interface LineLinkButtonProps {
  channel: LineChannel
  /** users.line_user_id_{channel} の値。null/undefined なら未連携 */
  lineUserId: string | null | undefined
  /** compact: ダッシュボード用（連携済みなら非表示） / card: マイページ用（連携済みなら✓表示） */
  variant: 'compact' | 'card'
}

/**
 * LINE 連携ボタン / セクション
 *
 * - variant='compact': ダッシュボード用。未連携時のみボタンを表示し、連携済みなら非表示
 * - variant='card':    マイページ用。連携済みなら「✓ LINE連携済み」、未連携なら友だち追加カード
 */
export function LineLinkButton({ channel, lineUserId, variant }: LineLinkButtonProps) {
  const isLinked = !!lineUserId
  const channelLabel = channel === 'online' ? 'オンライン' : '対面'
  const oaUrl =
    channel === 'online'
      ? process.env.NEXT_PUBLIC_LINE_OA_URL_ONLINE
      : process.env.NEXT_PUBLIC_LINE_OA_URL_OFFLINE

  // compact: ダッシュボード用。連携済みなら何も表示しない
  if (variant === 'compact') {
    if (isLinked) return null
    if (!oaUrl) return null
    return (
      <a
        href={oaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05a548] active:scale-[0.98] transition shadow-sm"
      >
        <MessageCircle className="w-4 h-4" />
        {channelLabel}公式LINE と連携する
        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </a>
    )
  }

  // card: マイページ用
  if (isLinked) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium text-emerald-900">{channelLabel}公式LINE 連携済み</p>
          <p className="text-xs text-emerald-700 mt-0.5">勉強会の案内をLINEでお受け取りいただけます。</p>
        </div>
      </div>
    )
  }

  // 未連携カード
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#06C755] text-white flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-800 mb-1">{channelLabel}公式LINE と連携</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            勉強会の出欠案内・リマインドをLINEで受け取れます。
          </p>
        </div>
      </div>

      <ol className="text-xs text-slate-600 space-y-1.5 mb-4 pl-1">
        <li>
          1. 下のボタンから{channelLabel}公式LINEを友だち追加
        </li>
        <li>
          2. トーク画面で「<span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">連携</span>」と送信
        </li>
        <li>3. 返信されたURLで氏名と電話番号を入力</li>
      </ol>

      {oaUrl ? (
        <a
          href={oaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05a548] active:scale-[0.98] transition"
        >
          <MessageCircle className="w-4 h-4" />
          友だち追加する
          <ExternalLink className="w-3.5 h-3.5 opacity-70" />
        </a>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">
          公式LINE のURLが設定されていません
        </p>
      )}
    </div>
  )
}
