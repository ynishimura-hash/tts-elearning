'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, CheckCircle2 } from 'lucide-react'

export default function ApplyPage() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    course_type: 'offline' as 'offline' | 'online',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    // 申込をDBに保存
    const { error: dbError } = await supabase.from('applications').insert({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      course_type: form.course_type,
      message: form.message || null,
    })

    if (dbError) {
      setError('申し込みの送信に失敗しました。もう一度お試しください。')
      setLoading(false)
      return
    }

    // 自動返信メール送信
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: form.email,
          subject: '【TTS】受講お申し込みを受け付けました',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #384a8f; color: white; padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="margin: 0; font-size: 20px;">TTS e-ラーニング</h1>
              </div>
              <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p>${form.full_name} 様</p>
                <p>この度はTTSへの受講お申し込みをいただき、誠にありがとうございます。</p>
                <p>以下の内容でお申し込みを受け付けました。</p>
                <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                  <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">お名前</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${form.full_name}</td></tr>
                  <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">メールアドレス</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${form.email}</td></tr>
                  <tr><td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">受講形式</td><td style="padding: 8px; border: 1px solid #e5e7eb;">${form.course_type === 'offline' ? '対面受講' : 'オンライン受講'}</td></tr>
                </table>
                <p>担当者から改めてご連絡させていただきますので、しばらくお待ちください。</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">TTS e-ラーニング事務局</p>
              </div>
            </div>
          `,
        }),
      })
    } catch {
      // メール送信に失敗しても申込自体は成功
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#384a8f] to-[#1a2456] px-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">お申し込みありがとうございます</h2>
          <p className="text-gray-600 mb-4">
            確認メールをお送りしました。<br />
            担当者から改めてご連絡させていただきます。
          </p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors">
            ログインページへ
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#384a8f] to-[#1a2456] px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#e39f3c] rounded-2xl mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">受講お申し込み</h1>
          <p className="text-white/60 mt-2">TTS e-ラーニング</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">お名前 *</label>
            <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
              placeholder="山田 太郎" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス *</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
              placeholder="email@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
              placeholder="090-1234-5678" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">受講形式 *</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => setForm({ ...form, course_type: 'offline' })}
                className={`p-4 rounded-lg border-2 transition-colors text-center ${
                  form.course_type === 'offline' ? 'border-[#384a8f] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <p className="font-bold text-gray-800">対面受講</p>
                <p className="text-xs text-gray-500 mt-1">会場での受講</p>
              </button>
              <button type="button"
                onClick={() => setForm({ ...form, course_type: 'online' })}
                className={`p-4 rounded-lg border-2 transition-colors text-center ${
                  form.course_type === 'online' ? 'border-[#384a8f] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <p className="font-bold text-gray-800">オンライン受講</p>
                <p className="text-xs text-gray-500 mt-1">Zoomでの受講</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メッセージ</label>
            <textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none resize-none"
              placeholder="ご質問等ございましたらお書きください" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50">
            {loading ? '送信中...' : '申し込む'}
          </button>

          <div className="text-center">
            <a href="/login" className="text-sm text-[#384a8f] hover:underline">アカウントをお持ちの方はこちら</a>
          </div>
        </form>
      </div>
    </div>
  )
}
