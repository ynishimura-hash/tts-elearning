'use client'

import { useEffect, useState, Suspense, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { CheckCircle2, AlertCircle, Loader2, Send } from 'lucide-react'

type Channel = 'online' | 'offline'
type PageState = 'loading' | 'form' | 'success' | 'error'

interface PageProps {
  params: Promise<{ channel: string }>
}

export default function LineLinkPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <LineLinkForm {...props} />
    </Suspense>
  )
}

function LineLinkForm({ params }: PageProps) {
  const { channel: channelRaw } = use(params)
  const channel = (channelRaw === 'online' || channelRaw === 'offline'
    ? channelRaw
    : null) as Channel | null
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<PageState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function check() {
      if (!channel || !token) {
        setErrorMessage('リンクが無効です。LINEから再度「連携」と送信してください。')
        setState('error')
        return
      }
      try {
        const res = await fetch(
          `/api/line/link/check?token=${encodeURIComponent(token)}&channel=${channel}`
        )
        const data = await res.json()
        if (data.valid) {
          setState('form')
        } else {
          const messages: Record<string, string> = {
            expired: 'リンクの有効期限が切れています。LINEから再度「連携」と送信してください。',
            used: 'このリンクは既に使用されています。',
            channel_mismatch: 'リンクの種別が一致しません。',
            not_found: 'リンクが見つかりません。LINEから再度「連携」と送信してください。',
            server_error: 'サーバーエラーが発生しました。',
          }
          setErrorMessage(messages[data.reason] || 'リンクが無効です。')
          setState('error')
        }
      } catch {
        setErrorMessage('リンクの確認中にエラーが発生しました。')
        setState('error')
      }
    }
    check()
  }, [channel, token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!fullName.trim() || !phone.trim()) {
      toast.error('氏名と電話番号を入力してください')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/line/link/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          channel,
          full_name: fullName,
          phone,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setState('success')
      } else {
        const messages: Record<string, string> = {
          invalid_input: '入力内容を確認してください',
          invalid_token: 'リンクが無効です。LINEから再度「連携」と送信してください。',
          no_match: 'ご登録の会員情報と一致しません。氏名と電話番号をご確認ください。',
          multiple_match: '会員情報を一意に特定できませんでした。事務局までお問い合わせください。',
          channel_role_mismatch:
            channel === 'online'
              ? 'オフライン会員の方は、オフライン公式LINEで連携してください。'
              : 'オンライン会員の方は、オンライン公式LINEで連携してください。',
          already_linked: '既に別のLINEアカウントが紐付けられています。事務局までお問い合わせください。',
          server_error: 'サーバーエラーが発生しました。',
        }
        toast.error(messages[data.reason] || '連携に失敗しました')
      }
    } catch {
      toast.error('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  const channelLabel = channel === 'online' ? 'オンライン' : '対面'

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <Toaster richColors position="top-center" />
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {state === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-4" />
              <p className="text-sm text-slate-500">リンクを確認しています...</p>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <h1 className="text-lg font-bold text-slate-800 mb-2">リンクが無効です</h1>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {errorMessage}
              </p>
            </div>
          )}

          {state === 'form' && (
            <>
              <div className="mb-6">
                <div className="inline-block px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded mb-3">
                  {channelLabel} 公式LINE
                </div>
                <h1 className="text-xl font-bold text-slate-800 mb-2">LINE連携</h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  ご登録時の氏名と電話番号を入力してください。
                  <br />
                  会員情報と照合のうえ、LINE連携を完了します。
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    氏名 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="山田 太郎"
                    autoComplete="name"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    ご登録時と同じ姓と名（スペース有無は問いません）
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    電話番号 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="090-1234-5678"
                    autoComplete="tel"
                    inputMode="tel"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    ハイフン有無は問いません
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 bg-[#04384c] text-white rounded-lg font-medium hover:bg-[#062f3f] active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      確認中...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      連携する
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {state === 'success' && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-xl font-bold text-slate-800 mb-3">連携が完了しました</h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {channelLabel}公式LINE との連携が完了しました。
                <br />
                今後、勉強会のご案内などをLINEでお送りします。
              </p>
              <p className="text-xs text-slate-400">このタブは閉じていただいて構いません。</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          TTSシステム / 合同会社EIS
        </p>
      </div>
    </div>
  )
}
