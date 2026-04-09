'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HelpCircle, ChevronDown, ExternalLink, Search } from 'lucide-react'
import type { FAQ } from '@/types/database'

export default function QAPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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

      {/* 検索 */}
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
              <div className="px-5 pb-5 border-t pt-4">
                <p className="text-gray-600 whitespace-pre-wrap">{faq.answer}</p>
                {faq.link_url && (
                  <a
                    href={faq.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-sm text-[#384a8f] hover:underline"
                  >
                    {faq.link_text || 'リンクを開く'} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
