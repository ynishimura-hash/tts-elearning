'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { CalendarDays, Video, CheckCircle2, XCircle, Clock, HelpCircle, ExternalLink } from 'lucide-react'
import { formatDate, formatDateWithWeekday } from '@/lib/utils'
import type { StudySession, StudySessionAttendance } from '@/types/database'

export default function OnlineStudySessionsPage() {
  const { user } = useUser()
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [attendance, setAttendance] = useState<Record<string, StudySessionAttendance>>({})

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      const { data: sessionsData } = await supabase
        .from('study_sessions').select('*').eq('is_online', true).order('session_date')
      if (sessionsData) setSessions(sessionsData)

      const { data: attendanceData } = await supabase
        .from('study_session_attendance').select('*').eq('user_id', user!.id)
      if (attendanceData) {
        const map: Record<string, StudySessionAttendance> = {}
        attendanceData.forEach(a => { map[a.session_id] = a })
        setAttendance(map)
      }
    }
    fetchData()
  }, [user])

  async function handleAttendance(sessionId: string, status: 'attending' | 'absent') {
    if (!user) return
    const supabase = createClient()
    await supabase.from('study_session_attendance').upsert({
      session_id: sessionId, user_id: user.id, status,
      responded_at: new Date().toISOString(),
    }, { onConflict: 'session_id,user_id' })

    setAttendance(prev => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], session_id: sessionId, user_id: user.id, status, responded_at: new Date().toISOString() } as StudySessionAttendance,
    }))
  }

  async function handleNotesUpdate(sessionId: string, notes: string) {
    if (!user) return
    const supabase = createClient()
    await supabase.from('study_session_attendance').update({ notes }).eq('session_id', sessionId).eq('user_id', user.id)
    setAttendance(prev => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], notes } as StudySessionAttendance,
    }))
  }

  const now = new Date()
  const upcoming = sessions.filter(s => new Date(s.session_date) >= now)
  const past = sessions.filter(s => new Date(s.session_date) < now)

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <Video className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">オンライン勉強会</h1>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">今後の勉強会</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-500">現在予定されている勉強会はありません</div>
        ) : (
          <div className="space-y-4">
            {upcoming.map((session) => {
              const att = attendance[session.id]
              return (
                <div key={session.id} className="bg-white rounded-xl p-6 shadow-sm">
                  <div className="mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">{session.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" />{formatDateWithWeekday(session.session_date)}</span>
                      {session.session_time && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{session.session_time}</span>}
                    </div>
                  </div>

                  {/* Zoom URL（出席回答者のみ表示） */}
                  {att?.status === 'attending' && session.zoom_url && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm font-medium text-blue-800 mb-1">Zoom ミーティングURL</p>
                      <a href={session.zoom_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#384a8f] hover:underline text-sm">
                        Zoomに参加する <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-gray-700 mb-3">出欠回答</p>
                    <div className="flex gap-3">
                      <button onClick={() => handleAttendance(session.id, 'attending')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                          att?.status === 'attending' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}>
                        <CheckCircle2 className="w-5 h-5" /> 出席
                      </button>
                      <button onClick={() => handleAttendance(session.id, 'absent')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                          att?.status === 'absent' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}>
                        <XCircle className="w-5 h-5" /> 欠席
                      </button>
                    </div>
                    {!att && (
                      <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" /> まだ出欠を回答していません
                      </p>
                    )}
                    {att && (
                      <div className="mt-3">
                        <label className="text-xs text-gray-500 mb-1 block">備考（途中参加・遅刻等）</label>
                        <input
                          type="text"
                          placeholder="例：30分遅れて参加します"
                          defaultValue={att.notes || ''}
                          onBlur={(e) => handleNotesUpdate(session.id, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-3">過去の勉強会</h2>
          <div className="space-y-3">
            {past.map((session) => (
              <div key={session.id} className="bg-white/60 rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-600">{session.title}</h3>
                    <p className="text-sm text-gray-400">{formatDateWithWeekday(session.session_date)}</p>
                  </div>
                  {attendance[session.id] && (
                    <span className={`text-sm px-2 py-1 rounded ${
                      attendance[session.id].status === 'attending' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>{attendance[session.id].status === 'attending' ? '出席' : '欠席'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
