'use client'

import { useEffect, useState, Suspense, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast, Toaster } from 'sonner'
import { CheckCircle2, AlertCircle, Loader2, LogIn, Eye, EyeOff, Link2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Channel = 'online' | 'offline'
type PageState = 'loading' | 'invalid' | 'ready' | 'success'

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
  const [errorMessage, setErrorMessage] = useState('')
  const [loggedInName, setLoggedInName] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const channelLabel = channel === 'online' ? 'オンライン' : '対面'

  // 初期化: トークン確認 → ログイン状態確認
  useEffect(() => {
    async function init() {
      if (!channel || !token) {
        setErrorMessage('リンクが無効です。LINEから再度「連携」と送信してください。')
        setState('invalid')
        return
      }
      try {
        const res = await fetch(
          `/api/line/link/check?token=${encodeURIComponent(token)}&channel=${channel}`
        )
        const data = await res.json()
        if (!data.valid) {
          const messages: Record<string, string> = {
            expired: 'リンクの有効期限が切れています。LINEから再度「連携」と送信してください。',
            used: 'このリンクは既に使用されています。',
            channel_mismatch: 'リンクの種別が一致しません。',
            not_found: 'リンクが見つかりません。LINEから再度「連携」と送信してください。',
            server_error: 'サーバーエラーが発生しました。',
          }
          setErrorMessage(messages[data.reason] || 'リンクが無効です。')
          setState('invalid')
          return
        }
      } catch {
        setErrorMessage('リンクの確認中にエラーが発生しました。')
        setState('invalid')
        return
      }

      // ログイン済みなら氏名を取得（1タップ連携用）
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('full_name')
            .eq('auth_id', user.id)
            .maybeSingle()
          setLoggedInName(profile?.full_name || 'ログイン中のアカウント')
        }
      } catch {
        // 未ログイン扱い
      }
      setState('ready')
    }
    init()
  }, [channel, token])

  async function completeLink(accessToken: string) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/line/link/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token, channel }),
      })
      const data = await res.json()
      if (data.success) {
        setState('success')
      } else {
        const messages: Record<string, string> = {
          not_logged_in: 'ログインが必要です。もう一度お試しください。',
          invalid_token: 'リンクが無効です。LINEから再度「連携」と送信してください。',
          channel_role_mismatch:
            channel === 'offline'
              ? 'このアカウントは対面会員ではありません。オンライン会員の方はオンライン公式LINEで連携してください。'
              : 'このアカウントはオンライン会員ではありません。対面会員の方は対面公式LINEで連携してください。',
          already_linked:
            '既に別のLINEアカウントが紐付けられています。事務局までお問い合わせください。',
          server_error: 'サーバーエラーが発生しました。',
          invalid_input: '入力内容を確認してください。',
        }
        toast.error(messages[data.reason] || '連携に失敗しました')
      }
    } catch {
      toast.error('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  // 既にログイン済みのアカウントで連携（現在のセッションのトークンを使う）
  async function handleConfirmLoggedIn() {
    setSubmitting(true)
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      toast.error('セッションが切れています。もう一度ログインしてください')
      setLoggedInName(null)
      setSubmitting(false)
      return
    }
    await completeLink(session.access_token)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!email.trim() || !password.trim()) {
      toast.error('メールアドレスとパスワードを入力してください')
      return
    }
    setSubmitting(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error || !data.session) {
      toast.error('メールアドレスまたはパスワードが正しくありません')
      setSubmitting(false)
      return
    }
    // ログイン成功 → そのまま連携完了まで実行
    await completeLink(data.session.access_token)
  }

  async function useAnotherAccount() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setLoggedInName(null)
  }

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

          {state === 'invalid' && (
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <h1 className="text-lg font-bold text-slate-800 mb-2">リンクが無効です</h1>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {errorMessage}
              </p>
            </div>
          )}

          {state === 'ready' && (
            <>
              <div className="mb-6">
                <div className="inline-block px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded mb-3">
                  {channelLabel} 公式LINE
                </div>
                <h1 className="text-xl font-bold text-slate-800 mb-2">LINE連携</h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  TTSアカウントにログインして連携を完了します。
                </p>
              </div>

              {loggedInName ? (
                // 既にログイン済み → 1タップで連携
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs text-slate-500 mb-0.5">ログイン中のアカウント</p>
                    <p className="font-bold text-slate-800">{loggedInName}</p>
                  </div>
                  <button
                    onClick={handleConfirmLoggedIn}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#04384c] text-white rounded-lg font-medium hover:bg-[#062f3f] active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        連携中...
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4" />
                        このアカウントで連携する
                      </>
                    )}
                  </button>
                  <button
                    onClick={useAnotherAccount}
                    disabled={submitting}
                    className="w-full text-center text-xs text-slate-500 hover:text-slate-700 underline disabled:opacity-50"
                  >
                    別のアカウントでログインする
                  </button>
                </div>
              ) : (
                // 未ログイン → ログインフォーム
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      メールアドレス
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      autoComplete="email"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      パスワード
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="パスワードを入力"
                        autoComplete="current-password"
                        className="w-full px-3 py-2.5 pr-11 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      e-ラーニングにログインするメール・パスワードです
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-[#04384c] text-white rounded-lg font-medium hover:bg-[#062f3f] active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        連携中...
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        ログインして連携する
                      </>
                    )}
                  </button>
                </form>
              )}
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
