'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { BookOpen, ChevronRight } from 'lucide-react'
import type { Course } from '@/types/database'

export default function OnlineCoursesPage() {
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
        .eq('is_online', true)
        .eq('is_free', false)
        .order('sort_order')

      if (data) setCourses(data)

      const { data: contents } = await supabase
        .from('contents')
        .select('id, course_id')
        .eq('is_online', true)

      if (contents) {
        const counts: Record<string, number> = {}
        contents.forEach(c => { counts[c.course_id] = (counts[c.course_id] || 0) + 1 })
        setContentCounts(counts)

        const contentIds = contents.map(c => c.id)
        const { data: progress } = await supabase
          .from('user_progress')
          .select('content_id')
          .eq('user_id', user!.id)
          .eq('completed', true)
          .in('content_id', contentIds)

        if (progress) {
          const contentToCourse: Record<string, string> = {}
          contents.forEach(c => { contentToCourse[c.id] = c.course_id })
          const pCounts: Record<string, number> = {}
          progress.forEach(p => {
            const cid = contentToCourse[p.content_id]
            if (cid) pCounts[cid] = (pCounts[cid] || 0) + 1
          })
          setProgressCounts(pCounts)
        }
      }
    }

    fetchData()
  }, [user])

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <h1 className="text-2xl font-bold text-gray-800">オンラインコース一覧</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((course) => {
          const total = contentCounts[course.id] || 0
          const done = progressCounts[course.id] || 0
          const percent = total > 0 ? Math.round((done / total) * 100) : 0

          return (
            <Link
              key={course.id}
              href={`/online/courses/${course.id}`}
              className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
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
                  <div className="h-full bg-[#e39f3c] rounded-full transition-all" style={{ width: `${percent}%` }} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
