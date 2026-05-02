'use client'

import { useState } from 'react'
import { toast, Toaster } from 'sonner'
import { CheckCircle2, Send, AlertCircle } from 'lucide-react'

const REFERRAL_OPTIONS = ['HPから', '知人の紹介', 'SNSにて', 'その他'] as const
type Referral = (typeof REFERRAL_OPTIONS)[number]

export default function OfflineApplyPage() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    birthdate: '',
    postal_code: '',
    address: '',
    referral_source: '' as Referral | '',
    referral_detail: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const showReferralDetail = ['知人の紹介', 'SNSにて', 'その他'].includes(form.referral_source)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.referral_source) {
      toast.error('受講のきっかけを選択してください')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/apply/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
      } else {
        toast.error(data.error || '送信に失敗しました')
      }
    } catch {
      toast.error('通信エラーが発生しました')
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <div className="min-h-screen bg-gradient-to-br from-[#384a8f]/5 to-[#e39f3c]/5 px-4 py-12 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-3">申し込みを受け付けました</h1>
            <p className="text-gray-600 leading-relaxed mb-6">
              ご入力いただいたメールアドレス宛に<br />
              <strong className="text-gray-800">入金手続きのご案内メール</strong>をお送りしました。<br />
              受信箱をご確認いただき、PayPalでのお支払いをお願いいたします。
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 text-left">
              <p className="font-bold mb-1">⚠ メールが届かない場合</p>
              <ul className="list-disc list-inside space-y-1 text-amber-800">
                <li>迷惑メールフォルダをご確認ください</li>
                <li>iCloud（@icloud.com / @me.com）は届きにくい場合があります</li>
                <li>30分以上経っても届かない場合は事務局へお問い合わせください</li>
              </ul>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-gradient-to-br from-[#384a8f]/5 to-[#e39f3c]/5 px-4 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#384a8f] to-[#1a2456] text-white p-6 md:p-8">
              <h1 className="text-xl md:text-2xl font-bold mb-2">
                TTS有料会員 申込フォーム<br className="md:hidden" />（対面受講）
              </h1>
              <p className="text-sm text-white/80">トレーダー・トレーニング・スクール</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
                  placeholder="example@gmail.com"
                />
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2 text-xs text-amber-900 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p>
                    <strong>iCloud（@icloud.com / @me.com）をご利用の方へ</strong><br />
                    迷惑メール対策により、メールが届かない可能性があります。Gmailなど別のアドレスのご利用をおすすめします。
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">氏名 <span className="text-red-500">*</span></label>
                <input type="text" required value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
                  placeholder="山田 太郎" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">電話番号 <span className="text-red-500">*</span></label>
                <input type="tel" required value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
                  placeholder="09012345678" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">生年月日 <span className="text-red-500">*</span></label>
                <input type="date" required value={form.birthdate}
                  onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">郵便番号 <span className="text-red-500">*</span></label>
                <input type="text" required value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
                  placeholder="1000001" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">現住所 <span className="text-red-500">*</span></label>
                <input type="text" required value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
                  placeholder="東京都千代田区千代田1-1-1" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TTS受講のきっかけ <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {REFERRAL_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="referral_source" value={opt}
                        checked={form.referral_source === opt}
                        onChange={(e) => setForm({ ...form, referral_source: e.target.value as Referral })}
                        className="text-[#384a8f] focus:ring-[#384a8f]" />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {showReferralDetail && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.referral_source === '知人の紹介' && '紹介者のお名前'}
                    {form.referral_source === 'SNSにて' && '見たSNSアカウントなど'}
                    {form.referral_source === 'その他' && '詳細をご記入ください'}
                  </label>
                  <input type="text" value={form.referral_detail}
                    onChange={(e) => setForm({ ...form, referral_detail: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                </div>
              )}

              <div className="pt-4 border-t">
                <button type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#384a8f] text-white rounded-lg font-bold hover:bg-[#2d3d75] transition-colors disabled:opacity-50 text-base">
                  <Send className="w-5 h-5" />
                  {submitting ? '送信中...' : '申し込む'}
                </button>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  送信後、入金手続きのご案内メールが自動でお送りされます
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
