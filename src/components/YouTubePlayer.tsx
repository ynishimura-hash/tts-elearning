'use client'

import { useEffect, useRef, useState } from 'react'
import { getYouTubeId } from '@/lib/utils'

// YouTube IFrame API の型定義
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: (() => void) | undefined
  }
}

export function YouTubePlayer({
  url,
  title = '動画',
  onEnded,
  autoplay = false,
}: {
  url: string | null
  title?: string
  onEnded?: () => void
  autoplay?: boolean
}) {
  const videoId = getYouTubeId(url)
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const [apiReady, setApiReady] = useState(false)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  // YouTube IFrame API スクリプト読み込み
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setApiReady(true)
      return
    }

    // 既にスクリプトタグが存在する場合
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (existing) {
      const check = setInterval(() => {
        if (window.YT && window.YT.Player) {
          setApiReady(true)
          clearInterval(check)
        }
      }, 100)
      return () => clearInterval(check)
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScript = document.getElementsByTagName('script')[0]
    firstScript.parentNode?.insertBefore(tag, firstScript)

    window.onYouTubeIframeAPIReady = () => {
      setApiReady(true)
    }
  }, [])

  // プレイヤー初期化
  useEffect(() => {
    if (!apiReady || !videoId || !containerRef.current) return

    // 既存プレイヤーを破棄
    if (playerRef.current) {
      try { playerRef.current.destroy() } catch {}
      playerRef.current = null
    }

    // コンテナ内にdiv作成
    const el = document.createElement('div')
    el.id = `yt-player-${videoId}-${Date.now()}`
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(el)

    playerRef.current = new window.YT.Player(el.id, {
      videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onStateChange: (event: any) => {
          // YT.PlayerState.ENDED === 0
          if (event.data === 0 && onEndedRef.current) {
            onEndedRef.current()
          }
        },
      },
    })

    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy() } catch {}
        playerRef.current = null
      }
    }
  }, [apiReady, videoId, autoplay])

  if (!videoId) {
    return (
      <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
        動画が設定されていません
      </div>
    )
  }

  return (
    <div ref={containerRef} className="aspect-video rounded-xl overflow-hidden" />
  )
}
