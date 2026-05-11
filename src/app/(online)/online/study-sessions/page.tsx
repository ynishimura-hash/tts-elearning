'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { CalendarDays, Video, MapPin, CheckCircle2, XCircle, Clock, HelpCircle, ExternalLink, Info, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate, formatDateWithWeekday } from '@/lib/utils'
import type { StudySession, StudySessionAttendance } from '@/types/database'

// 出欠締切: 開催日の 1 週間前 23:59
function getCutoff(sessionDate: string): Date {
  const d = new Date(sessionDate)
  d.setDate(d.getDate() - 7)
  d.setHours(23, 59, 59, 999)
  return d
}
function isCutoffPassed(sessionDate: string): boolean {
  return new Date() > getCutoff(sessionDate)
}

export default function OnlineStudySessionsPage() {
  const { user } = useUser()
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [attendance, setAttendance] = useState<Record<string, StudySessionAttendance>>({})

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      // テスターはリアル勉強会も取得
      const query = supabase.from('study_sessions').select('*').order('session_date')
      const { data: sessionsData } = user!.is_tester
        ? await query
        : await query.eq('is_online', true)
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
    const { error } = await supabase.from('study_session_attendance').upsert({
      session_id: sessionId, user_id: user.id, status,
      responded_at: new Date().toISOString(),
    }, { onConflict: 'session_id,user_id' })

    if (error) {
      toast.error('登録に失敗しました', { description: error.message })
      return
    }

    setAttendance(prev => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], session_id: sessionId, user_id: user.id, status, responded_at: new Date().toISOString() } as StudySessionAttendance,
    }))

    toast.success(
      status === 'attending' ? '「出席」で登録しました' : '「欠席」で登録しました',
      {
        description: status === 'attending'
          ? '当日のZoomURLは下に表示されています'
          : 'ご回答ありがとうございました',
      }
    )
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

  const [showAllPast, setShowAllPast] = useState(false)
  const [showAllPastOffline, setShowAllPastOffline] = useState(false)
  const now = new Date()
  // オンライン勉強会
  const onlineSessions = sessions.filter(s => s.is_online)
  const upcoming = onlineSessions.filter(s => new Date(s.session_date) >= now)
  const past = onlineSessions
    .filter(s => new Date(s.session_date) < now)
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
  const PAST_VISIBLE = 2
  const visiblePast = showAllPast ? past : past.slice(0, PAST_VISIBLE)
  const hiddenPastCount = Math.max(0, past.length - PAST_VISIBLE)
  // リアル勉強会（テスター限定で表示）
  const offlineSessions = sessions.filter(s => !s.is_online)
  const upcomingOffline = offlineSessions.filter(s => new Date(s.session_date) >= now)
  const pastOffline = offlineSessions
    .filter(s => new Date(s.session_date) < now)
    .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
  const visiblePastOffline = showAllPastOffline ? pastOffline : pastOffline.slice(0, PAST_VISIBLE)
  const hiddenPastOfflineCount = Math.max(0, pastOffline.length - PAST_VISIBLE)

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <Video className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">オンライン勉強会</h1>
      </div>

      {/* 説明バナー */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
        <div className="flex items-start gap-2">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 space-y-1.5">
            <p>
              <strong>オンライン勉強会の出欠回答について</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-amber-800">
              <li>出欠の<strong>締め切りは開催日の1週間前 23:59</strong>です</li>
              <li>締切までに回答がない場合は <strong>欠席扱い</strong> となります</li>
              <li>
                出席する場合で質問がある方は、
                <Link href="/online/questions" className="font-bold underline hover:text-amber-700">質問受付</Link>
                から事前に投稿してください。投稿された方から優先的に回答していきます
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">今後の勉強会</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-500">現在予定されている勉強会はありません</div>
        ) : (
          <div className="space-y-4">
            {upcoming.map((session) => {
              const att = attendance[session.id]
              const cutoffPassed = isCutoffPassed(session.session_date)
              const cutoff = getCutoff(session.session_date)
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
                    {/* 現在の回答ステータスバッジ */}
                    {att && (
                      <div className="mb-3 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium ${
                          att.status === 'attending' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {att.status === 'attending' ? (
                            <><CheckCircle2 className="w-4 h-4" /> 出席で登録済み</>
                          ) : (
                            <><XCircle className="w-4 h-4" /> 欠席で登録済み</>
                          )}
                        </span>
                      </div>
                    )}

                    <p className="text-sm font-medium text-gray-700 mb-1">出欠回答</p>
                    <p className="text-xs text-gray-500 mb-3">
                      締切: {formatDateWithWeekday(cutoff.toISOString())} 23:59
                    </p>

                    {cutoffPassed ? (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-sm text-gray-500">
                        <Clock className="w-4 h-4 inline mr-1" />
                        出欠の受付は締め切りました
                        {!att && <span className="ml-2 text-rose-600 font-medium">（欠席扱いとなります）</span>}
                      </div>
                    ) : (
                      <>
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
                            <HelpCircle className="w-3 h-3" /> まだ出欠を回答していません（締切までに未回答だと欠席扱い）
                          </p>
                        )}
                      </>
                    )}

                    {att && (
                      <>
                        <div className="mt-3">
                          <label className="text-xs text-gray-500 mb-1 block">備考（途中参加・遅刻等）</label>
                          <input
                            type="text"
                            placeholder="例：30分遅れて参加します"
                            defaultValue={att.notes || ''}
                            onBlur={(e) => handleNotesUpdate(session.id, e.target.value)}
                            disabled={cutoffPassed}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none disabled:bg-gray-50 disabled:text-gray-400"
                          />
                        </div>
                        {att.status === 'attending' && (
                          <div className="mt-3">
                            <Link href="/online/questions"
                              className="inline-flex items-center gap-1.5 text-sm text-[#384a8f] hover:underline">
                              <MessageSquare className="w-4 h-4" />
                              質問がある方は事前に投稿してください
                            </Link>
                          </div>
                        )}
                      </>
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
            {visiblePast.map((session) => (
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
          {hiddenPastCount > 0 && (
            <button
              onClick={() => setShowAllPast(v => !v)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#384a8f] hover:underline"
            >
              {showAllPast ? (
                <>表示を折りたたむ <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>過去の勉強会をすべて表示（あと{hiddenPastCount}件） <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      )}

      {/* リアル勉強会セクション（テスター限定） */}
      {user?.is_tester && offlineSessions.length > 0 && (
        <div className="pt-6 border-t-2 border-dashed border-gray-200 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-emerald-700">リアル勉強会</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">テスター限定</span>
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-800 mb-3">今後の勉強会</h3>
            {upcomingOffline.length === 0 ? (
              <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-500">現在予定されている勉強会はありません</div>
            ) : (
              <div className="space-y-4">
                {upcomingOffline.map((session) => {
                  const att = attendance[session.id]
                  return (
                    <div key={session.id} className="bg-white rounded-xl p-6 shadow-sm">
                      <div className="mb-4">
                        <h3 className="font-bold text-gray-800 text-lg">{session.title}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4" />{formatDateWithWeekday(session.session_date)}</span>
                          {session.session_time && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{session.session_time}</span>}
                          {session.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{session.location}</span>}
                        </div>
                      </div>
                      {session.description && <p className="text-gray-600 text-sm mb-4">{session.description}</p>}
                      <div className="border-t pt-4">
                        {att && (
                          <div className="mb-3 flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium ${
                              att.status === 'attending' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {att.status === 'attending' ? (
                                <><CheckCircle2 className="w-4 h-4" /> 出席で登録済み</>
                              ) : (
                                <><XCircle className="w-4 h-4" /> 欠席で登録済み</>
                              )}
                            </span>
                          </div>
                        )}
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

          {pastOffline.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-gray-800 mb-3">過去の勉強会</h3>
              <div className="space-y-3">
                {visiblePastOffline.map((session) => (
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
              {hiddenPastOfflineCount > 0 && (
                <button
                  onClick={() => setShowAllPastOffline(v => !v)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#384a8f] hover:underline"
                >
                  {showAllPastOffline ? (
                    <>表示を折りたたむ <ChevronUp className="w-4 h-4" /></>
                  ) : (
                    <>過去の勉強会をすべて表示（あと{hiddenPastOfflineCount}件） <ChevronDown className="w-4 h-4" /></>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
