'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  Search, Trash2, ChevronDown, Mail, Phone, MapPin, CalendarDays,
  Clock, CheckCircle2, Wallet, UserCheck, Copy, Check, ExternalLink, Link2,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Application } from '@/types/database'

type AppRow = Application & {
  payment_status?: 'unpaid' | 'paid' | 'cancelled'
  user_id?: string | null
}

type StatusKey = 'applied' | 'awaiting_payment' | 'paid'

const STATUS_LABELS: Record<StatusKey, { label: string; color: string; ring: string }> = {
  applied: { label: '申し込み済み', color: 'bg-blue-100 text-blue-700', ring: 'ring-blue-200' },
  awaiting_payment: { label: '入金待ち', color: 'bg-amber-100 text-amber-700', ring: 'ring-amber-200' },
  paid: { label: '入金済み', color: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200' },
}

function getStatusKey(app: AppRow): StatusKey {
  if (app.payment_status === 'paid') return 'paid'
  if (app.status === 'approved') return 'awaiting_payment'
  return 'applied'
}

const ONLINE_APPLY_URL = 'https://tts-e.vercel.app/apply/online'
const OFFLINE_APPLY_URL = 'https://tts-e.vercel.app/apply/offline'

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<AppRow[]>([])
  const [filter, setFilter] = useState<'all' | StatusKey>('all')
  const [courseFilter, setCourseFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data: apps } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false })
    if (apps) setApplications(apps as AppRow[])
  }

  async function changeStatus(app: AppRow, next: StatusKey) {
    const current = getStatusKey(app)
    if (current === next) {
      setOpenMenuId(null)
      return
    }
    if (next === 'paid') {
      if (!confirm(
        `${app.full_name} さんを「入金済み」にします。\n\n` +
        (app.course_type === 'online'
          ? '【自動処理】\n1. Driveフォルダを複製\n2. e-ラーニングアカウント発行\n3. ウェルカムメール送信\n\n'
          : '') +
        '実行しますか？'
      )) {
        setOpenMenuId(null)
        return
      }
      setUpdatingId(app.id)
      try {
        const res = await fetch(`/api/admin/applications/${app.id}/confirm-payment`, { method: 'POST' })
        const data = await res.json()
        if (data.success) {
          toast.success('「入金済み」に変更しました', {
            description: app.course_type === 'online'
              ? `${data.drive_ok ? '✓ Drive ' : '⚠ Drive '}${data.mail_sent ? '✓ メール ' : '⚠ メール '}${data.line_pushed ? '✓ LINE通知' : ''}`
              : undefined,
          })
          fetchData()
        } else {
          toast.error(data.error || '失敗しました')
        }
      } catch {
        toast.error('通信エラー')
      }
      setUpdatingId(null)
      setOpenMenuId(null)
      return
    }

    // 申し込み済み / 入金待ちは単純なステータス更新
    setUpdatingId(app.id)
    const supabase = createClient()
    const update: Record<string, unknown> = {
      processed_at: new Date().toISOString(),
    }
    if (next === 'applied') {
      update.status = 'pending'
      update.payment_status = 'unpaid'
    } else if (next === 'awaiting_payment') {
      update.status = 'approved'
      update.payment_status = 'unpaid'
    }
    const { error } = await supabase.from('applications').update(update).eq('id', app.id)
    if (error) toast.error(error.message)
    else toast.success(`「${STATUS_LABELS[next].label}」に変更しました`)
    setUpdatingId(null)
    setOpenMenuId(null)
    fetchData()
  }

  async function handleDelete(app: AppRow) {
    if (!confirm(`${app.full_name} さんの申込を削除します。実行しますか？`)) return
    setUpdatingId(app.id)
    const res = await fetch(`/api/admin/applications/${app.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      toast.success('削除しました')
      fetchData()
    } else {
      toast.error(data.error || '削除失敗')
    }
    setUpdatingId(null)
  }

  async function copyUrl(url: string, key: string) {
    await navigator.clipboard.writeText(url)
    setCopiedKey(key)
    toast.success('URLをコピーしました')
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const filtered = applications.filter(app => {
    if (filter !== 'all' && getStatusKey(app) !== filter) return false
    if (courseFilter !== 'all' && app.course_type !== courseFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return app.full_name.toLowerCase().includes(s) || app.email.toLowerCase().includes(s)
    }
    return true
  })

  const counts = {
    all: applications.length,
    applied: applications.filter(a => getStatusKey(a) === 'applied').length,
    awaiting_payment: applications.filter(a => getStatusKey(a) === 'awaiting_payment').length,
    paid: applications.filter(a => getStatusKey(a) === 'paid').length,
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">申込管理</h1>
      </div>

      {/* 申込フォームURL（2つ） */}
      <div className="bg-gradient-to-r from-[#384a8f]/5 to-[#e39f3c]/5 border border-[#384a8f]/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#384a8f]" />
          <p className="text-sm font-medium text-gray-700">申込フォームURL（受講希望者にお渡しください）</p>
        </div>
        {[
          { key: 'online', label: 'オンライン受講', url: ONLINE_APPLY_URL, color: 'bg-purple-100 text-purple-700' },
          { key: 'offline', label: '対面受講', url: OFFLINE_APPLY_URL, color: 'bg-green-100 text-green-700' },
        ].map((u) => (
          <div key={u.key} className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded font-medium ${u.color} flex-shrink-0`}>{u.label}</span>
            <code className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-slate-700 truncate">
              {u.url}
            </code>
            <button onClick={() => copyUrl(u.url, u.key)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75]">
              {copiedKey === u.key ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedKey === u.key ? 'コピー済み' : 'コピー'}
            </button>
            <a href={u.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ))}
      </div>

      {/* 検索＋フィルタ */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="名前またはメールで検索"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'all' as const, label: 'すべて', count: counts.all, color: 'bg-[#384a8f]' },
            { key: 'applied' as const, label: '申し込み済み', count: counts.applied, color: 'bg-blue-500' },
            { key: 'awaiting_payment' as const, label: '入金待ち', count: counts.awaiting_payment, color: 'bg-amber-500' },
            { key: 'paid' as const, label: '入金済み', count: counts.paid, color: 'bg-emerald-500' },
          ]).map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                filter === f.key ? `${f.color} text-white` : 'bg-white text-gray-600 border border-slate-200 hover:bg-gray-50'
              }`}>
              {f.label}
              <span className={`px-2 py-0.5 rounded text-xs ${filter === f.key ? 'bg-white/20' : 'bg-gray-100'}`}>{f.count}</span>
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            {(['all', 'online', 'offline'] as const).map(c => (
              <button key={c} onClick={() => setCourseFilter(c)}
                className={`px-3 py-2 rounded-lg text-xs font-medium ${
                  courseFilter === c ? 'bg-slate-700 text-white' : 'bg-white text-gray-600 border border-slate-200'
                }`}>
                {c === 'all' ? '全種別' : c === 'online' ? 'オンライン' : '対面'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 申込一覧 */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400">該当する申込はありません</div>
        ) : (
          filtered.map(app => {
            const statusKey = getStatusKey(app)
            const accountIssued = !!app.user_id
            const status = STATUS_LABELS[statusKey]
            return (
              <div key={app.id}
                className={`bg-white rounded-xl px-4 py-3 shadow-sm border ${
                  statusKey === 'applied' ? 'border-blue-200' :
                  statusKey === 'awaiting_payment' ? 'border-amber-200' :
                  'border-emerald-200'
                }`}>
                {/* 1行目: 名前 + ステータス + 操作 */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h3 className="font-bold text-gray-800">{app.full_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      app.course_type === 'offline' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'
                    }`}>
                      {app.course_type === 'offline' ? '対面' : 'オンライン'}
                    </span>
                    {accountIssued && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />アカウント発行済み
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* ステータス切替ドロップダウン */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === app.id ? null : app.id)}
                        disabled={updatingId === app.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${status.color} hover:opacity-80 disabled:opacity-50`}
                      >
                        {statusKey === 'applied' && <Clock className="w-3.5 h-3.5" />}
                        {statusKey === 'awaiting_payment' && <Wallet className="w-3.5 h-3.5" />}
                        {statusKey === 'paid' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {updatingId === app.id ? '処理中...' : status.label}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {openMenuId === app.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[180px]">
                            {(['applied', 'awaiting_payment', 'paid'] as StatusKey[]).map(s => (
                              <button key={s}
                                onClick={() => changeStatus(app, s)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${
                                  statusKey === s ? 'bg-slate-50 font-bold' : ''
                                }`}>
                                {s === 'applied' && <Clock className="w-3.5 h-3.5 text-blue-600" />}
                                {s === 'awaiting_payment' && <Wallet className="w-3.5 h-3.5 text-amber-600" />}
                                {s === 'paid' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                                {STATUS_LABELS[s].label}
                                {statusKey === s && <Check className="w-3.5 h-3.5 ml-auto text-slate-400" />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {!accountIssued && app.payment_status !== 'paid' && (
                      <button onClick={() => handleDelete(app)}
                        title="削除"
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2行目: 連絡先情報を1行に圧縮 */}
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{app.email}</span>
                  {app.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{app.phone}</span>}
                  {app.birthdate && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{app.birthdate}</span>}
                  {(app.postal_code || app.address) && (
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{app.postal_code && `〒${app.postal_code} `}{app.address}</span>
                  )}
                  <span className="text-gray-400">申込: {formatDateTime(app.created_at)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
