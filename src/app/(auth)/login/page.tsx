'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
      return
    }

    // ユーザー種別を取得してリダイレクト
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('is_admin, is_online, is_free_user, withdrew_at')
        .eq('auth_id', user.id)
        .single()

      if (!profile) {
        setError('ユーザー情報が見つかりません')
        setLoading(false)
        return
      }

      // 有効期限チェック
      if (profile.withdrew_at && new Date(profile.withdrew_at) < new Date()) {
        router.push('/expired')
        return
      }

      // 最終ログイン更新
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('auth_id', user.id)

      if (profile.is_admin) {
        router.push('/admin')
      } else if (profile.is_free_user) {
        router.push('/free/home')
      } else if (profile.is_online) {
        router.push('/online/home')
      } else {
        router.push('/home')
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#384a8f] to-[#1a2456] px-4">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <img src="/logo-icon.png" alt="TTS" className="w-24 h-24 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-bold text-white">TTS e-ラーニング</h1>
          <p className="text-white/60 mt-2">トレーダー養成訓練学校</p>
        </div>

        {/* ログインフォーム */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none transition-all"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none transition-all pr-12"
                placeholder="パスワードを入力"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>

        </form>
      </div>
    </div>
  )
}
