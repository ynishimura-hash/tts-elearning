'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { BlogPost } from '@/types/database'

export default function BlogDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [post, setPost] = useState<BlogPost | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('blog_posts').select('*').eq('id', id).single()
      .then(({ data }) => { if (data) setPost(data) })
  }, [id])

  if (!post) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" /></div>

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto p-4 lg:p-8">
      <Link href="/blog" className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline">
        <ArrowLeft className="w-4 h-4" /> ブログ一覧に戻る
      </Link>
      <article className="bg-white rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{post.title}</h1>
        <p className="text-sm text-gray-400 mb-6">{formatDate(post.created_at)}</p>
        {post.image1_url && <img src={post.image1_url} alt="" className="w-full rounded-lg mb-6" />}
        <div className="prose prose-gray max-w-none whitespace-pre-wrap">{post.content}</div>
        {post.image2_url && <img src={post.image2_url} alt="" className="w-full rounded-lg mt-6" />}
        {post.rule_name && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-[#384a8f]">関連ルール: {post.rule_name}</p>
          </div>
        )}
      </article>
    </div>
  )
}
