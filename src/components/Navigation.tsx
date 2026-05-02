'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Home, BookOpen, Wrench, HelpCircle, MessageSquare, User, TrendingUp,
  Menu, X, LogOut, Users, CalendarDays, Bell, FileText, UserPlus, Mail, MessageCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavMode = 'offline' | 'online' | 'admin' | 'free'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  badgeKey?: 'peakBottomPending' | 'applicationsPending'
}

const navItems: Record<NavMode, NavItem[]> = {
  offline: [
    { href: '/home', label: 'ホーム', icon: Home },
    { href: '/courses', label: 'コース一覧', icon: BookOpen },
    { href: '/study-sessions', label: '勉強会', icon: CalendarDays },
    { href: '/tools', label: '検証ツール', icon: Wrench },
    { href: '/questions', label: '質問受付', icon: MessageSquare },
    { href: '/consultation', label: '個別相談', icon: Users },
    { href: '/qa', label: 'Q&A', icon: HelpCircle },
    { href: '/simulation', label: '資金シミュレーション', icon: TrendingUp },
    { href: '/mypage', label: 'マイページ', icon: User },
  ],
  online: [
    { href: '/online/home', label: 'ホーム', icon: Home },
    { href: '/online/courses', label: 'コース一覧', icon: BookOpen },
    { href: '/online/study-sessions', label: '勉強会', icon: CalendarDays },
    { href: '/online/tools', label: '検証ツール', icon: Wrench },
    { href: '/online/questions', label: '質問受付', icon: MessageSquare },
    { href: '/online/consultation', label: '個別相談', icon: Users },
    { href: '/online/qa', label: 'Q&A', icon: HelpCircle },
    { href: '/online/simulation', label: '資金シミュレーション', icon: TrendingUp },
    { href: '/online/mypage', label: 'マイページ', icon: User },
  ],
  admin: [
    { href: '/admin', label: 'ダッシュボード', icon: Home },
    { href: '/admin/users', label: 'ユーザー管理', icon: Users },
    { href: '/admin/courses', label: 'コース管理', icon: BookOpen },
    { href: '/admin/announcements', label: 'お知らせ管理', icon: Bell },
    { href: '/admin/study-sessions', label: '勉強会管理', icon: CalendarDays },
    { href: '/admin/peak-bottom', label: 'ピークボトム申請', icon: Wrench, badgeKey: 'peakBottomPending' },
    { href: '/admin/questions', label: '質問管理', icon: MessageSquare },
    { href: '/admin/consultations', label: '個別相談', icon: Users },
    { href: '/admin/blog', label: 'ブログ管理', icon: FileText },
    { href: '/admin/qa', label: 'Q&A管理', icon: HelpCircle },
    { href: '/admin/applications', label: '申込管理', icon: UserPlus, badgeKey: 'applicationsPending' },
    { href: '/admin/line-groups', label: 'LINEグループ', icon: MessageCircle },
    { href: '/admin/broadcasts', label: 'メール配信', icon: Mail },
  ],
  free: [
    { href: '/free/home', label: 'ホーム', icon: Home },
    { href: '/free/courses', label: '無料コース', icon: BookOpen },
  ],
}

type Badges = {
  peakBottomPending: number
  applicationsPending: number
}

export function Navigation({ mode }: { mode: NavMode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [badges, setBadges] = useState<Badges>({ peakBottomPending: 0, applicationsPending: 0 })
  const items = navItems[mode]

  // 管理者用バッジ件数を取得（30秒ごと再取得）
  useEffect(() => {
    if (mode !== 'admin') return
    const supabase = createClient()
    let cancelled = false

    async function fetchBadges() {
      const [pb, ap] = await Promise.all([
        supabase.from('peak_bottom_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      if (cancelled) return
      setBadges({
        peakBottomPending: pb.count || 0,
        applicationsPending: ap.count || 0,
      })
    }

    fetchBadges()
    const timer = setInterval(fetchBadges, 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [mode])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      {/* モバイルハンバーガー */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-white shadow-lg rounded-lg p-2"
      >
        <Menu className="w-6 h-6 text-[#384a8f]" />
      </button>

      {/* オーバーレイ */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside className={cn(
        'fixed left-0 top-0 h-full w-64 bg-[#384a8f] text-white z-50 transition-transform duration-300',
        'lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <Link href={items[0].href} className="flex items-center gap-2">
            <img src="/logo-icon.png" alt="TTS" className="w-8 h-8 object-contain" />
            <span className="font-bold text-lg">TTS e-ラーニング</span>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          {(() => {
            // 最長プレフィックス一致でアクティブ項目を1つだけ決定
            const matched = items
              .filter((it) => pathname === it.href || pathname.startsWith(it.href + '/'))
              .sort((a, b) => b.href.length - a.href.length)[0]
            return items.map((item) => {
              const Icon = item.icon
              const isActive = matched?.href === item.href
              const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm',
                    isActive
                      ? 'bg-white/20 text-white font-medium'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                      {badgeCount}
                    </span>
                  )}
                </Link>
              )
            })
          })()}
        </nav>

        <div className="p-4 border-t border-white/20">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full text-sm"
          >
            <LogOut className="w-5 h-5" />
            ログアウト
          </button>
        </div>
      </aside>
    </>
  )
}
