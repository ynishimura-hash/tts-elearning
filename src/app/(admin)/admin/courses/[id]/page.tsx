'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Play, FileText } from 'lucide-react'
import type { Course, Content } from '@/types/database'

export default function AdminCourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [contents, setContents] = useState<Content[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function fetchData() {
      const { data: courseData } = await supabase.from('courses').select('*').eq('id', id).single()
      if (courseData) setCourse(courseData)

      const { data: contentsData } = await supabase.from('contents').select('*').eq('course_id', id).order('sort_order')
      if (contentsData) setContents(contentsData)
    }
    fetchData()
  }, [id])

  if (!course) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" /></div>

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <Link href="/admin/courses" className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
        <ArrowLeft className="w-4 h-4" /> コース一覧に戻る
      </Link>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{course.name}</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{contents.length}コンテンツ</span>
          {course.is_online && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">オンライン</span>}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b"><h2 className="text-lg font-bold text-gray-800">コンテンツ一覧</h2></div>
        <div className="divide-y">
          {contents.map((content, idx) => (
            <div key={content.id} className="flex items-center gap-4 p-4">
              <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{content.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {content.youtube_url && <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded"><Play className="w-3 h-3" /> 動画</span>}
                  {content.slide_url && <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded"><FileText className="w-3 h-3" /> スライド</span>}
                  {content.quiz_question && <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">小テスト</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
