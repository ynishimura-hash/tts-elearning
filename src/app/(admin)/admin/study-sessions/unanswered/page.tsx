'use client'

/**
 * 未回答ダッシュボード
 *
 * 今後の勉強会（対面・オンライン）を1画面に集約し、各勉強会の「未回答者」を
 * 把握 → その場で催促（LINE）できるようにする横断ビュー。
 * 通知オフ（study_notify_enabled=false）の会員は未回答に数えず「通知対象外」として別表示。
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDateWithWeekday, isPastSession } from '@/lib/utils'
import type { StudySession, User } from '@/types/database'
import { ArrowLeft, CalendarDays, Send, Bell, CheckCircle2, MapPin, Video } from 'lucide-react'

type RosterUser = Pick<
  User,
  'id' | 'full_name' | 'is_online' | 'is_admin' | 'is_test' | 'is_free_user' | 'study_notify_enabled'
>
interface AttendanceRow {
  user_id: string
  session_id: string
  status: string
}

export default function UnansweredDashboardPage() {
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [users, setUsers] = useState<RosterUser[]>([])
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, { ok: boolean; text: string }>>({})

  useEffect(() => {
    void fetchData()
  }, [])

  async function fetchData() {
    const supabase = createClient()
    const [s, a, u] = await Promise.all([
      supabase.from('study_sessions').select('*').order('session_date', { ascending: true }),
      supabase.from('study_session_attendance').select('user_id, session_id, status'),
      supabase
        .from('users')
        .select('id, full_name, is_online, is_admin, is_test, is_free_user, study_notify_enabled'),
    ])
    if (s.data) setSessions(s.data)
    if (a.data) setAttendance(a.data as AttendanceRow[])
    if (u.data) setUsers(u.data as RosterUser[])
    setLoading(false)
  }

  /** セッションの種別上の対象者（admin/test/free除外） */
  function targetsOf(session: StudySession): RosterUser[] {
    return users.filter((usr) => {
      if (usr.is_admin || usr.is_test || usr.is_free_user) return false
      return session.is_online ? usr.is_online : !usr.is_online
    })
  }

  /** 未回答（通知対象・status=pending or レコード無し）と 通知対象外 を返す */
  function split(session: StudySession) {
    const recs = attendance.filter((r) => r.session_id === session.id)
    const statusByUser = new Map(recs.map((r) => [r.user_id, r.status]))
    const targets = targetsOf(session)
    const pending: RosterUser[] = []
    const optedOut: RosterUser[] = []
    for (const usr of targets) {
      if (usr.study_notify_enabled === false) {
        optedOut.push(usr)
        continue
      }
      const status = statusByUser.get(usr.id) ?? 'pending'
      if (status === 'pending') pending.push(usr)
    }
    pending.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ja'))
    optedOut.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ja'))
    return { pending, optedOut }
  }

  async function sendReminder(session: StudySession) {
    if (!confirm(`「${session.title}」の未回答者にLINEで催促を送信しますか？`)) return
    setSending(session.id)
    setResult((prev) => {
      const next = { ...prev }
      delete next[session.id]
      return next
    })
    try {
      const res = await fetch('/api/line/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, type: 'reminder' }),
      })
      const data = await res.json()
      if (data.success) {
        setResult((prev) => ({
          ...prev,
          [session.id]: { ok: true, text: `${data.sentCount ?? 0}名にLINE催促を送信しました（実際の着信もご確認ください）` },
        }))
      } else {
        setResult((prev) => ({
          ...prev,
          [session.id]: { ok: false, text: data.message || '送信に失敗しました' },
        }))
      }
    } catch {
      setResult((prev) => ({ ...prev, [session.id]: { ok: false, text: '通信エラーが発生しました' } }))
    } finally {
      setSending(null)
    }
  }

  const upcoming = sessions.filter((s) => !isPastSession(s.session_date))

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-1">
        <Link
          href="/admin/study-sessions"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#384a8f]"
        >
          <ArrowLeft className="w-4 h-4" />
          勉強会管理
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-1 flex items-center gap-2">
        <Bell className="w-6 h-6 text-[#384a8f]" />
        未回答ダッシュボード
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        今後の勉強会で、まだ出欠を回答していない方の一覧です。通知オフの方は「通知対象外」として除いています。
      </p>

      {loading ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : upcoming.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
          今後の勉強会はありません。
        </div>
      ) : (
        <div className="space-y-4">
          {upcoming.map((session) => {
            const { pending, optedOut } = split(session)
            const res = result[session.id]
            return (
              <div key={session.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="font-bold text-gray-800">{session.title}</h2>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${session.is_online ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}
                      >
                        {session.is_online ? 'オンライン' : '対面'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {formatDateWithWeekday(session.session_date)}
                      </span>
                      {session.session_time && <span>{session.session_time}</span>}
                      {session.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {session.location}
                        </span>
                      )}
                      {session.zoom_url && (
                        <span className="flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" />
                          Zoom
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block text-sm font-bold px-2.5 py-1 rounded ${pending.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      未回答 {pending.length}名
                    </span>
                  </div>
                </div>

                {pending.length === 0 ? (
                  <p className="text-sm text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    通知対象の方は全員回答済みです。
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {pending.map((u) => (
                        <span
                          key={u.id}
                          className="text-xs bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded"
                        >
                          {u.full_name}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => sendReminder(session)}
                      disabled={sending !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#06C755] text-white hover:bg-[#05a548] disabled:opacity-40 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      {sending === session.id ? '送信中...' : `未回答 ${pending.length}名にLINE催促`}
                    </button>
                  </>
                )}

                {res && (
                  <p className={`mt-2 text-xs ${res.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{res.text}</p>
                )}

                {optedOut.length > 0 && (
                  <p className="mt-3 pt-3 border-t text-xs text-gray-400">
                    通知対象外（{optedOut.length}名）: {optedOut.map((u) => u.full_name).join('、')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
