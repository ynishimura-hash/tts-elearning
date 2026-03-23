'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Home, BookOpen, Wrench, HelpCircle, MessageSquare, User,
  Menu, X, LogOut, Users, CalendarDays, Bell, FileText, UserPlus
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavMode = 'offline' | 'online' | 'admin' | 'free'

const navItems: Record<NavMode, { href: string; label: string; icon: React.ElementType }[]> = {
  offline: [
    { href: '/home', label: 'ホーム', icon: Home },
    { href: '/courses', label: 'コース一覧', icon: BookOpen },
    { href: '/study-sessions', label: '勉強会', icon: CalendarDays },
    { href: '/tools', label: '検証ツール', icon: Wrench },
    { href: '/questions', label: '質問受付', icon: MessageSquare },
    { href: '/consultation', label: '個別相談', icon: Users },
    { href: '/qa', label: 'Q&A', icon: HelpCircle },
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
    { href: '/online/mypage', label: 'マイページ', icon: User },
  ],
  admin: [
    { href: '/admin', label: 'ダッシュボード', icon: Home },
    { href: '/admin/users', label: 'ユーザー管理', icon: Users },
    { href: '/admin/courses', label: 'コース管理', icon: BookOpen },
    { href: '/admin/announcements', label: 'お知らせ管理', icon: Bell },
    { href: '/admin/study-sessions', label: '勉強会管理', icon: CalendarDays },
    { href: '/admin/blog', label: 'ブログ管理', icon: FileText },
    { href: '/admin/qa', label: 'Q&A管理', icon: HelpCircle },
    { href: '/admin/applications', label: '申込管理', icon: UserPlus },
  ],
  free: [
    { href: '/free/home', label: 'ホーム', icon: Home },
    { href: '/free/courses', label: '無料コース', icon: BookOpen },
  ],
}

export function Navigation({ mode }: { mode: NavMode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const items = navItems[mode]

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
          {items.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
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
                {item.label}
              </Link>
            )
          })}
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
