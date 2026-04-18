'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Plus, Trash2, CheckCircle2, XCircle, Clock, Video, MapPin, Edit, Save, X, Send, Bell, Copy } from 'lucide-react'
import { formatDate, formatDateWithWeekday } from '@/lib/utils'
import type { StudySession, StudySessionAttendance, User } from '@/types/database'

export default function AdminStudySessionsPage() {
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, (StudySessionAttendance & { user?: User })[]>>({})
  const [filter, setFilter] = useState<'all' | 'online' | 'offline' | 'upcoming' | 'past'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', session_date: '', session_time: '',
    location: '', zoom_url: '', is_online: false, description: '',
    max_participants: '',
  })
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()

    const { data: sessionsData } = await supabase
      .from('study_sessions').select('*').order('session_date', { ascending: false })
    if (sessionsData) setSessions(sessionsData)

    const { data: allAttendance } = await supabase
      .from('study_session_attendance').select('*')
    const { data: allUsers } = await supabase
      .from('users').select('id, full_name, email, is_online')

    if (allAttendance && allUsers) {
      const userMap: Record<string, User> = {}
      allUsers.forEach(u => { userMap[u.id] = u as User })

      const map: Record<string, (StudySessionAttendance & { user?: User })[]> = {}
      allAttendance.forEach(a => {
        if (!map[a.session_id]) map[a.session_id] = []
        map[a.session_id].push({ ...a, user: userMap[a.user_id] })
      })
      setAttendanceMap(map)
    }
  }

  function startNew() {
    setEditingId(null)
    setForm({ title: '', session_date: '', session_time: '', location: '', zoom_url: '', is_online: false, description: '', max_participants: '' })
    setShowForm(true)
  }

  function startEdit(session: StudySession) {
    setEditingId(session.id)
    setForm({
      title: session.title,
      session_date: session.session_date ? new Date(session.session_date).toISOString().slice(0, 10) : '',
      session_time: session.session_time || '',
      location: session.location || '',
      zoom_url: session.zoom_url || '',
      is_online: session.is_online,
      description: session.description || '',
      max_participants: session.max_participants ? String(session.max_participants) : '',
    })
    setShowForm(true)
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
  }

  function startDuplicate(session: StudySession) {
    setEditingId(null)  // 新規作成扱い
    setForm({
      title: session.title + '（コピー）',
      session_date: '',  // 日付は再入力
      session_time: session.session_time || '',
      location: session.location || '',
      zoom_url: session.zoom_url || '',
      is_online: session.is_online,
      description: session.description || '',
      max_participants: session.max_participants ? String(session.max_participants) : '',
    })
    setShowForm(true)
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const payload = {
      title: form.title,
      session_date: form.session_date,
      session_time: form.session_time || null,
      location: form.location || null,
      zoom_url: form.zoom_url || null,
      is_online: form.is_online,
      description: form.description || null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
    }

    if (editingId) {
      const { error } = await supabase.from('study_sessions').update(payload).eq('id', editingId)
      if (error) { alert('更新に失敗しました: ' + error.message); return }
    } else {
      const { error } = await supabase.from('study_sessions').insert(payload)
      if (error) { alert('作成に失敗しました: ' + error.message); return }
    }

    setShowForm(false)
    setEditingId(null)
    setForm({ title: '', session_date: '', session_time: '', location: '', zoom_url: '', is_online: false, description: '', max_participants: '' })
    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('この勉強会を削除しますか？')) return
    const supabase = createClient()
    await supabase.from('study_session_attendance').delete().eq('session_id', id)
    await supabase.from('study_sessions').delete().eq('id', id)
    fetchData()
  }

  const [sendingSession, setSendingSession] = useState<string | null>(null)

  async function sendAttendanceRequest(sessionId: string) {
    if (!confirm('出欠案内をLINEで送信しますか？')) return
    setSendingSession(sessionId)
    try {
      const res = await fetch('/api/line/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, type: 'request' }),
      })
      const data = await res.json()
      if (data.success) {
        alert(`出欠案内を${data.sentCount || 0}人に送信しました`)
        fetchData()
      } else {
        alert(data.message || '送信に失敗しました')
      }
    } catch {
      alert('送信に失敗しました。LINE設定を確認してください。')
    }
    setSendingSession(null)
  }

  async function sendReminder(sessionId: string) {
    if (!confirm('未回答者にリマインドを送信しますか？')) return
    setSendingSession(sessionId)
    try {
      const res = await fetch('/api/line/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, type: 'reminder' }),
      })
      const data = await res.json()
      if (data.success) {
        alert(`リマインドを${data.sentCount || 0}人に送信しました`)
      } else {
        alert(data.message || '送信に失敗しました')
      }
    } catch {
      alert('送信に失敗しました')
    }
    setSendingSession(null)
  }

  async function triggerReminders() {
    try {
      await fetch('/api/reminders', { method: 'POST' })
      alert('リマインダーを送信しました')
    } catch {
      alert('リマインダー送信に失敗しました')
    }
  }

  const filtered = sessions.filter(s => {
    const isPast = new Date(s.session_date) < new Date()
    if (filter === 'online' && !s.is_online) return false
    if (filter === 'offline' && s.is_online) return false
    if (filter === 'upcoming' && isPast) return false
    if (filter === 'past' && !isPast) return false
    return true
  })

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">勉強会管理</h1>
        <div className="flex gap-2">
          <button onClick={triggerReminders}
            className="px-4 py-2 bg-[#e39f3c] text-white rounded-lg text-sm font-medium hover:bg-[#d08f30] transition-colors">
            リマインド送信
          </button>
          <button onClick={startNew}
            className="flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors">
            <Plus className="w-4 h-4" /> 新規作成
          </button>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'upcoming', 'past', 'offline', 'online'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-[#384a8f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}>
            {{ all: 'すべて', upcoming: '今後', past: '過去', offline: '対面', online: 'オンライン' }[f]}
          </button>
        ))}
      </div>

      {/* 作成・編集フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">{editingId ? '勉強会編集' : '新規勉強会'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
                <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" placeholder="例: 第12回勉強会" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開催日 *</label>
                <input type="date" required value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" placeholder="会場名" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zoom URL</label>
                <input type="url" value={form.zoom_url} onChange={(e) => setForm({ ...form, zoom_url: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" placeholder="https://zoom.us/..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">時間帯</label>
                <input type="text" value={form.session_time} onChange={(e) => setForm({ ...form, session_time: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" placeholder="例: 19:00〜21:00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">定員</label>
                <input type="number" min={0} value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" placeholder="未設定で無制限" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="session_is_online" checked={form.is_online} onChange={(e) => setForm({ ...form, is_online: e.target.checked })}
                className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f]" />
              <label htmlFor="session_is_online" className="text-sm text-gray-700">オンライン勉強会</label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors">
                <Save className="w-4 h-4" /> {editingId ? '更新' : '作成'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 勉強会一覧 */}
      <div className="space-y-4">
        {filtered.map((session) => {
          const attendance = attendanceMap[session.id] || []
          const attending = attendance.filter(a => a.status === 'attending')
          const absent = attendance.filter(a => a.status === 'absent')
          const pending = attendance.filter(a => a.status === 'pending')
          const undecided = attendance.filter(a => a.status === 'undecided')
          const isPast = new Date(session.session_date) < new Date()
          const isExpanded = expandedSession === session.id

          return (
            <div key={session.id} className={`bg-white rounded-xl shadow-sm ${isPast ? 'opacity-60' : ''}`}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-gray-800 text-lg">{session.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded ${session.is_online ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                        {session.is_online ? 'オンライン' : '対面'}
                      </span>
                      {isPast && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">終了</span>}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" />{formatDateWithWeekday(session.session_date)}</span>
                      {session.session_time && <span className="text-gray-400">{session.session_time}</span>}
                      {session.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{session.location}</span>}
                      {session.zoom_url && <span className="flex items-center gap-1"><Video className="w-4 h-4" />Zoom設定済み</span>}
                      {session.max_participants && <span>定員: {session.max_participants}名</span>}
                    </div>
                    {session.description && <p className="text-sm text-gray-600 mt-2">{session.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isPast && (
                      <>
                        <button onClick={() => sendAttendanceRequest(session.id)}
                          disabled={sendingSession === session.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                          title="出欠案内をLINEで送信">
                          <Send className="w-3.5 h-3.5" />
                          {sendingSession === session.id ? '送信中...' : '出欠案内'}
                        </button>
                        {pending.length > 0 && (
                          <button onClick={() => sendReminder(session.id)}
                            disabled={sendingSession === session.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
                            title="未回答者に催促">
                            <Bell className="w-3.5 h-3.5" />
                            催促({pending.length})
                          </button>
                        )}
                      </>
                    )}
                    <button onClick={() => startEdit(session)}
                      className="p-2 text-[#384a8f] hover:bg-blue-50 rounded-lg transition-colors" title="編集">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => startDuplicate(session)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="複製">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(session.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 出欠状況サマリー */}
                <div className="grid grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">出席</span>
                    </div>
                    <p className="text-xl font-bold text-gray-800">{attending.length}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">欠席</span>
                    </div>
                    <p className="text-xl font-bold text-gray-800">{absent.length}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-yellow-600 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">未定</span>
                    </div>
                    <p className="text-xl font-bold text-gray-800">{undecided.length}</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">未回答</span>
                    </div>
                    <p className="text-xl font-bold text-gray-800">{pending.length}</p>
                  </div>
                </div>

                {/* 詳細展開 */}
                {attendance.length > 0 && (
                  <button onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                    className="mt-3 text-sm text-[#384a8f] hover:underline">
                    {isExpanded ? '出欠詳細を閉じる' : '出欠詳細を表示'}
                  </button>
                )}
              </div>

              {isExpanded && attendance.length > 0 && (
                <div className="border-t px-6 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase">
                        <th className="pb-2">名前</th>
                        <th className="pb-2">ステータス</th>
                        <th className="pb-2">備考</th>
                        <th className="pb-2">回答日</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attendance.map(a => (
                        <tr key={a.id}>
                          <td className="py-2 font-medium text-gray-800">{a.user?.full_name || '不明'}</td>
                          <td className="py-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              a.status === 'attending' ? 'bg-green-100 text-green-700' :
                              a.status === 'absent' ? 'bg-red-100 text-red-700' :
                              a.status === 'undecided' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {{ attending: '出席', absent: '欠席', undecided: '未定', pending: '未回答' }[a.status]}
                            </span>
                          </td>
                          <td className="py-2 text-gray-500 text-xs">{(a as any).notes || '-'}</td>
                          <td className="py-2 text-gray-500">{a.responded_at ? formatDate(a.responded_at) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">勉強会がありません</div>
        )}
      </div>
    </div>
  )
}
