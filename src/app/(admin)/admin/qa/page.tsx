'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, Save, X, ChevronUp, ChevronDown, ExternalLink, PlayCircle } from 'lucide-react'
import type { FAQ } from '@/types/database'

interface ContentOption {
  id: string
  name: string
  youtube_url: string | null
  course_id: string
  course_name?: string
}

export default function AdminQAPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [contents, setContents] = useState<ContentOption[]>([])
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ question: '', answer: '', link_text: '', link_url: '', video_url: '', is_online: false })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const [{ data: faqData }, { data: contentData }] = await Promise.all([
      supabase.from('faqs').select('*').order('is_online').order('sort_order'),
      supabase.from('contents').select('id, name, youtube_url, course_id, course:courses(name)').not('youtube_url', 'is', null).order('sort_order'),
    ])
    if (faqData) setFaqs(faqData)
    if (contentData) {
      setContents(contentData.map((c: any) => ({
        id: c.id,
        name: c.name,
        youtube_url: c.youtube_url,
        course_id: c.course_id,
        course_name: c.course?.name,
      })))
    }
  }

  function startNew() {
    setEditingId(null)
    setForm({ question: '', answer: '', link_text: '', link_url: '', video_url: '', is_online: false })
    setShowNew(true)
  }

  function startEdit(faq: FAQ) {
    setEditingId(faq.id)
    setForm({
      question: faq.question,
      answer: faq.answer,
      link_text: faq.link_text || '',
      link_url: faq.link_url || '',
      video_url: faq.video_url || '',
      is_online: faq.is_online,
    })
    setShowNew(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const payload = {
      question: form.question,
      answer: form.answer,
      link_text: form.link_text || null,
      link_url: form.link_url || null,
      video_url: form.video_url || null,
      is_online: form.is_online,
    }

    if (editingId) {
      const { error } = await supabase.from('faqs').update(payload).eq('id', editingId)
      if (error) { alert('更新に失敗しました: ' + error.message); return }
    } else {
      const maxOrder = faqs.filter(f => f.is_online === form.is_online).length + 1
      const { error } = await supabase.from('faqs').insert({ ...payload, sort_order: maxOrder })
      if (error) { alert('作成に失敗しました: ' + error.message); return }
    }

    setShowNew(false)
    setEditingId(null)
    setForm({ question: '', answer: '', link_text: '', link_url: '', video_url: '', is_online: false })
    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('このQ&Aを削除しますか？')) return
    const supabase = createClient()
    await supabase.from('faqs').delete().eq('id', id)
    fetchData()
  }

  async function moveFaq(faqId: string, direction: 'up' | 'down') {
    const faq = faqs.find(f => f.id === faqId)
    if (!faq) return
    const sameCategoryFaqs = faqs.filter(f => f.is_online === faq.is_online)
    const idx = sameCategoryFaqs.findIndex(f => f.id === faqId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sameCategoryFaqs.length) return

    const supabase = createClient()
    const currentOrder = sameCategoryFaqs[idx].sort_order
    const swapOrder = sameCategoryFaqs[swapIdx].sort_order

    await Promise.all([
      supabase.from('faqs').update({ sort_order: swapOrder }).eq('id', sameCategoryFaqs[idx].id),
      supabase.from('faqs').update({ sort_order: currentOrder }).eq('id', sameCategoryFaqs[swapIdx].id),
    ])
    fetchData()
  }

  const filteredFaqs = faqs.filter(f => {
    if (filter === 'online' && !f.is_online) return false
    if (filter === 'offline' && f.is_online) return false
    return true
  })

  const offlineFaqs = filteredFaqs.filter(f => !f.is_online)
  const onlineFaqs = filteredFaqs.filter(f => f.is_online)

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Q&A管理</h1>
        <button onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors">
          <Plus className="w-4 h-4" /> 新規追加
        </button>
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        {(['all', 'offline', 'online'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-[#384a8f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}>
            {{ all: 'すべて', offline: '対面向け', online: 'オンライン向け' }[f]}
          </button>
        ))}
      </div>

      {/* 作成・編集フォーム */}
      {showNew && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">{editingId ? 'Q&A編集' : '新規Q&A'}</h2>
            <button onClick={() => { setShowNew(false); setEditingId(null) }} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">質問 *</label>
              <input type="text" required value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">回答 *</label>
              <textarea rows={4} required value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">リンクテキスト</label>
                <input type="text" value={form.link_text} onChange={(e) => setForm({ ...form, link_text: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">リンクURL</label>
                <input type="url" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">解説動画</label>
              <p className="text-xs text-gray-500 mb-2">既存コンテンツから選択するか、YouTube URLを直接貼り付けます。設定すると、ユーザー側Q&Aで「解説動画を見る」ボタンがモーダル表示されます。</p>
              <div className="space-y-2">
                <select
                  value={contents.find(c => c.youtube_url === form.video_url)?.id || ''}
                  onChange={(e) => {
                    const selected = contents.find(c => c.id === e.target.value)
                    setForm({ ...form, video_url: selected?.youtube_url || '' })
                  }}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none bg-white text-sm"
                >
                  <option value="">— 既存コンテンツから選択 —</option>
                  {contents.map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.course_name || '不明'}] {c.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="flex-1 border-t"></div>
                  <span>または</span>
                  <div className="flex-1 border-t"></div>
                </div>
                <input type="url" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                  placeholder="https://youtu.be/... または https://www.youtube.com/watch?v=..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                {form.video_url && (
                  <button type="button" onClick={() => setForm({ ...form, video_url: '' })}
                    className="text-xs text-gray-500 hover:text-red-500">動画設定をクリア</button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="faq_is_online" checked={form.is_online}
                onChange={(e) => setForm({ ...form, is_online: e.target.checked })}
                className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f]" />
              <label htmlFor="faq_is_online" className="text-sm text-gray-700">オンライン向け</label>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors">
                <Save className="w-4 h-4" /> {editingId ? '更新' : '追加'}
              </button>
              <button type="button" onClick={() => { setShowNew(false); setEditingId(null) }}
                className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">キャンセル</button>
            </div>
          </form>
        </div>
      )}

      {/* Q&A一覧 */}
      {(filter === 'all' || filter === 'offline') && offlineFaqs.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#384a8f] mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            対面向けQ&A ({offlineFaqs.length})
          </h2>
          <div className="space-y-2">
            {offlineFaqs.map((faq, idx) => (
              <div key={faq.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex flex-col flex-shrink-0 mt-1">
                      <button onClick={() => moveFaq(faq.id, 'up')} disabled={idx === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveFaq(faq.id, 'down')} disabled={idx === offlineFaqs.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800">{faq.question}</p>
                      <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{faq.answer}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {faq.link_url && (
                          <a href={faq.link_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
                            <ExternalLink className="w-3 h-3" /> {faq.link_text || 'リンク'}
                          </a>
                        )}
                        {faq.video_url && (
                          <span className="inline-flex items-center gap-1 text-sm text-red-600">
                            <PlayCircle className="w-3.5 h-3.5" /> 解説動画あり
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => startEdit(faq)}
                      className="p-2 text-[#384a8f] hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(faq.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(filter === 'all' || filter === 'online') && onlineFaqs.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#384a8f] mb-3 flex items-center gap-2">
            <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
            オンライン向けQ&A ({onlineFaqs.length})
          </h2>
          <div className="space-y-2">
            {onlineFaqs.map((faq, idx) => (
              <div key={faq.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex flex-col flex-shrink-0 mt-1">
                      <button onClick={() => moveFaq(faq.id, 'up')} disabled={idx === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveFaq(faq.id, 'down')} disabled={idx === onlineFaqs.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800">{faq.question}</p>
                      <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{faq.answer}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {faq.link_url && (
                          <a href={faq.link_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
                            <ExternalLink className="w-3 h-3" /> {faq.link_text || 'リンク'}
                          </a>
                        )}
                        {faq.video_url && (
                          <span className="inline-flex items-center gap-1 text-sm text-red-600">
                            <PlayCircle className="w-3.5 h-3.5" /> 解説動画あり
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button onClick={() => startEdit(faq)}
                      className="p-2 text-[#384a8f] hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(faq.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredFaqs.length === 0 && (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">Q&Aがありません</div>
      )}
    </div>
  )
}
