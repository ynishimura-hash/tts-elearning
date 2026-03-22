'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { formatDate, truncate } from '@/lib/utils'
import type { BlogPost, BlogCategory } from '@/types/database'

export default function BlogCategoryPage() {
  const { id } = useParams<{ id: string }>()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [category, setCategory] = useState<BlogCategory | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchData() {
      const { data: cat } = await supabase.from('blog_categories').select('*').eq('id', id).single()
      if (cat) setCategory(cat)

      const { data: postsData } = await supabase
        .from('blog_posts').select('*').eq('category_id', id).eq('published', true)
        .order('created_at', { ascending: false })
      if (postsData) setPosts(postsData)
    }
    fetchData()
  }, [id])

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-4xl mx-auto p-4 lg:p-8">
      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
        <ArrowLeft className="w-4 h-4" /> ブログ一覧に戻る
      </Link>
      <h1 className="text-2xl font-bold text-gray-800">{category?.name || 'カテゴリー'}</h1>
      <div className="grid gap-4">
        {posts.map((post) => (
          <Link key={post.id} href={`/blog/${post.id}`} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-bold text-gray-800 mb-2">{post.title}</h2>
            {post.content && <p className="text-gray-600 text-sm mb-3">{truncate(post.content, 150)}</p>}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{formatDate(post.created_at)}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </Link>
        ))}
        {posts.length === 0 && <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">このカテゴリーの記事はありません</div>}
      </div>
    </div>
  )
}
