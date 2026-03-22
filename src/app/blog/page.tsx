'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BookOpen, ChevronRight } from 'lucide-react'
import { formatDate, truncate } from '@/lib/utils'
import type { BlogPost, BlogCategory } from '@/types/database'

export default function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function fetchData() {
      const { data: postsData } = await supabase
        .from('blog_posts').select('*').eq('published', true).order('created_at', { ascending: false })
      if (postsData) setPosts(postsData)

      const { data: catsData } = await supabase
        .from('blog_categories').select('*').order('name')
      if (catsData) setCategories(catsData)
    }
    fetchData()
  }, [])

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-4xl mx-auto p-4 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-800">ブログ</h1>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/blog/category/${cat.id}`}
              className="px-3 py-1.5 bg-white rounded-full text-sm text-[#384a8f] hover:bg-[#384a8f] hover:text-white transition-colors shadow-sm">
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4">
        {posts.map((post) => (
          <Link key={post.id} href={`/blog/${post.id}`}
            className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-lg font-bold text-gray-800 mb-2">{post.title}</h2>
            {post.content && <p className="text-gray-600 text-sm mb-3">{truncate(post.content, 150)}</p>}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{formatDate(post.created_at)}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </Link>
        ))}
        {posts.length === 0 && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
            まだ記事がありません
          </div>
        )}
      </div>
    </div>
  )
}
