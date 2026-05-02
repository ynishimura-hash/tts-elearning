'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Send, CheckCircle2, Clock, Wrench, Info } from 'lucide-react'

type Application = {
  id: string
  tradingview_username: string
  status: 'pending' | 'completed' | 'cancelled'
  applied_at: string
  completed_at: string | null
}

export default function PeakBottomApplyPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<Application | null>(null)

  useEffect(() => {
    fetchCurrent()
  }, [])

  async function fetchCurrent() {
    setLoading(true)
    try {
      const res = await fetch('/api/peak-bottom/apply')
      const data = await res.json()
      if (data.success) {
        setCurrent(data.application)
        if (data.application?.tradingview_username) {
          setUsername(data.application.tradingview_username)
        }
      }
    } catch {
      // ignore
    }
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = username.trim()
    if (!trimmed) {
      toast.error('TradingView アカウント名を入力してください')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/peak-bottom/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradingview_username: trimmed }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('申請が完了しました', {
          description: '事務局からの連絡をお待ちください',
        })
        await fetchCurrent()
      } else {
        toast.error(data.error || '申請に失敗しました')
      }
    } catch {
      toast.error('通信エラーが発生しました')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" /> 戻る
      </button>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <Wrench className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">反対線ピークボトムツール 利用申請</h1>
      </div>

      {/* 現在のステータス */}
      {!loading && current && current.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div className="text-sm text-amber-900 space-y-1">
            <p className="font-bold">申請中</p>
            <p>事務局からの連絡をお待ちください。</p>
            <p className="text-xs text-amber-700 mt-2">
              申請日時: {new Date(current.applied_at).toLocaleString('ja-JP')}<br />
              アカウント名: <span className="font-mono">{current.tradingview_username}</span>
            </p>
            <p className="text-xs text-amber-700 mt-2">
              ※ アカウント名を変更したい場合は下から再申請してください。
            </p>
          </div>
        </div>
      )}

      {!loading && current && current.status === 'completed' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div className="text-sm text-emerald-900 space-y-1">
            <p className="font-bold">登録完了</p>
            <p>TradingView でインジケータが利用可能な状態になっています。</p>
            <p className="text-xs text-emerald-700 mt-2">
              アカウント名: <span className="font-mono">{current.tradingview_username}</span><br />
              {current.completed_at && (
                <>登録完了日時: {new Date(current.completed_at).toLocaleString('ja-JP')}</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* 申請フォーム */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-1">
            <p>反対線ピークボトムツール（TradingView インジケータ）の利用申請フォームです。</p>
            <p>
              <strong>TradingView のアカウント名</strong>を入力して送信してください。
              事務局でインジケータの招待設定後、ご連絡いたします。
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            TradingView アカウント名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="例: trader_taro"
            required
            maxLength={100}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            TradingView にログインした状態で右上のプロフィール画像 → ユーザー名を確認してください。
          </p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting || !username.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? '送信中...' : current?.status === 'pending' ? '再申請する' : '申請する'}
          </button>
          <Link
            href="/online/tools"
            className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}
