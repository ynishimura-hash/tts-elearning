'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, CheckCircle2, Loader2 } from 'lucide-react'

interface EnrollmentLink {
  id: string
  code: string
  course_type: string
  label: string | null
  monthly_price: number
}

export default function EnrollPage() {
  const { code } = useParams<{ code: string }>()
  const [link, setLink] = useState<EnrollmentLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', message: '',
  })

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('enrollment_links')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        setLink(data)
        setLoading(false)
      })
  }, [code])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!link) return
    setSubmitting(true)
    setError('')

    const supabase = createClient()
    const { error: insertError } = await supabase.from('applications').insert({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      course_type: link.course_type,
      message: form.message || null,
      enrollment_link_id: link.id,
    })

    if (insertError) {
      setError('申込に失敗しました。もう一度お試しください。')
      setSubmitting(false)
      return
    }

    // 使用カウント増加
    await supabase.from('enrollment_links')
      .update({ used_count: (link as any).used_count + 1 })
      .eq('id', link.id)

    // 自動返信メール送信
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: form.email,
          subject: '【TTS e-ラーニング】受講お申し込みを受け付けました',
          body: `${form.full_name} 様\n\nTTS e-ラーニングへの受講お申し込みありがとうございます。\n\n【お申し込み内容】\nコース種別: ${link.course_type === 'online' ? 'オンライン' : '対面'}\n${link.monthly_price > 0 ? `月額料金: ¥${link.monthly_price.toLocaleString()}\n` : ''}\n担当者より入金手続きのご案内をお送りいたしますので、しばらくお待ちください。\n\n---\nTTS トレーダー養成訓練学校`,
        }),
      })
    } catch {}

    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#384a8f] to-[#1a2456]">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  if (!link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#384a8f] to-[#1a2456] px-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <p className="text-gray-600">このURLは無効です。</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#384a8f] to-[#1a2456] px-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">お申し込みありがとうございます</h2>
          <p className="text-gray-600 text-sm">
            ご入力いただいたメールアドレス宛に確認メールをお送りしました。
            担当者より入金手続きのご案内をお送りいたしますので、しばらくお待ちください。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#384a8f] to-[#1a2456] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo-icon.png" alt="TTS" className="w-20 h-20 mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-white">TTS e-ラーニング</h1>
          <p className="text-white/60 mt-1">受講お申し込み</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">
          {/* コース情報 */}
          <div className="bg-[#384a8f]/5 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#384a8f]" />
            </div>
            <div>
              <p className="font-bold text-gray-800">{link.label || (link.course_type === 'online' ? 'オンラインコース' : '対面コース')}</p>
              {link.monthly_price > 0 && (
                <p className="text-sm text-[#e39f3c] font-medium">月額 ¥{link.monthly_price.toLocaleString()}</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">お名前 <span className="text-red-500">*</span></label>
              <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="山田太郎"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="example@email.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="090-1234-5678"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={3} placeholder="ご質問やご要望があればお書きください"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full py-3 bg-[#384a8f] text-white rounded-lg font-bold hover:bg-[#2d3d75] transition-colors disabled:opacity-50">
              {submitting ? '送信中...' : '申し込む'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
