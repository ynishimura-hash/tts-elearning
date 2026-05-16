'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, ChevronRight, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Announcement } from '@/types/database'

export default function OnlineAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_online', true)
        .order('created_at', { ascending: false })
      if (data) setAnnouncements(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <Bell className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">お知らせ一覧</h1>
      </div>

      <div className="space-y-3">
        {announcements.map((ann) => {
          const isExternal = !!ann.link_url
          const className =
            'block bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow'
          const content = (
            <div className="flex items-start gap-4">
              {ann.image_url && (
                <img src={ann.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800">{ann.title}</p>
                <p className="text-sm text-gray-500 mt-1">{formatDate(ann.created_at)}</p>
                {isExternal && (
                  <p className="text-xs text-[#384a8f] mt-2 inline-flex items-center gap-1">
                    リンクを開く <ExternalLink className="w-3 h-3" />
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>
          )

          return isExternal ? (
            <a key={ann.id} href={ann.link_url!} target="_blank" rel="noopener noreferrer" className={className}>
              {content}
            </a>
          ) : (
            <div key={ann.id} className={className}>
              {content}
            </div>
          )
        })}
        {announcements.length === 0 && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
            お知らせはありません
          </div>
        )}
      </div>
    </div>
  )
}
