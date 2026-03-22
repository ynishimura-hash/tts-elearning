'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { YouTubePlayer } from '@/components/YouTubePlayer'
import { ArrowLeft, Play, CheckCircle2, FileText, ChevronRight } from 'lucide-react'
import type { Course, Content } from '@/types/database'

export default function OnlineCourseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const [course, setCourse] = useState<Course | null>(null)
  const [contents, setContents] = useState<Content[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user || !id) return
    const supabase = createClient()

    async function fetchData() {
      const { data: courseData } = await supabase
        .from('courses').select('*').eq('id', id).single()
      if (courseData) setCourse(courseData)

      const { data: contentsData } = await supabase
        .from('contents').select('*').eq('course_id', id).order('sort_order')
      if (contentsData) setContents(contentsData)

      const { data: progress } = await supabase
        .from('user_progress').select('content_id').eq('user_id', user!.id).eq('completed', true)
      if (progress) setCompletedIds(new Set(progress.map(p => p.content_id)))
    }

    fetchData()
  }, [user, id])

  if (!course) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
    </div>
  }

  const completedCount = contents.filter(c => completedIds.has(c.id)).length
  const percent = contents.length > 0 ? Math.round((completedCount / contents.length) * 100) : 0

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <Link href="/online/courses" className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
        <ArrowLeft className="w-4 h-4" /> コース一覧に戻る
      </Link>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{course.name}</h1>
        {course.description && <p className="text-gray-600 mb-4">{course.description}</p>}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{contents.length}コンテンツ</span>
          <span>進捗 {percent}%</span>
        </div>
        <div className="mt-3 w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#e39f3c] rounded-full transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {course.video_url && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">コース説明動画</h2>
          <YouTubePlayer url={course.video_url} title={course.name} />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="text-lg font-bold text-gray-800">コンテンツ一覧</h2>
        </div>
        <div className="divide-y">
          {contents.map((content, index) => {
            const isCompleted = completedIds.has(content.id)
            return (
              <Link
                key={content.id}
                href={`/online/courses/${id}/contents/${content.id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-5 h-5 text-green-600" /> :
                    <span className="text-sm font-medium text-gray-500">{index + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isCompleted ? 'text-gray-500' : 'text-gray-800'}`}>
                    {content.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {content.youtube_url && <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded"><Play className="w-3 h-3" /> 動画</span>}
                    {content.slide_url && <span className="inline-flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded"><FileText className="w-3 h-3" /> スライド</span>}
                    {content.quiz_question && <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">小テスト</span>}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
