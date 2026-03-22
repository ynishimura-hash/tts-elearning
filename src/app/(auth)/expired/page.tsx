'use client'

import { Clock, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
          継続をご希望の場合は、TTS事務局までお問い合わせください。
        </p>
        <button onClick={handleLogout}
          className="flex items-center gap-2 mx-auto px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
          <LogOut className="w-4 h-4" /> ログアウト
        </button>
      </div>
    </div>
  )
}
