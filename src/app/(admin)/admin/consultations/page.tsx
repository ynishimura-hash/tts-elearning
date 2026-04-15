'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarCheck, CheckCircle2, Clock, XCircle, MessageSquare, Send } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Consultation {
  id: string
  user_id: string
  preferred_dates: string[]
  message: string
  status: string
  scheduled_date: string | null
  admin_notes: string | null
  is_online: boolean
  plan: string | null
  payment_status: string | null
  created_at: string
  user?: { full_name: string; email: string }
}

const PLAN_LABEL: Record<string, string> = {
  '1h_22000': '1時間 22,000円',
  '3h_55000': '3時間パック 55,000円',
}

export default function AdminConsultationsPage() {
  const [items, setItems] = useState<Consultation[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'scheduled' | 'completed'>('all')
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase
      .from('consultations')
      .select('*, user:users(full_name, email)')
      .order('created_at', { ascending: false })
    if (data) setItems(data as Consultation[])
  }

  // 希望日時の中から1つ選んで確定
  async function scheduleDate(id: string, date: string) {
    if (!confirm(`この日時で確定しますか？\n${date}`)) return
    const supabase = createClient()
    await supabase.from('consultations').update({
      status: 'scheduled',
      scheduled_date: date,
    }).eq('id', id)
    fetchData()
  }

  // ステータス変更
  async function updateStatus(id: string, status: string) {
    const supabase = createClient()
    await supabase.from('consultations').update({ status }).eq('id', id)
    fetchData()
  }

  // 決済ステータス切替
  async function togglePayment(id: string, current: string | null) {
    const next = current === 'paid' ? 'unpaid' : 'paid'
    const supabase = createClient()
    await supabase.from('consultations').update({ payment_status: next }).eq('id', id)
    fetchData()
  }

  // 管理メモ保存
  async function saveNotes(id: string) {
    const notes = editingNotes[id]
    if (notes === undefined) return
    const supabase = createClient()
    await supabase.from('consultations').update({ admin_notes: notes }).eq('id', id)
    setEditingNotes(prev => { const n = { ...prev }; delete n[id]; return n })
    fetchData()
  }

  const filtered = items.filter(c => {
    if (filter === 'pending') return c.status === 'pending'
    if (filter === 'scheduled') return c.status === 'scheduled'
    if (filter === 'completed') return c.status === 'completed' || c.status === 'cancelled'
    return true
  })

  const pendingCount = items.filter(c => c.status === 'pending').length
  const scheduledCount = items.filter(c => c.status === 'scheduled').length

  const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    pending: { label: '未対応', color: 'bg-orange-100 text-orange-700', icon: Clock },
    scheduled: { label: '日程確定', color: 'bg-blue-100 text-blue-700', icon: CalendarCheck },
    completed: { label: '完了', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    cancelled: { label: 'キャンセル', color: 'bg-gray-100 text-gray-500', icon: XCircle },
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">個別相談管理</h1>
          {pendingCount > 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingCount}件未対応
            </span>
          )}
          {scheduledCount > 0 && (
            <span className="bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {scheduledCount}件予定あり
            </span>
          )}
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        {(['all', 'pending', 'scheduled', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-[#384a8f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}>
            {{ all: 'すべて', pending: '未対応', scheduled: '予定あり', completed: '完了・取消' }[f]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((c) => {
          const config = statusConfig[c.status] || statusConfig.pending
          const StatusIcon = config.icon
          const isEditing = editingNotes[c.id] !== undefined

          return (
            <div key={c.id} className={`bg-white rounded-xl shadow-sm overflow-hidden ${c.status === 'completed' || c.status === 'cancelled' ? 'opacity-60' : ''}`}>
              <div className="p-5">
                {/* ヘッダー */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-bold text-gray-800 text-lg">{(c.user as any)?.full_name || '不明'}</p>
                    <p className="text-xs text-gray-500">{(c.user as any)?.email} ・ 申込: {formatDate(c.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`text-xs px-2 py-0.5 rounded ${c.is_online ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {c.is_online ? 'オンライン' : '対面'}
                    </span>
                    {c.plan && (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        {PLAN_LABEL[c.plan] || c.plan}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => togglePayment(c.id, c.payment_status)}
                      className={`text-xs px-2 py-0.5 rounded hover:opacity-80 transition-opacity ${c.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                      title="クリックで決済ステータス切替">
                      決済: {c.payment_status === 'paid' ? '済' : '未確認'}
                    </button>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${config.color}`}>
                      <StatusIcon className="w-3 h-3" /> {config.label}
                    </span>
                  </div>
                </div>

                {/* 相談内容 */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">相談内容</p>
                  <p className="text-sm text-gray-700">{c.message}</p>
                </div>

                {/* 確定済みの場合 → 確定日時を表示 */}
                {c.scheduled_date && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-blue-800 flex items-center gap-1">
                      <CalendarCheck className="w-4 h-4" /> 確定日時: {c.scheduled_date}
                    </p>
                  </div>
                )}

                {/* 未対応の場合 → 希望日時から選んで確定 */}
                {c.status === 'pending' && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">希望日時から選んで確定:</p>
                    <div className="flex flex-wrap gap-2">
                      {c.preferred_dates.map((d, i) => (
                        <button key={i} onClick={() => scheduleDate(c.id, d)}
                          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-blue-300 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-500 transition-colors">
                          <CalendarCheck className="w-4 h-4" />
                          第{i + 1}希望: {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 管理メモ */}
                {(c.admin_notes || c.status !== 'pending') && (
                  <div className="mb-4">
                    {isEditing ? (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-500">管理メモ</label>
                        <textarea
                          value={editingNotes[c.id]}
                          onChange={(e) => setEditingNotes(prev => ({ ...prev, [c.id]: e.target.value }))}
                          rows={2}
                          placeholder="相談内容のメモ、フォローアップ事項など"
                          className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => saveNotes(c.id)}
                            className="px-3 py-1.5 bg-[#384a8f] text-white rounded-lg text-xs font-medium">保存</button>
                          <button onClick={() => setEditingNotes(prev => { const n = { ...prev }; delete n[c.id]; return n })}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs">キャンセル</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        {c.admin_notes ? (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1">管理メモ</p>
                            <p className="text-sm text-gray-600">{c.admin_notes}</p>
                          </div>
                        ) : null}
                        <button onClick={() => setEditingNotes(prev => ({ ...prev, [c.id]: c.admin_notes || '' }))}
                          className="text-xs text-[#384a8f] hover:underline flex-shrink-0">
                          {c.admin_notes ? '編集' : '＋メモ追加'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* アクションボタン */}
                <div className="flex gap-2 border-t pt-3">
                  {c.status === 'pending' && (
                    <button onClick={() => updateStatus(c.id, 'cancelled')}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">
                      キャンセル
                    </button>
                  )}
                  {c.status === 'scheduled' && (
                    <>
                      <button onClick={() => updateStatus(c.id, 'completed')}
                        className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 相談完了
                      </button>
                      <button onClick={() => updateStatus(c.id, 'pending')}
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">
                        日程再調整
                      </button>
                      <button onClick={() => updateStatus(c.id, 'cancelled')}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
                        キャンセル
                      </button>
                      {!isEditing && (
                        <button onClick={() => setEditingNotes(prev => ({ ...prev, [c.id]: c.admin_notes || '' }))}
                          className="ml-auto px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" /> メモ
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl p-8 text-center text-gray-400">
            {filter === 'pending' ? '未対応の相談はありません' :
             filter === 'scheduled' ? '予定ありの相談はありません' :
             '個別相談の申込はありません'}
          </div>
        )}
      </div>
    </div>
  )
}
