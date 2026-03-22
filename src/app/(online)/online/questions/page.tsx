'use client'

import { MessageSquare } from 'lucide-react'

export default function OnlineQuestionsPage() {
  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">質問受付について</h1>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#384a8f] mb-3">質問方法</h2>
          <div className="space-y-4 text-gray-700">
            <p>学習内容に関するご質問は、以下の方法で受け付けております。</p>
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-2">オンライン勉強会での質問</h3>
              <p className="text-sm">毎月開催のオンライン勉強会（Zoom）にて、直接質問いただけます。</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-bold text-gray-800 mb-2">LINE での質問</h3>
              <p className="text-sm">TTS公式LINEにてメッセージをお送りください。</p>
            </div>
          </div>
        </div>
        <div className="border-t pt-6">
          <h2 className="text-lg font-bold text-[#384a8f] mb-3">注意事項</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
            <li>回答までにお時間をいただく場合があります</li>
            <li>具体的なエントリーポイントの指示はいたしかねます</li>
            <li>学習内容に関する質問のみお受けしております</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
