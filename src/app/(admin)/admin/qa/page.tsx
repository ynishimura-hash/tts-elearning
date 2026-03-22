'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HelpCircle, Plus, Edit, Trash2, Save, X } from 'lucide-react'
import type { FAQ } from '@/types/database'

export default function AdminQAPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ question: '', answer: '', link_text: '', link_url: '', is_online: false })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase.from('faqs').select('*').order('is_online').order('sort_order')
    if (data) setFaqs(data)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const maxOrder = faqs.filter(f => f.is_online === form.is_online).length + 1
    await supabase.from('faqs').insert({ ...form, link_text: form.link_text || null, link_url: form.link_url || null, sort_order: maxOrder })
    setShowNew(false)
    setForm({ question: '', answer: '', link_text: '', link_url: '', is_online: false })
    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('削除しますか？')) return
    const supabase = createClient()
    await supabase.from('faqs').delete().eq('id', id)
    fetchData()
  }

  const offlineFaqs = faqs.filter(f => !f.is_online)
  const onlineFaqs = faqs.filter(f => f.is_online)

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Q&A管理</h1>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> 新規追加
        </button>
      </div>

      {showNew && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">質問 *</label>
            <input type="text" required value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">回答 *</label>
            <textarea rows={4} required value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="w-full px-4 py-2 border rounded-lg resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">リンクテキスト</label>
              <input type="text" value={form.link_text} onChange={(e) => setForm({ ...form, link_text: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">リンクURL</label>
              <input type="url" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} className="w-full px-4 py-2 border rounded-lg" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_online" checked={form.is_online} onChange={(e) => setForm({ ...form, is_online: e.target.checked })} />
            <label htmlFor="is_online" className="text-sm text-gray-700">オンライン向け</label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-[#384a8f] text-white rounded-lg font-medium">追加</button>
            <button type="button" onClick={() => setShowNew(false)} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg">キャンセル</button>
          </div>
        </form>
      )}

      {[{ label: '対面向けQ&A', items: offlineFaqs }, { label: 'オンライン向けQ&A', items: onlineFaqs }].map(({ label, items }) => (
        <div key={label}>
          <h2 className="text-lg font-bold text-[#384a8f] mb-3">{label}</h2>
          <div className="space-y-2">
            {items.map((faq) => (
              <div key={faq.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{faq.question}</p>
                  <p className="text-sm text-gray-500 truncate">{faq.answer}</p>
                </div>
                <button onClick={() => handleDelete(faq.id)} className="p-2 text-red-400 hover:text-red-600 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
