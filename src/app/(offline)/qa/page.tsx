'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HelpCircle, ChevronDown, ExternalLink, Search, PlayCircle, X } from 'lucide-react'
import type { FAQ } from '@/types/database'
import { YouTubePlayer } from '@/components/YouTubePlayer'

export default function QAPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [videoModal, setVideoModal] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('faqs')
      .select('*')
      .eq('is_online', false)
      .order('sort_order')
      .then(({ data }) => { if (data) setFaqs(data) })
  }, [])

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">よくある質問（Q&A）</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="キーワードで検索..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none bg-white" />
      </div>

      <div className="space-y-3">
        {faqs.filter(f => {
          if (!search) return true
          const s = search.toLowerCase()
          return f.question.toLowerCase().includes(s) || f.answer.toLowerCase().includes(s)
        }).map((faq) => (
          <div key={faq.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
              className="w-full flex items-start justify-between p-5 text-left"
            >
              <span className="font-medium text-gray-800 pr-4">{faq.question}</span>
              <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                openId === faq.id ? 'rotate-180' : ''
              }`} />
            </button>
            {openId === faq.id && (
              <div className="px-5 pb-5 border-t pt-4 space-y-3">
                <p className="text-gray-600 whitespace-pre-wrap">{faq.answer}</p>
                {faq.video_url && (
                  <button
                    onClick={() => setVideoModal({ url: faq.video_url!, title: faq.question })}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" /> 解説動画を見る
                  </button>
                )}
                {faq.link_url && (
                  <a
                    href={faq.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline ml-2"
                  >
                    {faq.link_text || 'リンクを開く'} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {videoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setVideoModal(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-bold text-gray-800 truncate pr-4">{videoModal.title}</h2>
              <button
                onClick={() => setVideoModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded flex-shrink-0"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <YouTubePlayer url={videoModal.url} title={videoModal.title} autoplay />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
