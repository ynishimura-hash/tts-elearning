'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { BookOpen, Lock, ChevronRight, Download } from 'lucide-react'
import { daysSince } from '@/lib/utils'
import type { Course } from '@/types/database'

export default function CoursesPage() {
  const { user } = useUser()
  const [courses, setCourses] = useState<Course[]>([])
  const [contentCounts, setContentCounts] = useState<Record<string, number>>({})
  const [progressCounts, setProgressCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    async function fetchData() {
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('is_online', false)
        .eq('is_free', false)
        .order('sort_order')

      if (data) setCourses(data)

      // コースごとのコンテンツ数
      const { data: contents } = await supabase
        .from('contents')
        .select('id, course_id')
        .eq('is_online', false)

      if (contents) {
        const counts: Record<string, number> = {}
        contents.forEach(c => {
          counts[c.course_id] = (counts[c.course_id] || 0) + 1
        })
        setContentCounts(counts)

        // 進捗
        const contentIds = contents.map(c => c.id)
        const { data: progress } = await supabase
          .from('user_progress')
          .select('content_id')
          .eq('user_id', user!.id)
          .eq('completed', true)
          .in('content_id', contentIds)

        if (progress) {
          // content_idからcourse_idへマッピング
          const contentToCourse: Record<string, string> = {}
          contents.forEach(c => { contentToCourse[c.id] = c.course_id })

          const pCounts: Record<string, number> = {}
          progress.forEach(p => {
            const courseId = contentToCourse[p.content_id]
            if (courseId) pCounts[courseId] = (pCounts[courseId] || 0) + 1
          })
          setProgressCounts(pCounts)
        }
      }
    }

    fetchData()
  }, [user])

  const elapsed = daysSince(user?.account_issued_at || null)

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <h1 className="text-2xl font-bold text-gray-800">コース一覧</h1>

      {/* 1年目コース */}
      <div>
        <h2 className="text-lg font-bold text-[#384a8f] mb-3">1年目コース</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses
            .filter(c => !c.is_2nd_year && !c.is_3rd_year)
            .map((course) => {
              const locked = course.viewable_after_days > elapsed
              const total = contentCounts[course.id] || 0
              const done = progressCounts[course.id] || 0
              const percent = total > 0 ? Math.round((done / total) * 100) : 0

              return (
                <div key={course.id} className="relative">
                  {locked && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
                      <div className="text-center">
                        <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                          受講開始から{course.viewable_after_days}日後に解放されます
                        </p>
                      </div>
                    </div>
                  )}
                  <Link
                    href={locked ? '#' : `/courses/${course.id}`}
                    className="block bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-12 h-12 bg-[#384a8f]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-6 h-6 text-[#384a8f]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-800">{course.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{total}コンテンツ</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">進捗</span>
                        <span className="font-medium text-[#384a8f]">{percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#e39f3c] rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    {course.download_url && (
                      <div className="mt-3 flex items-center gap-1 text-sm text-[#384a8f]">
                        <Download className="w-4 h-4" />
                        資料ダウンロード
                      </div>
                    )}
                  </Link>
                </div>
              )
            })}
        </div>
      </div>

      {/* 2年目以降コース */}
      {courses.some(c => c.is_2nd_year) && (
        <div>
          <h2 className="text-lg font-bold text-[#384a8f] mb-3">2年目以降コース</h2>
          {elapsed < 365 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
              <p className="text-sm text-yellow-700">
                2年目以降のコースは、受講開始から1年経過後に閲覧可能になります（残り{365 - elapsed}日）
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.filter(c => c.is_2nd_year).map((course) => {
              const locked = elapsed < 365
              const total = contentCounts[course.id] || 0
              const done = progressCounts[course.id] || 0
              const percent = total > 0 ? Math.round((done / total) * 100) : 0

              return (
                <div key={course.id} className="relative">
                  {locked && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
                      <Lock className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <Link
                    href={locked ? '#' : `/courses/${course.id}`}
                    className="block bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-6 h-6 text-[#e39f3c]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{course.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{total}コンテンツ ・ {percent}%完了</p>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3年目以降コース */}
      {courses.some(c => c.is_3rd_year) && (
        <div>
          <h2 className="text-lg font-bold text-[#384a8f] mb-3">3年目以降コース</h2>
          {elapsed < 730 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
              <p className="text-sm text-yellow-700">
                3年目以降のコースは、受講開始から2年経過後に閲覧可能になります（残り{730 - elapsed}日）
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.filter(c => c.is_3rd_year).map((course) => {
              const locked = elapsed < 730
              return (
                <div key={course.id} className="relative">
                  {locked && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
                      <Lock className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <Link
                    href={locked ? '#' : `/courses/${course.id}`}
                    className="block bg-white rounded-xl p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{course.name}</h3>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
