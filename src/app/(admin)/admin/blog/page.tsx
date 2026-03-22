'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FileText, Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { BlogPost } from '@/types/database'

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false })
    if (data) setPosts(data)
  }

  async function togglePublish(id: string, published: boolean) {
    const supabase = createClient()
    await supabase.from('blog_posts').update({ published: !published }).eq('id', id)
    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('この記事を削除しますか？')) return
    const supabase = createClient()
    await supabase.from('blog_posts').delete().eq('id', id)
    fetchData()
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">ブログ管理</h1>
        <Link href="/admin/blog/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors">
          <Plus className="w-4 h-4" /> 新規投稿
        </Link>
      </div>

      <div className="space-y-3">
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-800">{post.title}</h3>
                {post.published ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">公開中</span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">下書き</span>
                )}
              </div>
              <p className="text-sm text-gray-500">{formatDate(post.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => togglePublish(post.id, post.published)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                {post.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <Link href={`/admin/blog/${post.id}`} className="p-2 text-[#384a8f] hover:bg-blue-50 rounded-lg transition-colors">
                <Edit className="w-4 h-4" />
              </Link>
              <button onClick={() => handleDelete(post.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
