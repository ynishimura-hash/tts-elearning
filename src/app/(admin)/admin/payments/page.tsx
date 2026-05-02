'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Wallet, RefreshCw, Mail, Phone, MapPin, CalendarDays,
  CheckCircle2, Clock, AlertCircle, ExternalLink,
} from 'lucide-react'

type App = {
  id: string
  full_name: string
  email: string
  phone: string | null
  birthdate: string | null
  postal_code: string | null
  address: string | null
  referral_source: string | null
  referral_detail: string | null
  status: 'pending' | 'approved' | 'rejected'
  payment_status: 'unpaid' | 'paid' | 'cancelled'
  auto_reply_sent: boolean
  payment_confirmed_at: string | null
  created_at: string
}

type Filter = 'unpaid' | 'paid' | 'all'

export default function PaymentsPage() {
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('unpaid')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payments')
      const data = await res.json()
      if (data.success) setApps(data.applications || [])
      else toast.error(data.error || '取得失敗')
    } catch {
      toast.error('通信エラー')
    }
    setLoading(false)
  }

  async function handleConfirm(app: App) {
    if (!confirm(
      `${app.full_name} さんの入金完了処理を実行します。\n\n` +
      `以下が自動で行われます:\n` +
      `1. Driveフォルダを複製（受講生用）\n` +
      `2. e-ラーニングアカウントを作成\n` +
      `3. 仮パスワードを発行\n` +
      `4. ウェルカムメール送信（ログイン情報＋Driveフォルダ案内）\n\n` +
      `実行しますか？`
    )) return

    setConfirming(app.id)
    try {
      const res = await fetch(`/api/admin/applications/${app.id}/confirm-payment`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success('入金完了処理が完了しました', {
          description:
            (data.drive_ok ? '✓ Driveフォルダ複製完了 ' : '⚠ Driveフォルダ複製スキップ ') +
            (data.mail_sent ? '✓ メール送信完了' : '⚠ メール送信失敗'),
        })
        if (!data.drive_ok && data.drive_error) {
          toast.warning('Drive複製エラー: ' + data.drive_error)
        }
        fetchData()
      } else {
        toast.error(data.error || '処理に失敗しました')
      }
    } catch {
      toast.error('通信エラー')
    }
    setConfirming(null)
  }

  const filtered = apps.filter((a) => {
    if (filter === 'unpaid') return a.payment_status === 'unpaid'
    if (filter === 'paid') return a.payment_status === 'paid'
    return true
  })

  const counts = {
    unpaid: apps.filter((a) => a.payment_status === 'unpaid').length,
    paid: apps.filter((a) => a.payment_status === 'paid').length,
    all: apps.length,
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Wallet className="w-6 h-6 text-[#384a8f]" /> 入金管理（オンライン申込）
        </h1>
        <button onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> 更新
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'unpaid' as Filter, label: '入金待ち', count: counts.unpaid, color: 'bg-amber-500' },
          { key: 'paid' as Filter, label: '入金完了', count: counts.paid, color: 'bg-emerald-500' },
          { key: 'all' as Filter, label: 'すべて', count: counts.all, color: 'bg-[#384a8f]' },
        ].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key ? `${f.color} text-white` : 'bg-white text-gray-600 border border-slate-200 hover:bg-gray-50'
            }`}>
            {f.label}
            <span className={`px-2 py-0.5 rounded text-xs ${filter === f.key ? 'bg-white/20' : 'bg-gray-100'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
          {filter === 'unpaid' ? '入金待ちはありません' : '該当する申込はありません'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const isOpen = expanded === app.id
            return (
              <div key={app.id}
                className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                  app.payment_status === 'unpaid' ? 'border-amber-200' : 'border-slate-100'
                }`}>
                <div className="p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-gray-800">{app.full_name}</h3>
                        {app.payment_status === 'unpaid' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />入金待ち
                          </span>
                        )}
                        {app.payment_status === 'paid' && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />入金完了
                          </span>
                        )}
                        {!app.auto_reply_sent && (
                          <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />自動返信未送信
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{app.email}</p>
                        {app.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{app.phone}</p>}
                        <p>申込: {new Date(app.created_at).toLocaleString('ja-JP')}</p>
                        {app.payment_confirmed_at && (
                          <p className="text-emerald-600">入金完了: {new Date(app.payment_confirmed_at).toLocaleString('ja-JP')}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpanded(isOpen ? null : app.id)}
                        className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                      >
                        {isOpen ? '閉じる' : '詳細'}
                      </button>
                      {app.payment_status === 'unpaid' && (
                        <button
                          onClick={() => handleConfirm(app)}
                          disabled={confirming === app.id}
                          className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {confirming === app.id ? '処理中...' : '入金完了'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t bg-slate-50/60 p-4 md:p-5 text-sm space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                      {app.birthdate && (
                        <div className="flex gap-2"><CalendarDays className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div><span className="text-slate-500 text-xs">生年月日</span><p className="text-slate-700">{app.birthdate}</p></div>
                        </div>
                      )}
                      {app.postal_code && (
                        <div className="flex gap-2"><MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                          <div>
                            <span className="text-slate-500 text-xs">住所</span>
                            <p className="text-slate-700">〒{app.postal_code}<br />{app.address}</p>
                          </div>
                        </div>
                      )}
                      {app.referral_source && (
                        <div className="md:col-span-2">
                          <span className="text-slate-500 text-xs">受講のきっかけ</span>
                          <p className="text-slate-700">{app.referral_source}{app.referral_detail && `（${app.referral_detail}）`}</p>
                        </div>
                      )}
                    </div>

                    {app.payment_status === 'unpaid' && (
                      <div className="mt-3 pt-3 border-t bg-amber-50 -mx-4 -mb-4 md:-mx-5 md:-mb-5 px-4 md:px-5 py-3 text-xs text-amber-900">
                        <p className="font-bold mb-1">⚙ 入金完了ボタンを押すと自動実行</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-amber-800">
                          <li>Driveフォルダ複製（テンプレ → <span className="font-mono">{`{次番}_${app.full_name}様`}</span>）</li>
                          <li>e-ラーニングアカウント作成（is_online=true）</li>
                          <li>仮パスワード発行</li>
                          <li>ウェルカムメール送信</li>
                        </ol>
                        <a
                          href="https://drive.google.com/drive/folders/1cNSZoO-9ZxpSbmDhfUSROCsJdHGuSn2u"
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-amber-700 hover:underline"
                        >
                          親フォルダを開く <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
