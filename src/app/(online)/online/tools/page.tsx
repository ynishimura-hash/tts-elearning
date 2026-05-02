'use client'

import Link from 'next/link'
import { Wrench, ExternalLink, Send, Clock, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'

interface Tool {
  name: string
  description: string
  url?: string
  linkLabel?: string
  isPeakBottom?: boolean
  unavailableNote?: string
}

type Application = {
  status: 'pending' | 'completed' | 'cancelled'
  tradingview_username: string
  applied_at: string
}

export default function OnlineToolsPage() {
  const { user, loading } = useUser()
  const [pbApp, setPbApp] = useState<Application | null>(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/peak-bottom/apply')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPbApp(data.application || null)
      })
      .catch(() => {})
  }, [user])

  const tools: Tool[] = [
    {
      name: '反対線ピークボトムプログラムツール',
      description: 'テクニカル分析のピークボトム判定を自動で行うツールです。\nTradingViewのインジケータとして提供しています。',
      isPeakBottom: true,
    },
    {
      name: 'TradingView',
      description: 'チャート分析用のプラットフォーム。無料プランでも利用可能です。\n※ただし、王道ルールなど、チャートを4画面で検証する場合はPlusプラン以上の有料プランで検証を行う必要があります。',
      url: 'https://www.tradingview.com',
    },
    {
      name: '売買記録表テンプレート',
      description: 'トレードの記録を残すためのテンプレートです。Google スプレッドシートで利用できます。',
      url: user?.drive_folder_url ?? undefined,
      linkLabel: 'フォルダに移動',
      unavailableNote: user && !user.drive_folder_url
        ? '売買記録表のGoogle Driveリンクがまだ登録されていません。運営までお問い合わせください。'
        : undefined,
    },
  ]

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <Wrench className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">検証訓練用ツール各種</h1>
      </div>
      <div className="grid gap-4">
        {tools.map((tool) => (
          <div key={tool.name} className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-2">{tool.name}</h2>
            <p className="text-gray-600 text-sm mb-4 whitespace-pre-line">{tool.description}</p>

            {tool.url && (
              <a href={tool.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
                {tool.linkLabel || 'ツールを開く'} <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {tool.unavailableNote && !loading && (
              <p className="text-sm text-gray-500">{tool.unavailableNote}</p>
            )}

            {/* ピークボトム専用UI */}
            {tool.isPeakBottom && (
              <div className="space-y-3">
                {pbApp?.status === 'pending' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-bold text-amber-900">申請中です</p>
                      <p className="text-amber-800">事務局からの連絡をお待ちください。</p>
                      <p className="text-xs text-amber-700 mt-1">
                        申請アカウント名: <span className="font-mono">{pbApp.tradingview_username}</span>
                      </p>
                    </div>
                  </div>
                )}
                {pbApp?.status === 'completed' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-bold text-emerald-900">登録完了</p>
                      <p className="text-emerald-800">TradingViewでインジケータをご利用ください。</p>
                      <p className="text-xs text-emerald-700 mt-1">
                        アカウント名: <span className="font-mono">{pbApp.tradingview_username}</span>
                      </p>
                    </div>
                  </div>
                )}
                <Link
                  href="/online/peak-bottom/apply"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {pbApp?.status === 'pending' ? '申請内容を編集する' :
                   pbApp?.status === 'completed' ? '再申請する' :
                   'ツール利用を申請する'}
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
