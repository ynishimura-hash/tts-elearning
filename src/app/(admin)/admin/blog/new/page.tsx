'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import type { BlogCategory } from '@/types/database'

export default function AdminBlogNewPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [form, setForm] = useState({
    title: '', content: '', category_id: '', rule_name: '', published: false,
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.from('blog_categories').select('*').order('name')
      .then(({ data }) => { if (data) setCategories(data) })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    await supabase.from('blog_posts').insert({
      title: form.title,
      content: form.content,
      category_id: form.category_id || null,
      rule_name: form.rule_name || null,
      published: form.published,
    })
    router.push('/admin/blog')
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <Link href="/admin/blog" className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
        <ArrowLeft className="w-4 h-4" /> ブログ管理に戻る
      </Link>
      <h1 className="text-2xl font-bold text-gray-800">新規投稿</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
          <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-4 py-3 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリー</label>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full px-4 py-3 border rounded-lg">
            <option value="">なし</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">関連ルール名</label>
          <input type="text" value={form.rule_name} onChange={(e) => setForm({ ...form, rule_name: e.target.value })}
            className="w-full px-4 py-3 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">本文 *</label>
          <textarea rows={12} required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            className="w-full px-4 py-3 border rounded-lg resize-none" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="published" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          <label htmlFor="published" className="text-sm text-gray-700">公開する</label>
        </div>
        <button type="submit" className="flex items-center gap-2 px-6 py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors">
          <Save className="w-4 h-4" /> 投稿する
        </button>
      </form>
    </div>
  )
}
