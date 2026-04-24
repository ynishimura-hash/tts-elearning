'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { YouTubePlayer } from '@/components/YouTubePlayer'
import { QuizModal } from '@/components/QuizModal'
import { getYouTubeId } from '@/lib/utils'
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileText,
  ExternalLink, AlertCircle, Play, PlayCircle, Menu, X, Clock
} from 'lucide-react'
import type { Content } from '@/types/database'

export default function OnlineContentViewPage() {
  const { id: courseId, contentId } = useParams<{ id: string; contentId: string }>()
  const router = useRouter()
  const { user } = useUser()
  const autoNavigateRef = useRef(false)
  const [content, setContent] = useState<Content | null>(null)
  const [allContents, setAllContents] = useState<Content[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState({ video: false, quiz: false, completed: false })
  const [showQuiz, setShowQuiz] = useState(false)
  const [nextContent, setNextContent] = useState<Content | null>(null)
  const [prevContent, setPrevContent] = useState<Content | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [courseName, setCourseName] = useState('')

  useEffect(() => {
    autoNavigateRef.current = false
    window.scrollTo(0, 0)
  }, [contentId])

  useEffect(() => {
    if (!user || !contentId) return
    const supabase = createClient()

    async function fetchData() {
      const { data: contentData } = await supabase
        .from('contents').select('*').eq('id', contentId).single()
      if (contentData) setContent(contentData)

      const { data: courseData } = await supabase
        .from('courses').select('name').eq('id', courseId).single()
      if (courseData) setCourseName(courseData.name)

      const { data: contents } = await supabase
        .from('contents').select('*').eq('course_id', courseId).order('sort_order')
      if (contents) {
        setAllContents(contents)
        const idx = contents.findIndex(c => c.id === contentId)
        setPrevContent(idx > 0 ? contents[idx - 1] : null)
        setNextContent(idx < contents.length - 1 ? contents[idx + 1] : null)
      }

      const { data: progressData } = await supabase
        .from('user_progress').select('*').eq('user_id', user!.id).eq('content_id', contentId).maybeSingle()
      if (progressData) {
        setProgress({ video: progressData.video_completed, quiz: progressData.quiz_completed, completed: progressData.completed })
      } else {
        setProgress({ video: false, quiz: false, completed: false })
      }

      const { data: allProgress } = await supabase
        .from('user_progress').select('content_id').eq('user_id', user!.id).eq('completed', true)
      if (allProgress) setCompletedIds(new Set(allProgress.map(p => p.content_id)))
    }
    fetchData()
  }, [user, contentId, courseId])

  const updateProgress = useCallback(async (field: 'video_completed' | 'quiz_completed') => {
    if (!user || !contentId) return
    const supabase = createClient()
    const newProgress = { ...progress, [field === 'video_completed' ? 'video' : 'quiz']: true }
    const hasQuiz = !!content?.quiz_question
    const allDone = newProgress.video && (!hasQuiz || newProgress.quiz)

    await supabase.from('user_progress').upsert({
      user_id: user.id, content_id: contentId,
      video_completed: newProgress.video, quiz_completed: newProgress.quiz,
      completed: allDone, completed_at: allDone ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,content_id' })

    setProgress({ ...newProgress, completed: allDone })
    if (allDone) setCompletedIds(prev => new Set([...prev, contentId]))
    await supabase.from('users').update({ last_content: content?.name }).eq('id', user.id)
  }, [user, contentId, content, progress])

  const handleVideoEnded = useCallback(async () => {
    if (autoNavigateRef.current) return
    autoNavigateRef.current = true
    if (!progress.video) {
      await updateProgress('video_completed')
    }
    // 自動遷移は廃止（次のコンテンツへは手動でクリック）
  }, [progress.video, updateProgress])

  if (!content) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
    </div>
  }

  const quizOptions = [content.quiz_option_1, content.quiz_option_2, content.quiz_option_3, content.quiz_option_4].filter(Boolean) as string[]
  const currentIndex = allContents.findIndex(c => c.id === contentId)

  return (
    <div className="flex h-[calc(100vh-0px)] lg:h-screen overflow-hidden -m-6 lg:m-0">
      {/* メインコンテンツエリア */}
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={`/online/courses/${courseId}`} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#384a8f] uppercase tracking-wider truncate">{courseName}</p>
              <h1 className="text-sm font-bold text-gray-800 truncate">{content.name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {progress.completed && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> 完了
              </span>
            )}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:block hidden">
              <Menu className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {content.youtube_url && (
          <YouTubePlayer
            url={content.youtube_url}
            title={content.name}
            onEnded={handleVideoEnded}
            autoplay
          />
        )}

        <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6 pb-24">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-800">{content.name}</h2>
            {!progress.video && content.youtube_url && (
              <button onClick={() => updateProgress('video_completed')}
                className="flex-shrink-0 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors">
                視聴完了
              </button>
            )}
            {progress.video && !progress.completed && (
              <span className="flex-shrink-0 text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> 視聴完了
              </span>
            )}
          </div>

          {content.notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">{content.notes}</p>
            </div>
          )}

          {content.slide_url && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText className="w-5 h-5 text-[#384a8f]" /> スライド資料</h3>
                <a href={content.slide_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
                  新しいタブで開く <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <iframe src={content.slide_url} className="w-full h-[500px] border rounded-lg" title="スライド" />
            </div>
          )}

          {content.pdf_url && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <a href={content.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#384a8f] hover:underline font-medium">
                <FileText className="w-5 h-5" /> PDF資料をダウンロード <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {content.quiz_question && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3">小テスト</h3>
              {progress.quiz ? (
                <p className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> 小テスト合格済み</p>
              ) : (
                <button onClick={() => setShowQuiz(true)} className="px-6 py-3 bg-[#e39f3c] text-white rounded-lg font-medium hover:bg-[#d08f2c] transition-colors">
                  小テストに挑戦する
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            {prevContent ? (
              <Link href={`/online/courses/${courseId}/contents/${prevContent.id}`} className="inline-flex items-center gap-2 text-sm text-[#384a8f] hover:underline max-w-[45%]">
                <ArrowLeft className="w-4 h-4 flex-shrink-0" /><span className="truncate">{prevContent.name}</span>
              </Link>
            ) : <div />}
            {nextContent ? (
              <Link href={`/online/courses/${courseId}/contents/${nextContent.id}`} className="inline-flex items-center gap-2 text-sm text-[#384a8f] hover:underline max-w-[45%] text-right">
                <span className="truncate">{nextContent.name}</span><ArrowRight className="w-4 h-4 flex-shrink-0" />
              </Link>
            ) : <div />}
          </div>
        </div>
      </main>

      {/* 右サイドバー */}
      {sidebarOpen && (
        <aside className="hidden lg:flex w-80 bg-white border-l flex-col overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm">コンテンツ一覧</h3>
            <span className="text-xs text-gray-500">{currentIndex + 1} / {allContents.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {allContents.map((c, idx) => {
              const isCurrent = c.id === contentId
              const isCompleted = completedIds.has(c.id)
              const youtubeId = getYouTubeId(c.youtube_url)
              const thumb = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/default.jpg` : null

              return (
                <Link key={c.id} href={`/online/courses/${courseId}/contents/${c.id}`}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${isCurrent ? 'bg-[#384a8f]/5 border-l-4 border-l-[#384a8f]' : ''}`}>
                  <div className="relative w-24 h-14 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                    {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : (
                      <div className="w-full h-full flex items-center justify-center"><FileText className="w-5 h-5 text-gray-300" /></div>
                    )}
                    {isCompleted && <div className="absolute top-0.5 right-0.5 bg-green-500 text-white rounded-full p-0.5"><CheckCircle2 className="w-3 h-3" /></div>}
                    {isCurrent && !isCompleted && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><PlayCircle className="w-6 h-6 text-white" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium leading-snug line-clamp-2 ${isCurrent ? 'text-[#384a8f] font-bold' : isCompleted ? 'text-gray-400' : 'text-gray-700'}`}>
                      {idx + 1}. {c.name}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {c.duration && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />{c.duration}
                        </span>
                      )}
                      {c.quiz_question && <span className="text-[9px] text-orange-500 bg-orange-50 px-1 rounded">Q</span>}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </aside>
      )}

      {/* モバイル用 */}
      <div className="lg:hidden fixed bottom-20 right-4 z-50">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-12 h-12 bg-[#384a8f] text-white rounded-full shadow-lg flex items-center justify-center">
          <Menu className="w-5 h-5" />
        </button>
      </div>
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white flex flex-col animate-in slide-in-from-right">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm">コンテンツ一覧</h3>
              <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {allContents.map((c, idx) => {
                const isCurrent = c.id === contentId
                const isCompleted = completedIds.has(c.id)
                return (
                  <Link key={c.id} href={`/online/courses/${courseId}/contents/${c.id}`} onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${isCurrent ? 'bg-[#384a8f]/5 border-l-4 border-l-[#384a8f]' : ''}`}>
                    <div className="flex-shrink-0">
                      {isCompleted ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
                        isCurrent ? <PlayCircle className="w-5 h-5 text-[#384a8f]" /> :
                        <span className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-500 font-bold">{idx + 1}</span>}
                    </div>
                    <p className={`text-xs leading-snug line-clamp-2 ${isCurrent ? 'text-[#384a8f] font-bold' : isCompleted ? 'text-gray-400' : 'text-gray-700'}`}>{c.name}</p>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showQuiz && content.quiz_question && content.quiz_answer && (
        <QuizModal question={content.quiz_question} options={quizOptions} answer={content.quiz_answer}
          explanation={content.quiz_explanation} onClose={() => setShowQuiz(false)}
          onCorrect={() => { setShowQuiz(false); updateProgress('quiz_completed') }} />
      )}
    </div>
  )
}
