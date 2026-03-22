'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { BookOpen, Gift } from 'lucide-react'
import type { Course } from '@/types/database'

export default function FreeHomePage() {
  const { user } = useUser()
  const [courses, setCourses] = useState<Course[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('courses').select('*').eq('is_free', true).order('sort_order')
      .then(({ data }) => { if (data) setCourses(data) })
  }, [])

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="bg-gradient-to-r from-[#384a8f] to-[#4a5ea8] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-4 h-4 text-[#e39f3c]" />
          <span className="text-sm text-[#e39f3c] font-medium">無料特典</span>
        </div>
        <h1 className="text-2xl font-bold">ようこそ、{user?.full_name}さん</h1>
        <p className="text-white/70 text-sm mt-1">無料特典コンテンツをお楽しみください</p>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">無料コース一覧</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => (
            <Link key={course.id} href={`/free/courses?courseId=${course.id}`}
              className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-[#384a8f]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-[#384a8f]" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{course.name}</h3>
                  {course.description && <p className="text-sm text-gray-500 mt-1">{course.description}</p>}
                </div>
              </div>
            </Link>
          ))}
          {courses.length === 0 && (
            <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500 col-span-2">
              無料コースはありません
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
