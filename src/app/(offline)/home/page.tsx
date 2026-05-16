'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { ProgressBar } from '@/components/ProgressBar'
import { BookOpen, CalendarDays, TrendingUp, Bell, ChevronRight, CheckCircle2, XCircle, Clock, MapPin, AlertCircle } from 'lucide-react'
import { formatDate, formatDateWithWeekday, daysSince } from '@/lib/utils'
import { PieChart, Pie, ResponsiveContainer } from 'recharts'
import type { Course, StudySession, StudySessionAttendance, Announcement } from '@/types/database'

const CHART_COLORS = ['#384a8f', '#e39f3c', '#22c55e', '#8b5cf6', '#ef4444', '#06b6d4', '#f59e0b', '#ec4899']

export default function HomePage() {
  const { user, loading: userLoading } = useUser()
  const [courses, setCourses] = useState<Course[]>([])
  const [nextSession, setNextSession] = useState<StudySession | null>(null)
  const [nextAttendance, setNextAttendance] = useState<StudySessionAttendance | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [hasMoreAnnouncements, setHasMoreAnnouncements] = useState(false)
  const [totalContents, setTotalContents] = useState(0)
  const [completedContents, setCompletedContents] = useState(0)
  const [courseProgress, setCourseProgress] = useState<{ name: string; done: number; total: number }[]>([])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      // コース取得（対面用）
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('is_online', false)
        .eq('is_free', false)
        .order('sort_order')

      if (coursesData) {
        const elapsed = daysSince(user!.account_issued_at)
        const filtered = coursesData.filter(c => {
          if (c.is_2nd_year && elapsed < 365) return false
          if (c.is_3rd_year && elapsed < 730) return false
          return c.viewable_after_days <= elapsed
        })
        setCourses(filtered)
      }

      // 次の勉強会
      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('is_online', false)
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

      // お知らせ
      const { data: anns } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_online', false)
        .order('created_at', { ascending: false })
        .limit(4)

      if (anns) {
        setAnnouncements(anns.slice(0, 3))
        setHasMoreAnnouncements(anns.length > 3)
      }

      // 進捗
      const { count: total } = await supabase
        .from('contents')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', false)

      const { count: completed } = await supabase
        .from('user_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('completed', true)

      setTotalContents(total || 0)
      setCompletedContents(completed || 0)

      // コースごとの進捗
      if (coursesData) {
        const { data: allContents } = await supabase
          .from('contents')
          .select('id, course_id')
          .eq('is_online', false)

        const { data: userProgress } = await supabase
          .from('user_progress')
          .select('content_id')
          .eq('user_id', user!.id)
          .eq('completed', true)

        const completedSet = new Set(userProgress?.map(p => p.content_id) || [])

        if (allContents) {
          const progress = coursesData.map(course => {
            const courseContents = allContents.filter(c => c.course_id === course.id)
            const done = courseContents.filter(c => completedSet.has(c.id)).length
            return { name: course.name, done, total: courseContents.length }
          }).filter(p => p.total > 0)
          setCourseProgress(progress)
        }
      }
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
      {/* ヒーローバナー */}
      <div className="relative rounded-2xl overflow-hidden">
        <img src="/hero-banner.png" alt="TTS" className="w-full object-contain" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              おかえりなさい、{user?.full_name || user?.username}さん
            </h1>
            <p className="text-white/80 text-sm">
              受講開始から {daysSince(user?.account_issued_at || null)} 日目
              {user?.is_debuted && ' ・ デビュー済み'}
            </p>
          </div>
        </div>
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
              <p className="text-sm text-gray-500">次の勉強会</p>
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

              {/* 出席者のみ場所を表示 */}
              {nextAttendance?.status === 'attending' && nextSession.location && (
                <p className="mt-2 text-xs text-gray-700 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-700" />{nextSession.location}
                </p>
              )}

              <Link href="/study-sessions" className="mt-2 ml-2 inline-flex items-center text-xs text-[#384a8f] hover:underline">
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

      {/* お知らせ */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#384a8f]">
              <Bell className="w-5 h-5" />
              お知らせ
            </h2>
            {hasMoreAnnouncements && (
              <Link href="/announcements" className="text-sm text-[#384a8f] hover:underline">
                すべて見る
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {announcements.map((ann) => {
              const Wrapper = ann.link_url ? 'a' : Link
              const wrapperProps = ann.link_url
                ? { href: ann.link_url, target: '_blank', rel: 'noopener noreferrer' }
                : { href: '/study-sessions' }

              return (
                <Wrapper
                  key={ann.id}
                  {...(wrapperProps as any)}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-gray-800">{ann.title}</p>
                    <p className="text-sm text-gray-500">{formatDate(ann.created_at)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Wrapper>
              )
            })}
          </div>
        </div>
      )}

      {/* コース進捗 + コース一覧 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左: 進捗円グラフ */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">学習進捗</h2>
            <div className="relative w-40 h-40 mx-auto mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ name: '完了', value: completedContents, fill: '#384a8f' }]}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={65}
                    startAngle={90} endAngle={90 - (completedContents / Math.max(totalContents, 1)) * 360}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={false}
                  />
                  <Pie
                    data={[{ name: 'bg', value: 1, fill: '#e5e7eb' }]}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={65}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={false}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-[#384a8f]">
                  {totalContents > 0 ? Math.round((completedContents / totalContents) * 100) : 0}%
                </span>
                <span className="text-xs text-gray-400">全体進捗</span>
              </div>
            </div>

            {/* コースごとの進捗バー */}
            <div className="space-y-3">
              {courseProgress.map((cp, i) => {
                const pct = cp.total > 0 ? Math.round((cp.done / cp.total) * 100) : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-600 truncate mr-2">{cp.name}</span>
                      <span className="text-gray-500 flex-shrink-0">{cp.done}/{cp.total}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 右: コース一覧 */}
        <div className="lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-800">コース一覧</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.slice(0, 6).map((course, i) => {
              const cp = courseProgress.find(p => p.name === course.name)
              const pct = cp && cp.total > 0 ? Math.round((cp.done / cp.total) * 100) : 0

              return (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${CHART_COLORS[i % CHART_COLORS.length]}15` }}>
                      <BookOpen className="w-6 h-6" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-800 truncate">{course.name}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0">{pct}%</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
