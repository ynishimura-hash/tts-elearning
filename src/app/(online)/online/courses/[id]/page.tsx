'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { YouTubePlayer } from '@/components/YouTubePlayer'
import { getYouTubeId } from '@/lib/utils'
import { ArrowLeft, Play, CheckCircle2, FileText, Clock } from 'lucide-react'
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
          <span>{completedCount}完了</span>
          <span className="font-medium text-[#384a8f]">{percent}%</span>
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

      {/* コンテンツ一覧 - サムネイルカード形式 */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">コンテンツ一覧</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contents.map((content, index) => {
            const isCompleted = completedIds.has(content.id)
            const hasQuiz = !!content.quiz_question
            const youtubeId = getYouTubeId(content.youtube_url)
            const thumbnailUrl = youtubeId
              ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
              : null

            return (
              <Link
                key={content.id}
                href={`/online/courses/${id}/contents/${content.id}`}
                className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5"
              >
                <div className="relative aspect-video bg-gray-100">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt={content.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#384a8f]/10 to-[#384a8f]/5">
                      <FileText className="w-10 h-10 text-[#384a8f]/30" />
                    </div>
                  )}
                  {content.youtube_url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-[#384a8f] ml-0.5" />
                      </div>
                    </div>
                  )}
                  {isCompleted && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded">
                    {index + 1}
                  </div>
                  {content.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />{content.duration}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug mb-2">{content.name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {content.youtube_url && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        <Play className="w-2.5 h-2.5" /> 動画
                      </span>
                    )}
                    {content.slide_url && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                        <FileText className="w-2.5 h-2.5" /> スライド
                      </span>
                    )}
                    {hasQuiz && (
                      <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">小テスト</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
