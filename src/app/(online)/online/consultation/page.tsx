'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Users, CheckCircle2 } from 'lucide-react'

export default function OnlineConsultationPage() {
  const { user } = useUser()
  const [message, setMessage] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const supabase = createClient()
    await supabase.from('messages').insert({
      title: `【オンライン】個別相談申込: ${user.full_name}`,
      body: `希望日時: ${preferredDate}\n\n${message}`,
    })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">申込を受け付けました</h2>
          <p className="text-gray-600">担当者から連絡させていただきますので、しばらくお待ちください。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">個別相談申し込み</h1>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-600 mb-6">オンラインでの個別相談（Zoom）を承っております。</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">希望日時</label>
            <input type="datetime-local" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">相談内容</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={5} placeholder="相談したい内容をお書きください"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none resize-none" />
          </div>
          <button type="submit" className="w-full py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors">
            申し込む
          </button>
        </form>
      </div>
    </div>
  )
}
