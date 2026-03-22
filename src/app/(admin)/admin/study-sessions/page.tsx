'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CalendarDays, Plus, Trash2, Users, CheckCircle2, XCircle, Clock, Video, MapPin } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { StudySession, StudySessionAttendance, User } from '@/types/database'

export default function AdminStudySessionsPage() {
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [attendanceMap, setAttendanceMap] = useState<Record<string, (StudySessionAttendance & { user?: User })[]>>({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', session_date: '', session_time: '',
    location: '', zoom_url: '', is_online: false, description: '',
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()

    const { data: sessionsData } = await supabase
      .from('study_sessions').select('*').order('session_date', { ascending: false })
    if (sessionsData) setSessions(sessionsData)

    // 出欠情報
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    await supabase.from('study_sessions').insert({
      title: form.title,
      session_date: form.session_date,
      session_time: form.session_time || null,
      location: form.location || null,
      zoom_url: form.zoom_url || null,
      is_online: form.is_online,
      description: form.description || null,
    })
    setShowForm(false)
    setForm({ title: '', session_date: '', session_time: '', location: '', zoom_url: '', is_online: false, description: '' })
    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('この勉強会を削除しますか？')) return
    const supabase = createClient()
    await supabase.from('study_sessions').delete().eq('id', id)
    fetchData()
  }

  async function triggerReminders() {
    try {
      await fetch('/api/reminders', { method: 'POST' })
      alert('リマインダーを送信しました')
    } catch {
      alert('リマインダー送信に失敗しました')
    }
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">勉強会管理</h1>
        <div className="flex gap-2">
          <button onClick={triggerReminders}
            className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors">
            リマインド送信
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors">
            <Plus className="w-4 h-4" /> 新規作成
          </button>
        </div>
      </div>

      {/* 作成フォーム */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
              <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg" placeholder="例: 第12回勉強会" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日時 *</label>
              <input type="datetime-local" required value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">場所</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg" placeholder="会場名" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zoom URL</label>
              <input type="url" value={form.zoom_url} onChange={(e) => setForm({ ...form, zoom_url: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg" placeholder="https://zoom.us/..." />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_online" checked={form.is_online} onChange={(e) => setForm({ ...form, is_online: e.target.checked })} />
            <label htmlFor="is_online" className="text-sm text-gray-700">オンライン勉強会</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-[#384a8f] text-white rounded-lg font-medium">作成</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg">キャンセル</button>
          </div>
        </form>
      )}

      {/* 勉強会一覧 */}
      <div className="space-y-4">
        {sessions.map((session) => {
          const attendance = attendanceMap[session.id] || []
          const attending = attendance.filter(a => a.status === 'attending')
          const absent = attendance.filter(a => a.status === 'absent')
          const pending = attendance.filter(a => a.status === 'pending')
          const isPast = new Date(session.session_date) < new Date()

          return (
            <div key={session.id} className={`bg-white rounded-xl p-6 shadow-sm ${isPast ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800 text-lg">{session.title}</h3>
                    {session.is_online && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">オンライン</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" />{formatDate(session.session_date)}</span>
                    {session.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{session.location}</span>}
                    {session.zoom_url && <span className="flex items-center gap-1"><Video className="w-4 h-4" />Zoom設定済み</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(session.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* 出欠状況 */}
              <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">出席</span>
                  </div>
                  <p className="text-xl font-bold text-gray-800">{attending.length}</p>
                  <div className="mt-1 text-xs text-gray-500">
                    {attending.map(a => a.user?.full_name).filter(Boolean).join(', ')}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">欠席</span>
                  </div>
                  <p className="text-xl font-bold text-gray-800">{absent.length}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">未回答</span>
                  </div>
                  <p className="text-xl font-bold text-gray-800">{pending.length}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
