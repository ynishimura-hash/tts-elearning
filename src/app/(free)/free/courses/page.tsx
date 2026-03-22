'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { YouTubePlayer } from '@/components/YouTubePlayer'
import { FileText } from 'lucide-react'
import type { Course, Content } from '@/types/database'

function FreeCoursesContent() {
  const searchParams = useSearchParams()
  const courseId = searchParams.get('courseId')
  const [courses, setCourses] = useState<Course[]>([])
  const [contents, setContents] = useState<Content[]>([])
  const [selectedContent, setSelectedContent] = useState<Content | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchData() {
      const { data: coursesData } = await supabase.from('courses').select('*').eq('is_free', true).order('sort_order')
      if (coursesData) setCourses(coursesData)

      if (courseId) {
        const { data: contentsData } = await supabase.from('contents').select('*').eq('course_id', courseId).order('sort_order')
        if (contentsData) {
          setContents(contentsData)
          if (contentsData.length > 0) setSelectedContent(contentsData[0])
        }
      }
    }
    fetchData()
  }, [courseId])

  if (!courseId) {
    return (
      <div className="space-y-6 pt-12 lg:pt-0">
        <h1 className="text-2xl font-bold text-gray-800">無料コース</h1>
        <p className="text-gray-500">左のメニューからコースを選択してください</p>
      </div>
    )
  }

  const course = courses.find(c => c.id === courseId)

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <h1 className="text-2xl font-bold text-gray-800">{course?.name || '無料コース'}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-bold text-gray-800">コンテンツ一覧</h2>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {contents.map((content, idx) => (
              <button key={content.id} onClick={() => setSelectedContent(content)}
                className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                  selectedContent?.id === content.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}>
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">{idx + 1}</span>
                <span className="text-sm truncate">{content.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedContent ? (
            <>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-800 mb-4">{selectedContent.name}</h2>
                {selectedContent.youtube_url && <YouTubePlayer url={selectedContent.youtube_url} title={selectedContent.name} />}
              </div>
              {selectedContent.slide_url && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><FileText className="w-5 h-5" /> スライド</h3>
                  <iframe src={selectedContent.slide_url} className="w-full h-[400px] border rounded-lg" title="スライド" />
                </div>
              )}
              {selectedContent.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">{selectedContent.notes}</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
              左のリストからコンテンツを選択してください
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FreeCoursesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" /></div>}>
      <FreeCoursesContent />
    </Suspense>
  )
}
