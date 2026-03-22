'use client'

import { Gift, Copy, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'

export default function CampaignPage() {
  const { user } = useUser()
  const [copied, setCopied] = useState(false)

  const referralCode = user?.customer_id || ''

  function handleCopy() {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#e39f3c]/10 rounded-lg flex items-center justify-center">
          <Gift className="w-5 h-5 text-[#e39f3c]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">お友達紹介キャンペーン</h1>
      </div>

      <div className="bg-gradient-to-br from-[#e39f3c] to-[#d08f2c] rounded-xl p-6 text-white">
        <h2 className="text-xl font-bold mb-3">お友達をご紹介ください！</h2>
        <p className="text-white/90 mb-4">
          お友達がTTSに入会されると、紹介者・被紹介者ともに特典がございます。
        </p>
        <div className="bg-white/20 rounded-lg p-4">
          <p className="text-sm text-white/80 mb-1">あなたの紹介コード</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-mono font-bold">{referralCode}</span>
            <button onClick={handleCopy} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
              {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#384a8f] mb-3">紹介方法</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-600">
          <li>お友達に紹介コードをお伝えください</li>
          <li>お友達が入会申込時に紹介コードを記入します</li>
          <li>入会確認後、双方に特典が付与されます</li>
        </ol>
      </div>
    </div>
  )
}
