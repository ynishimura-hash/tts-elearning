'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Wallet, RefreshCw, Mail, Phone, MapPin, CalendarDays,
  CheckCircle2, Clock, AlertCircle, ExternalLink, Copy, Check, Link2, Trash2,
} from 'lucide-react'

const APPLY_URL = 'https://tts-e.vercel.app/apply/online'

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
  const [deleting, setDeleting] = useState<string | null>(null)
  const [urlCopied, setUrlCopied] = useState(false)

  async function handleDelete(app: App) {
    if (!confirm(
      `${app.full_name} さんの申込を削除します。\n\n` +
      `※ メールアドレス: ${app.email}\n` +
      `この操作は取り消せません。実行しますか？`
    )) return
    setDeleting(app.id)
    try {
      const res = await fetch(`/api/admin/applications/${app.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('削除しました')
        fetchData()
      } else {
        toast.error(data.error || '削除に失敗しました')
      }
    } catch {
      toast.error('通信エラー')
    }
    setDeleting(null)
  }

  async function copyApplyUrl() {
    await navigator.clipboard.writeText(APPLY_URL)
    setUrlCopied(true)
    toast.success('申込フォームURLをコピーしました')
    setTimeout(() => setUrlCopied(false), 2000)
  }

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

      {/* 申込フォームURL */}
      <div className="bg-gradient-to-r from-[#384a8f]/5 to-[#e39f3c]/5 border border-[#384a8f]/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-[#384a8f]" />
          <p className="text-sm font-medium text-gray-700">受講希望者にお渡しする申込フォームURL</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-700 truncate">
            {APPLY_URL}
          </code>
          <button onClick={copyApplyUrl}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors">
            {urlCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {urlCopied ? 'コピー済み' : 'コピー'}
          </button>
          <a href={APPLY_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <ExternalLink className="w-4 h-4" /> 開く
          </a>
        </div>
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

      {/* ワークフロー説明（ヘッダー側に1度だけ） */}
      <details className="bg-amber-50 border border-amber-200 rounded-xl text-sm">
        <summary className="cursor-pointer px-4 py-3 font-bold text-amber-900 select-none">
          ⚙ 「入金完了」ボタンを押すと自動実行される処理
        </summary>
        <div className="px-4 pb-3 text-amber-800">
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Driveフォルダ複製（テンプレ → <span className="font-mono">{'{customer_id}_{氏名}様'}</span>）</li>
            <li>e-ラーニングアカウント作成（is_online=true）+ 仮パスワード発行</li>
            <li>ウェルカムメール送信（ログイン情報・LINE案内・Driveフォルダ含む）</li>
          </ol>
          <a
            href="https://drive.google.com/drive/folders/1cNSZoO-9ZxpSbmDhfUSROCsJdHGuSn2u"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-amber-700 hover:underline"
          >
            親フォルダを開く <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </details>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
          {filter === 'unpaid' ? '入金待ちはありません' : '該当する申込はありません'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <div key={app.id}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                app.payment_status === 'unpaid' ? 'border-amber-200' : 'border-slate-100'
              }`}>
              <div className="p-4 md:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* 氏名 + ステータス */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-800 text-base">{app.full_name}</h3>
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

                    {/* 連絡先 */}
                    <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400" />{app.email}</span>
                      {app.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" />{app.phone}</span>}
                      {app.birthdate && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3 text-gray-400" />{app.birthdate}</span>}
                    </div>

                    {/* 住所 */}
                    {(app.postal_code || app.address) && (
                      <div className="text-xs text-gray-600 flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span>{app.postal_code && `〒${app.postal_code} `}{app.address}</span>
                      </div>
                    )}

                    {/* きっかけ */}
                    {app.referral_source && (
                      <div className="text-xs text-gray-500">
                        きっかけ: <span className="text-gray-700">{app.referral_source}{app.referral_detail && `（${app.referral_detail}）`}</span>
                      </div>
                    )}

                    {/* 日時 */}
                    <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                      申込: {new Date(app.created_at).toLocaleString('ja-JP')}
                      {app.payment_confirmed_at && (
                        <span className="text-emerald-600 ml-3">入金完了: {new Date(app.payment_confirmed_at).toLocaleString('ja-JP')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {app.payment_status === 'unpaid' && (
                      <>
                        <button
                          onClick={() => handleConfirm(app)}
                          disabled={confirming === app.id}
                          className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {confirming === app.id ? '処理中...' : '入金完了'}
                        </button>
                        <button
                          onClick={() => handleDelete(app)}
                          disabled={deleting === app.id}
                          title="削除"
                          className="inline-flex items-center gap-1 p-2 text-rose-500 hover:bg-rose-50 rounded-lg disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
