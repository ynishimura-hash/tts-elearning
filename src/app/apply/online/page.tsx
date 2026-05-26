'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { CheckCircle2, Send, AlertCircle, MessageCircle, ExternalLink, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const LINE_OA_URL = 'https://lin.ee/5JaSzPA'

const REFERRAL_OPTIONS = ['HPから', '知人の紹介', 'SNSにて', 'その他'] as const
type Referral = (typeof REFERRAL_OPTIONS)[number]

type PageMode = 'loading' | 'apply' | 'waitlist' | 'invite_error'

export default function OnlineApplyPage() {
  return (
    <Suspense fallback={null}>
      <OnlineApplyForm />
    </Suspense>
  )
}

function OnlineApplyForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')                   // LINE連携用
  const waitlistToken = searchParams.get('waitlist')        // 空き待ち招待用
  const [form, setForm] = useState({
    full_name: '',
    furigana: '',
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
  const [linePushed, setLinePushed] = useState(false)
  const [pageMode, setPageMode] = useState<PageMode>('loading')
  const [waitlistId, setWaitlistId] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // 初期化: 招待トークン解決 → 受付状態確認
  useEffect(() => {
    async function init() {
      // 招待トークンがあれば優先：プリフィルして apply モードへ
      if (waitlistToken) {
        try {
          const res = await fetch(`/api/waitlist/by-token?token=${encodeURIComponent(waitlistToken)}`)
          const data = await res.json()
          if (data.success && data.waitlist) {
            const w = data.waitlist
            const refOpt: Referral | '' = REFERRAL_OPTIONS.includes(w.referral_source) ? w.referral_source : ''
            setForm({
              full_name: w.full_name || '',
              furigana: w.furigana || '',
              email: w.email || '',
              phone: w.phone || '',
              birthdate: w.birthdate || '',
              postal_code: w.postal_code || '',
              address: w.address || '',
              referral_source: refOpt,
              referral_detail: w.referral_detail || '',
            })
            setWaitlistId(w.id)
            setPageMode('apply')
            return
          } else {
            setInviteError(data.error || '招待リンクが無効です')
            setPageMode('invite_error')
            return
          }
        } catch {
          setInviteError('招待リンクの確認中にエラーが発生しました')
          setPageMode('invite_error')
          return
        }
      }

      // 受付状態を確認
      try {
        const supabase = createClient()
        const { data: settings } = await supabase
          .from('application_settings')
          .select('online_paused')
          .eq('id', true)
          .maybeSingle()
        setPageMode(settings?.online_paused ? 'waitlist' : 'apply')
      } catch {
        // 失敗時は通常フォームにフォールバック
        setPageMode('apply')
      }
    }
    init()
  }, [waitlistToken])

  const showReferralDetail = ['知人の紹介', 'SNSにて', 'その他'].includes(form.referral_source)
  const isWaitlistMode = pageMode === 'waitlist'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.referral_source) {
      toast.error('受講のきっかけを選択してください')
      return
    }
    setSubmitting(true)
    try {
      const endpoint = isWaitlistMode ? '/api/waitlist/online' : '/api/apply/online'
      const payload = isWaitlistMode
        ? { ...form }
        : { ...form, token, waitlist_token: waitlistToken, waitlist_id: waitlistId }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        setLinePushed(!!data.line_pushed)
        setSubmitted(true)
      } else {
        toast.error(data.error || '送信に失敗しました')
      }
    } catch {
      toast.error('通信エラーが発生しました')
    }
    setSubmitting(false)
  }

  if (pageMode === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#384a8f]/5 to-[#e39f3c]/5 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
      </div>
    )
  }

  if (pageMode === 'invite_error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#384a8f]/5 to-[#e39f3c]/5 px-4 py-12 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 text-center">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">招待リンクが無効です</h1>
          <p className="text-gray-600 leading-relaxed mb-2">
            {inviteError || '招待リンクをご確認ください'}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            ご不明な点は事務局までお問い合わせください。
          </p>
        </div>
      </div>
    )
  }

  if (submitted && isWaitlistMode) {
    return (
      <>
        <Toaster position="top-center" richColors />
        <div className="min-h-screen bg-gradient-to-br from-[#384a8f]/5 to-[#e39f3c]/5 px-4 py-12 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-3">空き待ちにご登録いただきました</h1>
            <p className="text-gray-600 leading-relaxed mb-6">
              現在、お申し込みの受付を一時停止しております。<br />
              ご記入いただいた内容で<strong className="text-gray-800">空き待ち</strong>としてお預かりいたしました。<br />
              受付再開の際に、改めて事務局よりご案内のメールをお送りいたします。
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900 text-left">
              <p className="font-bold mb-1">📩 確認メールをお送りしました</p>
              <p className="text-blue-800">
                ご入力いただいたメールアドレス宛に、ご登録内容の確認メールをお送りしています。届かない場合は迷惑メールフォルダもご確認ください。
              </p>
            </div>
          </div>
        </div>
      </>
    )
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

            {linePushed ? (
              <>
                <p className="text-gray-600 leading-relaxed mb-6">
                  入金用のURLが<strong className="text-gray-800">LINEに届いております</strong>。<br />
                  LINEに戻ってメッセージをご確認いただき、<br />
                  記載の<strong className="text-gray-800">PayPalリンクから入金</strong>をお願いいたします。
                </p>
                <a
                  href={LINE_OA_URL}
                  className="inline-flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3.5 bg-[#06C755] text-white rounded-lg font-bold hover:bg-[#05b04c] transition-colors text-base mb-6"
                >
                  <MessageCircle className="w-5 h-5" />
                  LINE公式アカウントに戻る
                  <ExternalLink className="w-4 h-4" />
                </a>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 text-left">
                  <p className="font-bold mb-1">📩 メールも合わせて送信しています</p>
                  <p className="text-amber-800">
                    念のため、ご入力いただいたメールアドレス宛にも入金手続きのご案内メールをお送りしています。LINEが届かない場合は、メールからもお支払いいただけます。
                  </p>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-[#384a8f] to-[#1a2456] text-white p-6 md:p-8">
              <h1 className="text-xl md:text-2xl font-bold mb-2">
                {isWaitlistMode ? (
                  <>TTSオンライン<br className="md:hidden" />有料会員 空き待ちフォーム</>
                ) : (
                  <>TTSオンライン<br className="md:hidden" />有料会員 申込フォーム</>
                )}
              </h1>
              <p className="text-sm text-white/80">
                トレーダー・トレーニング・スクール・オンライン
              </p>
            </div>

            {/* フォーム */}
            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
              {/* 空き待ちモード案内 */}
              {isWaitlistMode && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2 text-sm">
                  <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-amber-900">
                    <p className="font-bold">現在、お申し込みの受付を一時停止しております</p>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      下記フォームにご記入いただきますと「空き待ち」としてお預かりいたします。<br />
                      受付再開の際に、ご入力いただいたメールアドレス宛に正式なお申し込み手続きのご案内をお送りいたします。
                    </p>
                  </div>
                </div>
              )}

              {/* 招待経由バナー */}
              {waitlistId && !isWaitlistMode && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-blue-900">
                    <p className="font-bold">受付を再開いたしました</p>
                    <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                      空き待ちのご登録ありがとうございました。<br />
                      ご入力いただいた内容を反映しています。内容をご確認のうえ、お申し込みください。
                    </p>
                  </div>
                </div>
              )}

              {/* LINE 紐付け済みバナー */}
              {token && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-2 text-sm">
                  <MessageCircle className="w-5 h-5 text-[#06C755] flex-shrink-0 mt-0.5" />
                  <div className="text-green-900">
                    <p className="font-bold">LINE公式アカウントと連携中</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      送信後、PayPalお支払いリンクをLINEとメールの両方でお送りします。
                    </p>
                  </div>
                </div>
              )}

              {/* メールアドレス */}
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

              {/* 氏名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
                  placeholder="山田 太郎"
                />
              </div>

              {/* ふりがな */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ふりがな <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.furigana}
                  onChange={(e) => setForm({ ...form, furigana: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
                  placeholder="やまだ たろう / ヤマダ タロウ"
                />
                <p className="text-xs text-gray-500 mt-1">ひらがな または カタカナでご入力ください</p>
              </div>

              {/* 電話番号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  電話番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
                  placeholder="09012345678"
                />
              </div>

              {/* 生年月日 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  生年月日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.birthdate}
                  onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
                  className="block w-full min-w-0 box-border px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none appearance-none"
                  style={{ WebkitAppearance: 'none' }}
                />
              </div>

              {/* 郵便番号 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  郵便番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
                  placeholder="1000001"
                />
              </div>

              {/* 現住所 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  現住所 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
                  placeholder="東京都千代田区千代田1-1-1"
                />
              </div>

              {/* 受講のきっかけ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  TTSオンライン受講のきっかけ <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {REFERRAL_OPTIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="referral_source"
                        value={opt}
                        checked={form.referral_source === opt}
                        onChange={(e) => setForm({ ...form, referral_source: e.target.value as Referral })}
                        className="text-[#384a8f] focus:ring-[#384a8f]"
                      />
                      <span className="text-sm text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 紹介元の詳細 */}
              {showReferralDetail && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.referral_source === '知人の紹介' && '紹介者のお名前'}
                    {form.referral_source === 'SNSにて' && '見たSNSアカウントなど'}
                    {form.referral_source === 'その他' && '詳細をご記入ください'}
                  </label>
                  <input
                    type="text"
                    value={form.referral_detail}
                    onChange={(e) => setForm({ ...form, referral_detail: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
                  />
                </div>
              )}

              {/* 送信ボタン */}
              <div className="pt-4 border-t">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#384a8f] text-white rounded-lg font-bold hover:bg-[#2d3d75] transition-colors disabled:opacity-50 text-base"
                >
                  <Send className="w-5 h-5" />
                  {submitting ? '送信中...' : isWaitlistMode ? '空き待ちに登録する' : '申し込む'}
                </button>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  {isWaitlistMode
                    ? '送信後、ご登録内容の確認メールが自動でお送りされます'
                    : '送信後、入金手続きのご案内メールが自動でお送りされます'}
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
