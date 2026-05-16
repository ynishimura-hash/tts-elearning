'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { ProgressBar } from '@/components/ProgressBar'
import { BookOpen, CalendarDays, TrendingUp, Bell, ChevronRight, Wifi, CheckCircle2, XCircle, Clock, Video, AlertCircle, ExternalLink, MapPin } from 'lucide-react'
import { formatDate, formatDateWithWeekday, daysSince } from '@/lib/utils'
import type { Course, StudySession, StudySessionAttendance, Announcement } from '@/types/database'

export default function OnlineHomePage() {
  const { user, loading: userLoading } = useUser()
  const [courses, setCourses] = useState<Course[]>([])
  const [nextSession, setNextSession] = useState<StudySession | null>(null)
  const [nextAttendance, setNextAttendance] = useState<StudySessionAttendance | null>(null)
  const [nextOfflineSession, setNextOfflineSession] = useState<StudySession | null>(null)
  const [nextOfflineAttendance, setNextOfflineAttendance] = useState<StudySessionAttendance | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [hasMoreAnnouncements, setHasMoreAnnouncements] = useState(false)
  const [totalContents, setTotalContents] = useState(0)
  const [completedContents, setCompletedContents] = useState(0)

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('is_online', true)
        .eq('is_free', false)
        .order('sort_order')

      if (coursesData) setCourses(coursesData)

      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('is_online', true)
        .gte('session_date', new Date().toISOString())
        .order('session_date')
        .limit(1)

      if (sessions?.[0]) {
        setNextSession(sessions[0])
        const { data: att } = await supabase
          .from('study_session_attendance')
          .select('*')
          .eq('session_id', sessions[0].id)
          .eq('user_id', user!.id)
          .maybeSingle()
        if (att) setNextAttendance(att)
      }

      // テスターは次のリアル勉強会も取得
      if (user!.is_tester) {
        const { data: offlineSessions } = await supabase
          .from('study_sessions')
          .select('*')
          .eq('is_online', false)
          .gte('session_date', new Date().toISOString())
          .order('session_date')
          .limit(1)

        if (offlineSessions?.[0]) {
          setNextOfflineSession(offlineSessions[0])
          const { data: offAtt } = await supabase
            .from('study_session_attendance')
            .select('*')
            .eq('session_id', offlineSessions[0].id)
            .eq('user_id', user!.id)
            .maybeSingle()
          if (offAtt) setNextOfflineAttendance(offAtt)
        }
      }

      const { data: anns } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_online', true)
        .order('created_at', { ascending: false })
        .limit(4)

      if (anns) {
        setAnnouncements(anns.slice(0, 3))
        setHasMoreAnnouncements(anns.length > 3)
      }

      const { count: total } = await supabase
        .from('contents')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true)

      const { count: completed } = await supabase
        .from('user_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('completed', true)

      setTotalContents(total || 0)
      setCompletedContents(completed || 0)
    }

    fetchData()
  }, [user])

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-[#384a8f] to-[#4a5ea8] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Wifi className="w-4 h-4 text-[#e39f3c]" />
          <span className="text-sm text-[#e39f3c] font-medium">オンライン受講</span>
        </div>
        <h1 className="text-2xl font-bold">
          おかえりなさい、{user?.full_name || user?.username}さん
        </h1>
        <p className="text-white/70 text-sm mt-1">
          受講開始から {daysSince(user?.account_issued_at || null)} 日目
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#384a8f]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">学習進捗</p>
              <p className="text-xl font-bold text-[#384a8f]">{completedContents}/{totalContents}</p>
            </div>
          </div>
          <ProgressBar value={completedContents} max={totalContents} />
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-5 h-5 text-[#e39f3c]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">次のオンライン勉強会</p>
              <p className="text-sm font-bold">
                {nextSession ? formatDateWithWeekday(nextSession.session_date) : '未定'}
              </p>
              {nextSession?.session_time && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />{nextSession.session_time}
                </p>
              )}
            </div>
          </div>
          {nextSession && (
            <>
              {/* ステータスバッジ */}
              {!nextAttendance ? (
                <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 font-medium">
                  <AlertCircle className="w-3 h-3" />未回答
                </div>
              ) : nextAttendance.status === 'attending' ? (
                <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-medium">
                  <CheckCircle2 className="w-3 h-3" />出席で登録済み
                </div>
              ) : (
                <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium">
                  <XCircle className="w-3 h-3" />欠席で登録済み
                </div>
              )}

              {/* 出席者のみZoom URLを表示 */}
              {nextAttendance?.status === 'attending' && nextSession.zoom_url && (
                <a
                  href={nextSession.zoom_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-[#384a8f] hover:underline"
                >
                  <Video className="w-3 h-3" />Zoomで参加 <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <Link href="/online/study-sessions" className="mt-2 ml-2 inline-flex items-center text-xs text-[#384a8f] hover:underline">
                {nextAttendance ? '変更する' : '出欠を回答する'} <ChevronRight className="w-3 h-3" />
              </Link>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">最後に学習したコンテンツ</p>
              <p className="text-sm font-bold truncate">{user?.last_content || '未開始'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* テスター限定: 次のリアル勉強会カード */}
      {user?.is_tester && nextOfflineSession && (
        <div className="bg-white rounded-xl p-5 shadow-sm border-2 border-emerald-200">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-gray-500">次のリアル勉強会</p>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">テスター限定</span>
              </div>
              <p className="text-sm font-bold">{formatDateWithWeekday(nextOfflineSession.session_date)}</p>
              <div className="flex flex-wrap items-center gap-3 mt-0.5">
                {nextOfflineSession.session_time && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{nextOfflineSession.session_time}
                  </p>
                )}
                {nextOfflineSession.location && (
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{nextOfflineSession.location}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ステータスバッジ */}
          {!nextOfflineAttendance ? (
            <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 font-medium">
              <AlertCircle className="w-3 h-3" />未回答
            </div>
          ) : nextOfflineAttendance.status === 'attending' ? (
            <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-medium">
              <CheckCircle2 className="w-3 h-3" />出席で登録済み
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium">
              <XCircle className="w-3 h-3" />欠席で登録済み
            </div>
          )}

          <Link href="/online/study-sessions" className="mt-2 ml-2 inline-flex items-center text-xs text-[#384a8f] hover:underline">
            {nextOfflineAttendance ? '変更する' : '出欠を回答する'} <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* お知らせ */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#384a8f]">
              <Bell className="w-5 h-5" />
              お知らせ
            </h2>
            {hasMoreAnnouncements && (
              <Link href="/online/announcements" className="text-sm text-[#384a8f] hover:underline">
                すべて見る
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {announcements.map((ann) => (
              <a
                key={ann.id}
                href={ann.link_url || '#'}
                target={ann.link_url ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-800">{ann.title}</p>
                  <p className="text-sm text-gray-500">{formatDate(ann.created_at)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* コース一覧 */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-800">コース一覧</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.slice(0, 6).map((course) => (
            <Link
              key={course.id}
              href={`/online/courses/${course.id}`}
              className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-[#384a8f]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-[#384a8f]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-800 truncate">{course.name}</h3>
                  {course.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{course.description}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
