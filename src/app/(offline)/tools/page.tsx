'use client'

import { Wrench, ExternalLink } from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'

interface Tool {
  name: string
  description: string
  url?: string
  applyInfo?: string
  unavailableNote?: string
}

export default function ToolsPage() {
  const { user, loading } = useUser()

  const tools: Tool[] = [
    {
      name: 'ピークボトムプログラムツール',
      description: 'テクニカル分析のピークボトム判定を自動で行うツールです。',
      applyInfo: '公式LINEにて下記のような文言でご連絡ください。\n\n例：\nピークボトムツールの利用申請です。\nアカウント名：XXXX',
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
                ツールを開く <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {tool.unavailableNote && !loading && (
              <p className="text-sm text-gray-500">{tool.unavailableNote}</p>
            )}
            {tool.applyInfo && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">利用申請方法</p>
                <p className="text-sm text-yellow-700 whitespace-pre-line">{tool.applyInfo}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
