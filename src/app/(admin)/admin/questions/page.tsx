'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Question {
  id: string
  user_id: string
  question: string
  category: string
  status: string
  answer: string | null
  is_online: boolean
  created_at: string
  user?: { full_name: string; email: string }
}

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'answered'>('all')
  const [answerText, setAnswerText] = useState<Record<string, string>>({})

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase
      .from('user_questions')
      .select('*, user:users(full_name, email)')
      .order('created_at', { ascending: false })
    if (data) setQuestions(data as Question[])
  }

  async function submitAnswer(id: string) {
    const answer = answerText[id]
    if (!answer?.trim()) return
    const supabase = createClient()
    await supabase.from('user_questions').update({
      answer: answer.trim(),
      status: 'answered',
      answered_at: new Date().toISOString(),
    }).eq('id', id)
    setAnswerText(prev => { const n = { ...prev }; delete n[id]; return n })
    fetchData()
  }

  async function markForSession(id: string) {
    const supabase = createClient()
    await supabase.from('user_questions').update({ status: 'will_answer_at_session' }).eq('id', id)
    fetchData()
  }

  const filtered = questions.filter(q => {
    if (filter === 'pending') return q.status !== 'answered'
    if (filter === 'answered') return q.status === 'answered'
    return true
  })

  const categories: Record<string, string> = { general: '一般', chart: 'チャート', rule: 'ルール', tool: 'ツール', other: 'その他' }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">質問管理</h1>
        <span className="text-sm text-gray-500">{questions.filter(q => q.status !== 'answered').length}件未回答</span>
      </div>

      <div className="flex gap-2">
        {(['all', 'pending', 'answered'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-[#384a8f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}>
            {{ all: 'すべて', pending: '未回答', answered: '回答済み' }[f]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map(q => (
          <div key={q.id} className={`bg-white rounded-xl p-5 shadow-sm ${q.status === 'answered' ? 'opacity-70' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-gray-800">{(q.user as any)?.full_name || '不明'}</p>
                <p className="text-xs text-gray-500">{formatDate(q.created_at)}</p>
              </div>
              <div className="flex gap-1">
                <span className={`text-xs px-2 py-0.5 rounded ${q.is_online ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                  {q.is_online ? 'オンライン' : '対面'}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{categories[q.category] || q.category}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  q.status === 'answered' ? 'bg-green-100 text-green-700' :
                  q.status === 'will_answer_at_session' ? 'bg-blue-100 text-blue-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {{ pending: '未回答', answered: '回答済み', will_answer_at_session: '勉強会回答' }[q.status]}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-800 mb-3">{q.question}</p>

            {q.status === 'answered' && q.answer && (
              <div className="bg-green-50 rounded-lg p-3 mb-2">
                <p className="text-sm text-green-800">{q.answer}</p>
              </div>
            )}

            {q.status !== 'answered' && (
              <div className="space-y-2">
                <textarea
                  value={answerText[q.id] || ''}
                  onChange={(e) => setAnswerText(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="回答を入力..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => submitAnswer(q.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#384a8f] text-white rounded-lg text-xs font-medium">
                    <Send className="w-3 h-3" /> 回答する
                  </button>
                  {q.status !== 'will_answer_at_session' && (
                    <button onClick={() => markForSession(q.id)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                      勉強会で回答
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="bg-white rounded-xl p-8 text-center text-gray-400">質問はありません</div>}
      </div>
    </div>
  )
}
