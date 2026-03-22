'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, Plus, ChevronRight, Edit } from 'lucide-react'
import type { Course } from '@/types/database'

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [contentCounts, setContentCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const supabase = createClient()

    async function fetchData() {
      const { data } = await supabase.from('courses').select('*').order('sort_order')
      if (data) setCourses(data)

      const { data: contents } = await supabase.from('contents').select('id, course_id')
      if (contents) {
        const counts: Record<string, number> = {}
        contents.forEach(c => { counts[c.course_id] = (counts[c.course_id] || 0) + 1 })
        setContentCounts(counts)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">コース管理</h1>
      </div>
      <div className="space-y-3">
        {courses.map((course) => (
          <Link key={course.id} href={`/admin/courses/${course.id}`}
            className="flex items-center justify-between bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#384a8f]" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{course.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{contentCounts[course.id] || 0}コンテンツ</span>
                  {course.is_online && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">オンライン</span>}
                  {course.is_free && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">無料</span>}
                  {course.is_2nd_year && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs">2年目</span>}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        ))}
      </div>
    </div>
  )
}
