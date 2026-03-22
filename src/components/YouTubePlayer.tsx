'use client'

import { getYouTubeId } from '@/lib/utils'

export function YouTubePlayer({
  url,
  title = '動画',
}: {
  url: string | null
  title?: string
}) {
  const videoId = getYouTubeId(url)

  if (!videoId) {
    return (
      <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
        動画が設定されていません
      </div>
    )
  }

  return (
    <div className="aspect-video rounded-xl overflow-hidden">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  )
}
