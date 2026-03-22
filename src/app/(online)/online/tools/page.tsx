'use client'

import { Wrench, ExternalLink } from 'lucide-react'

const tools = [
  { name: 'ピークボトムプログラムツール', description: 'テクニカル分析のピークボトム判定を自動で行うツールです。', applyRequired: true },
  { name: 'TradingView', description: 'チャート分析用のプラットフォーム。無料プランでも利用可能です。', url: 'https://www.tradingview.com' },
  { name: '売買記録表テンプレート', description: 'トレードの記録を残すためのテンプレートです。' },
]

export default function OnlineToolsPage() {
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
            <p className="text-gray-600 text-sm mb-4">{tool.description}</p>
            {tool.url ? (
              <a href={tool.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
                ツールを開く <ExternalLink className="w-3 h-3" />
              </a>
            ) : tool.applyRequired ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-700">利用申請が必要です。LINEにてお申し込みください。</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
