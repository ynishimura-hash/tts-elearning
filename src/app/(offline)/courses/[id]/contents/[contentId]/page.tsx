'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { YouTubePlayer } from '@/components/YouTubePlayer'
import { QuizModal } from '@/components/QuizModal'
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileText,
  ExternalLink, AlertCircle
} from 'lucide-react'
import type { Content } from '@/types/database'

export default function ContentViewPage() {
  const { id: courseId, contentId } = useParams<{ id: string; contentId: string }>()
  const router = useRouter()
  const { user } = useUser()
  const [content, setContent] = useState<Content | null>(null)
  const [progress, setProgress] = useState({ video: false, quiz: false, completed: false })
  const [showQuiz, setShowQuiz] = useState(false)
  const [nextContent, setNextContent] = useState<Content | null>(null)
  const [prevContent, setPrevContent] = useState<Content | null>(null)

  useEffect(() => {
    if (!user || !contentId) return
    const supabase = createClient()

    async function fetchData() {
      // コンテンツ取得
      const { data: contentData } = await supabase
        .from('contents')
        .select('*')
        .eq('id', contentId)
        .single()

      if (contentData) setContent(contentData)

      // 前後のコンテンツ
      const { data: allContents } = await supabase
        .from('contents')
        .select('*')
        .eq('course_id', courseId)
        .order('sort_order')

      if (allContents) {
        const idx = allContents.findIndex(c => c.id === contentId)
        if (idx > 0) setPrevContent(allContents[idx - 1])
        if (idx < allContents.length - 1) setNextContent(allContents[idx + 1])
      }

      // 進捗
      const { data: progressData } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user!.id)
        .eq('content_id', contentId)
        .maybeSingle()

      if (progressData) {
        setProgress({
          video: progressData.video_completed,
          quiz: progressData.quiz_completed,
          completed: progressData.completed,
        })
      }
    }

    fetchData()
  }, [user, contentId, courseId])

  const updateProgress = useCallback(async (field: 'video_completed' | 'quiz_completed') => {
    if (!user || !contentId) return
    const supabase = createClient()

    const newProgress = {
      ...progress,
      [field === 'video_completed' ? 'video' : 'quiz']: true,
    }

    const hasQuiz = !!content?.quiz_question
    const allDone = newProgress.video && (!hasQuiz || newProgress.quiz)

    await supabase
      .from('user_progress')
      .upsert({
        user_id: user.id,
        content_id: contentId,
        video_completed: newProgress.video,
        quiz_completed: newProgress.quiz,
        completed: allDone,
        completed_at: allDone ? new Date().toISOString() : null,
      }, { onConflict: 'user_id,content_id' })

    setProgress({ ...newProgress, completed: allDone })

    // 最後に見たコンテンツを更新
    await supabase
      .from('users')
      .update({ last_content: content?.name })
      .eq('id', user.id)
  }, [user, contentId, content, progress])

  if (!content) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
      </div>
    )
  }

  const hasQuiz = !!content.quiz_question
  const quizOptions = [
    content.quiz_option_1,
    content.quiz_option_2,
    content.quiz_option_3,
    content.quiz_option_4,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-4xl mx-auto">
      <Link
        href={`/courses/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        コンテンツ一覧に戻る
      </Link>

      {/* コンテンツヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">{content.name}</h1>
        {progress.completed && (
          <span className="inline-flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" /> 受講完了
          </span>
        )}
      </div>

      {/* 注釈 */}
      {content.notes && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">{content.notes}</p>
        </div>
      )}

      {/* 動画 */}
      {content.youtube_url && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <YouTubePlayer url={content.youtube_url} title={content.name} />
          {!progress.video && (
            <button
              onClick={() => updateProgress('video_completed')}
              className="mt-4 w-full py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors"
            >
              動画を視聴完了にする
            </button>
          )}
          {progress.video && (
            <p className="mt-4 text-center text-sm text-green-600 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> 動画視聴完了
            </p>
          )}
        </div>
      )}

      {/* スライド */}
      {content.slide_url && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#384a8f]" />
              スライド資料
            </h2>
            <a
              href={content.slide_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline"
            >
              新しいタブで開く <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <iframe
            src={content.slide_url}
            className="w-full h-[500px] border rounded-lg"
            title="スライド"
          />
        </div>
      )}

      {/* PDF */}
      {content.pdf_url && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <a
            href={content.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#384a8f] hover:underline"
          >
            <FileText className="w-5 h-5" />
            PDF資料をダウンロード
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* 小テスト */}
      {hasQuiz && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3">小テスト</h2>
          {progress.quiz ? (
            <p className="text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> 小テスト合格済み
            </p>
          ) : (
            <button
              onClick={() => setShowQuiz(true)}
              className="px-6 py-3 bg-[#e39f3c] text-white rounded-lg font-medium hover:bg-[#d08f2c] transition-colors"
            >
              小テストに挑戦する
            </button>
          )}
        </div>
      )}

      {/* 前後ナビゲーション */}
      <div className="flex items-center justify-between pt-4">
        {prevContent ? (
          <Link
            href={`/courses/${courseId}/contents/${prevContent.id}`}
            className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> {prevContent.name}
          </Link>
        ) : <div />}
        {nextContent ? (
          <Link
            href={`/courses/${courseId}/contents/${nextContent.id}`}
            className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline"
          >
            {nextContent.name} <ArrowRight className="w-4 h-4" />
          </Link>
        ) : <div />}
      </div>

      {/* クイズモーダル */}
      {showQuiz && content.quiz_question && content.quiz_answer && (
        <QuizModal
          question={content.quiz_question}
          options={quizOptions}
          answer={content.quiz_answer}
          explanation={content.quiz_explanation}
          onClose={() => setShowQuiz(false)}
          onCorrect={() => {
            setShowQuiz(false)
            updateProgress('quiz_completed')
          }}
        />
      )}
    </div>
  )
}
