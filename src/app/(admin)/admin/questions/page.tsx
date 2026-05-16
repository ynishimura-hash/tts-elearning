'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Edit, Save, X, CheckSquare, Square } from 'lucide-react'
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkMonth, setBulkMonth] = useState<string>(() => String(new Date().getMonth() + 1))
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState<string>('')

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

  async function saveEdit(id: string) {
    if (!editText.trim()) return
    const supabase = createClient()
    await supabase.from('user_questions').update({
      answer: editText.trim(),
      status: 'answered',
      answered_at: new Date().toISOString(),
    }).eq('id', id)
    setEditingId(null)
    setEditText('')
    fetchData()
  }

  function startEdit(q: Question) {
    setEditingId(q.id)
    setEditText(q.answer || '')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  async function bulkAnswerWithMonth() {
    const monthNum = parseInt(bulkMonth, 10)
    if (!monthNum || monthNum < 1 || monthNum > 12) {
      alert('1〜12の月を指定してください')
      return
    }
    if (selectedIds.size === 0) return
    if (!confirm(`${selectedIds.size}件の質問を「${monthNum}月の勉強会で回答しました」で一括回答します。よろしいですか？`)) return

    setBulkSubmitting(true)
    try {
      const supabase = createClient()
      const answer = `${monthNum}月の勉強会で回答しました`
      const { error } = await supabase
        .from('user_questions')
        .update({
          answer,
          status: 'answered',
          answered_at: new Date().toISOString(),
        })
        .in('id', Array.from(selectedIds))
      if (error) {
        alert('一括回答に失敗しました: ' + error.message)
        return
      }
      setSelectedIds(new Set())
      fetchData()
    } finally {
      setBulkSubmitting(false)
    }
  }

  const filtered = questions.filter(q => {
    if (filter === 'pending') return q.status !== 'answered'
    if (filter === 'answered') return q.status === 'answered'
    return true
  })

  // 一括選択対象は未回答のみ
  const selectablePending = filtered.filter(q => q.status !== 'answered')
  const allSelected = selectablePending.length > 0 && selectablePending.every(q => selectedIds.has(q.id))

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectablePending.map(q => q.id)))
    }
  }

  const categories: Record<string, string> = { general: '一般', chart: 'チャート', rule: 'ルール', tool: 'ツール', other: 'その他' }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">質問管理</h1>
        <span className="text-sm text-gray-500">{questions.filter(q => q.status !== 'answered').length}件未回答</span>
      </div>

      <div className="flex gap-2">
        {(['all', 'pending', 'answered'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setSelectedIds(new Set()) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-[#384a8f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}>
            {{ all: 'すべて', pending: '未回答', answered: '回答済み' }[f]}
          </button>
        ))}
      </div>

      {/* 一括操作バー */}
      {selectablePending.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-sm text-[#384a8f] hover:underline"
            >
              {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {allSelected ? '全選択を解除' : `未回答を全選択（${selectablePending.length}件）`}
            </button>
            <span className="text-sm text-gray-500">
              {selectedIds.size > 0 && `${selectedIds.size}件 選択中`}
            </span>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-sm text-gray-600">勉強会の月:</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={bulkMonth}
                  onChange={(e) => setBulkMonth(e.target.value)}
                  className="w-16 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-[#384a8f] outline-none"
                />
                <button
                  onClick={bulkAnswerWithMonth}
                  disabled={bulkSubmitting}
                  className="flex items-center gap-1 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {bulkSubmitting ? '送信中...' : `「${bulkMonth || '?'}月の勉強会で回答しました」で一括回答`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(q => {
          const isSelectable = q.status !== 'answered'
          const isSelected = selectedIds.has(q.id)
          const isEditing = editingId === q.id

          return (
            <div key={q.id} className={`bg-white rounded-xl p-5 shadow-sm transition-all ${
              q.status === 'answered' ? 'opacity-70' : ''
            } ${isSelected ? 'ring-2 ring-[#384a8f]' : ''}`}>
              <div className="flex items-start gap-3">
                {/* チェックボックス（未回答のみ） */}
                {isSelectable ? (
                  <button
                    onClick={() => toggleSelect(q.id)}
                    className="mt-1 flex-shrink-0"
                    title="一括操作用に選択"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-[#384a8f]" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                ) : (
                  <div className="w-5 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div>
                      <p className="font-medium text-gray-800">{q.user?.full_name || '不明'}</p>
                      <p className="text-xs text-gray-500">{formatDate(q.created_at)}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
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

                  {/* 回答済み: 表示 + 編集 */}
                  {q.status === 'answered' && q.answer && !isEditing && (
                    <div className="bg-green-50 rounded-lg p-3 mb-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-green-800 whitespace-pre-wrap flex-1">{q.answer}</p>
                        <button
                          onClick={() => startEdit(q)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-[#384a8f] hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                          title="回答を編集"
                        >
                          <Edit className="w-3 h-3" /> 編集
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 編集モード（回答済み） */}
                  {isEditing && (
                    <div className="space-y-2 mb-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 text-sm border rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(q.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#384a8f] text-white rounded-lg text-xs font-medium">
                          <Save className="w-3 h-3" /> 保存
                        </button>
                        <button onClick={cancelEdit}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                          <X className="w-3 h-3" /> キャンセル
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 未回答: 入力フォーム */}
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
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <div className="bg-white rounded-xl p-8 text-center text-gray-400">質問はありません</div>}
      </div>
    </div>
  )
}
