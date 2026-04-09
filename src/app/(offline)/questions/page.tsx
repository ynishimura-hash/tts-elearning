'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { MessageSquare, Send, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Question {
  id: string
  question: string
  category: string
  status: string
  answer: string | null
  answered_at: string | null
  created_at: string
}

export default function QuestionsPage() {
  const { user } = useUser()
  const [questions, setQuestions] = useState<Question[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [category, setCategory] = useState('general')
  const [submitting, setSubmitting] = useState(false)
  const [showPast, setShowPast] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchQuestions()
  }, [user])

  async function fetchQuestions() {
    const supabase = createClient()
    const { data } = await supabase
      .from('user_questions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    if (data) setQuestions(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !newQuestion.trim()) return
    setSubmitting(true)

    const supabase = createClient()
    await supabase.from('user_questions').insert({
      user_id: user.id,
      question: newQuestion.trim(),
      category,
      is_online: false,
    })

    setNewQuestion('')
    setSubmitting(false)
    fetchQuestions()
  }

  const pending = questions.filter(q => q.status !== 'answered')
  const answered = questions.filter(q => q.status === 'answered')

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">質問受付</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          こちらから質問を送信してください。勉強会の際にまとめて回答いたします。
        </p>
      </div>

      {/* 質問フォーム */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-sm">
            <option value="general">一般的な質問</option>
            <option value="chart">チャート分析</option>
            <option value="rule">トレードルール</option>
            <option value="tool">ツールの使い方</option>
            <option value="other">その他</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">質問内容</label>
          <textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            rows={4}
            placeholder="質問を入力してください..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none text-sm"
          />
        </div>
        <button type="submit" disabled={!newQuestion.trim() || submitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50">
          <Send className="w-4 h-4" /> {submitting ? '送信中...' : '質問を送信'}
        </button>
      </form>

      {/* 未回答の質問 */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-500" /> 回答待ち ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((q) => (
              <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-orange-400">
                <p className="text-gray-800 text-sm">{q.question}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>{formatDate(q.created_at)}</span>
                  <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                    {q.status === 'will_answer_at_session' ? '勉強会で回答予定' : '回答待ち'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 回答済み */}
      {answered.length > 0 && (
        <div>
          <button onClick={() => setShowPast(!showPast)}
            className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" /> 回答済み ({answered.length})
            {showPast ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPast && (
            <div className="space-y-3">
              {answered.map((q) => (
                <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-400">
                  <p className="text-gray-800 text-sm font-medium">{q.question}</p>
                  {q.answer && (
                    <div className="mt-2 bg-green-50 rounded-lg p-3">
                      <p className="text-sm text-green-800">{q.answer}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{formatDate(q.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 space-y-1">
        <p>※ 回答は勉強会にてまとめて行います</p>
        <p>※ 具体的なエントリーポイントの指示はいたしかねます</p>
        <p>※ 学習内容に関する質問のみお受けしております</p>
      </div>
    </div>
  )
}
