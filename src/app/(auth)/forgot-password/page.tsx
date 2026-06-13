'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, CheckCircle2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!email.trim()) return
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
    } catch {
      // ネットワークエラーでも、案内は同じ（列挙防止と同じ思想で常に同じ画面）
    } finally {
      setLoading(false)
      setDone(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#384a8f] to-[#1a2456] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo-icon.png" alt="TTS" className="w-20 h-20 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-white">パスワードの再設定</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {done ? (
            <div className="text-center py-2">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-gray-800 mb-3">メールをご確認ください</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-2">
                ご登録のメールアドレス宛に、新しいパスワードをお送りしました。
              </p>
              <p className="text-xs text-gray-500 leading-relaxed mb-6">
                数分待っても届かない場合は、迷惑メールフォルダもご確認ください。
                <br />
                メールが届かない方は、事務局までお問い合わせください。
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-[#384a8f] font-medium hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                ログイン画面へ
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-gray-600 leading-relaxed">
                ご登録のメールアドレスを入力してください。
                <br />
                新しいパスワードをメールでお送りします。
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="email@example.com"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50"
              >
                {loading ? '送信中...' : '新しいパスワードを送る'}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  ログイン画面へ戻る
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
