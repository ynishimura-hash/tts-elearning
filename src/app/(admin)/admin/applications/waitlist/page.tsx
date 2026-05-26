'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Search, Send, CheckCircle2, Clock, XCircle, Mail, Phone, MapPin,
  CalendarDays, Trash2, Hourglass,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { WaitlistApplication } from '@/types/database'

type StatusKey = 'all' | 'waiting' | 'invited' | 'converted' | 'cancelled'

const STATUS_LABELS: Record<Exclude<StatusKey, 'all'>, { label: string; color: string; icon: typeof Clock }> = {
  waiting: { label: '空き待ち', color: 'bg-amber-100 text-amber-700', icon: Clock },
  invited: { label: '招待送信済', color: 'bg-blue-100 text-blue-700', icon: Send },
  converted: { label: '正式申込済', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  cancelled: { label: '無効化', color: 'bg-gray-100 text-gray-500', icon: XCircle },
}

export default function AdminWaitlistPage() {
  const [rows, setRows] = useState<WaitlistApplication[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all')
  const [courseFilter, setCourseFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase
      .from('waitlist_applications')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setRows(data as WaitlistApplication[])
  }

  useEffect(() => { fetchData() }, [])

  async function sendInvite(ids: string[]) {
    if (ids.length === 0) {
      toast.error('対象が選択されていません')
      return
    }
    const targets = rows.filter(r => ids.includes(r.id))
    const reinviteCount = targets.filter(r => r.status === 'invited').length
    const msg = reinviteCount > 0
      ? `${ids.length}件に招待メールを送信します。\n（うち${reinviteCount}件は再送信になります）\n\nよろしいですか？`
      : `${ids.length}件に招待メールを送信します。よろしいですか？`
    if (!confirm(msg)) return

    setSending(true)
    try {
      const res = await fetch('/api/admin/waitlist/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${data.sent}/${data.total} 件に送信しました`)
        setSelectedIds(new Set())
        fetchData()
      } else {
        toast.error(data.error || '送信に失敗しました')
      }
    } catch {
      toast.error('通信エラーが発生しました')
    }
    setSending(false)
  }

  async function cancelRow(row: WaitlistApplication) {
    if (!confirm(`${row.full_name} さんの空き待ち登録を無効化します。よろしいですか？`)) return
    const supabase = createClient()
    const { error } = await supabase
      .from('waitlist_applications')
      .update({ status: 'cancelled' })
      .eq('id', row.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('無効化しました')
    fetchData()
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function toggleSelectAll(visibleIds: string[]) {
    const allSelected = visibleIds.every(id => selectedIds.has(id))
    const next = new Set(selectedIds)
    if (allSelected) visibleIds.forEach(id => next.delete(id))
    else visibleIds.forEach(id => next.add(id))
    setSelectedIds(next)
  }

  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (courseFilter !== 'all' && r.course_type !== courseFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.full_name.toLowerCase().includes(q) && !r.email.toLowerCase().includes(q) && !r.furigana.toLowerCase().includes(q)) {
        return false
      }
    }
    return true
  })

  const counts = {
    waiting: rows.filter(r => r.status === 'waiting').length,
    invited: rows.filter(r => r.status === 'invited').length,
    converted: rows.filter(r => r.status === 'converted').length,
    cancelled: rows.filter(r => r.status === 'cancelled').length,
  }

  const visibleSelectableIds = filtered
    .filter(r => r.status === 'waiting' || r.status === 'invited')
    .map(r => r.id)
  const allVisibleSelected = visibleSelectableIds.length > 0 && visibleSelectableIds.every(id => selectedIds.has(id))

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/applications" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Hourglass className="w-6 h-6 text-amber-600" />
            空き待ち一覧
          </h1>
        </div>
        <button
          onClick={() => sendInvite(Array.from(selectedIds))}
          disabled={sending || selectedIds.size === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] disabled:opacity-40 transition-colors text-sm"
        >
          <Send className="w-4 h-4" />
          {sending ? '送信中...' : `選択した ${selectedIds.size} 件に招待送信`}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p>
          受付停止中に登録された空き待ち申込の一覧です。受付を再開後、こちらから個別または一括で「招待送信」してください。
          招待メールには、入力済みの内容がプリフィルされた正式申込フォームのURLが含まれます（有効期限14日）。
        </p>
      </div>

      {/* 検索＋フィルタ */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・ふりがな・メールで検索"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all' as const, label: 'すべて', count: rows.length },
            { key: 'waiting' as const, label: '空き待ち', count: counts.waiting },
            { key: 'invited' as const, label: '招待送信済', count: counts.invited },
            { key: 'converted' as const, label: '正式申込済', count: counts.converted },
            { key: 'cancelled' as const, label: '無効化', count: counts.cancelled },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                statusFilter === f.key
                  ? 'bg-[#384a8f] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label} <span className="ml-1 text-xs opacity-80">{f.count}</span>
            </button>
          ))}

          <div className="ml-auto flex gap-1">
            {(['all', 'online', 'offline'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCourseFilter(c)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  courseFilter === c
                    ? 'bg-gray-700 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c === 'all' ? '全コース' : c === 'online' ? 'オンライン' : '対面'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 一括選択 */}
      {visibleSelectableIds.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={() => toggleSelectAll(visibleSelectableIds)}
            className="rounded border-gray-300 focus:ring-[#384a8f]"
          />
          <span className="text-sm text-gray-600">
            表示中の対象（{visibleSelectableIds.length}件）をすべて選択
          </span>
        </div>
      )}

      {/* 一覧 */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400">該当する空き待ちはありません</div>
        ) : (
          filtered.map((row) => {
            const meta = STATUS_LABELS[row.status]
            const StatusIcon = meta.icon
            const courseColor = row.course_type === 'online' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
            const selectable = row.status === 'waiting' || row.status === 'invited'
            return (
              <div key={row.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3 flex-wrap">
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="mt-1 rounded border-gray-300 focus:ring-[#384a8f]"
                    />
                  )}

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${courseColor}`}>
                        {row.course_type === 'online' ? 'オンライン' : '対面'}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium ${meta.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      <h3 className="font-bold text-gray-800">{row.full_name}</h3>
                      <span className="text-xs text-gray-500">（{row.furigana}）</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        {row.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        {row.phone}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                        {row.birthdate}
                      </span>
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">〒{row.postal_code} {row.address}</span>
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>きっかけ: {row.referral_source}{row.referral_detail ? `（${row.referral_detail}）` : ''}</span>
                      <span>登録: {formatDateTime(row.created_at)}</span>
                      {row.invite_sent_at && (
                        <span>招待送信: {formatDateTime(row.invite_sent_at)}</span>
                      )}
                      {row.invite_expires_at && (
                        <span>有効期限: {formatDateTime(row.invite_expires_at)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {selectable && (
                      <button
                        onClick={() => sendInvite([row.id])}
                        disabled={sending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {row.status === 'invited' ? '再送信' : '招待送信'}
                      </button>
                    )}
                    {row.status !== 'converted' && row.status !== 'cancelled' && (
                      <button
                        onClick={() => cancelRow(row)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="無効化"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
