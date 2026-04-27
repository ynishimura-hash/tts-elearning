'use client'

import { Clock, LogOut, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const LINE_OFFICIAL_URL = process.env.NEXT_PUBLIC_LINE_OFFICIAL_URL || 'https://lin.ee/'

export default function ExpiredPage() {
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#384a8f] to-[#1a2456] px-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <Clock className="w-16 h-16 text-orange-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">アカウントの有効期限が切れています</h2>
        <p className="text-gray-600 mb-6">
          お使いのアカウントの有効期限が切れました。<br />
          継続をご希望の方やご不明な点は、<br />
          <strong>TTS公式LINE</strong>までお問い合わせください。
        </p>
        <div className="space-y-3">
          <a
            href={LINE_OFFICIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-[#06C755] text-white rounded-lg font-medium hover:bg-[#05b34c] transition-colors"
          >
            <MessageCircle className="w-4 h-4" /> TTS公式LINEで問い合わせ
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            <LogOut className="w-4 h-4" /> ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}
