'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Users, BookOpen, CalendarDays, FileText, Bell, UserPlus, ChevronRight } from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    offlineUsers: 0,
    onlineUsers: 0,
    freeUsers: 0,
    totalCourses: 0,
    totalContents: 0,
    pendingApplications: 0,
    upcomingSessions: 0,
  })

  useEffect(() => {
    const supabase = createClient()

    async function fetchStats() {
      const [users, courses, contents, apps, sessions] = await Promise.all([
        supabase.from('users').select('is_online, is_free_user, is_admin'),
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase.from('contents').select('id', { count: 'exact', head: true }),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('study_sessions').select('id', { count: 'exact', head: true })
          .gte('session_date', new Date().toISOString()),
      ])

      const userData = users.data || []
      const nonAdmin = userData.filter(u => !u.is_admin)

      setStats({
        totalUsers: nonAdmin.length,
        offlineUsers: nonAdmin.filter(u => !u.is_online && !u.is_free_user).length,
        onlineUsers: nonAdmin.filter(u => u.is_online).length,
        freeUsers: nonAdmin.filter(u => u.is_free_user).length,
        totalCourses: courses.count || 0,
        totalContents: contents.count || 0,
        pendingApplications: apps.count || 0,
        upcomingSessions: sessions.count || 0,
      })
    }

    fetchStats()
  }, [])

  const cards = [
    { label: '総ユーザー数', value: stats.totalUsers, icon: Users, color: 'bg-blue-100 text-blue-600', href: '/admin/users' },
    { label: '対面受講生', value: stats.offlineUsers, icon: Users, color: 'bg-green-100 text-green-600', href: '/admin/users' },
    { label: 'オンライン受講生', value: stats.onlineUsers, icon: Users, color: 'bg-purple-100 text-purple-600', href: '/admin/users' },
    { label: '無料特典ユーザー', value: stats.freeUsers, icon: Users, color: 'bg-gray-100 text-gray-600', href: '/admin/users' },
    { label: 'コース数', value: stats.totalCourses, icon: BookOpen, color: 'bg-indigo-100 text-indigo-600', href: '/admin/courses' },
    { label: 'コンテンツ数', value: stats.totalContents, icon: FileText, color: 'bg-orange-100 text-orange-600', href: '/admin/courses' },
    { label: '未処理の申込', value: stats.pendingApplications, icon: UserPlus, color: 'bg-red-100 text-red-600', href: '/admin/applications' },
    { label: '今後の勉強会', value: stats.upcomingSessions, icon: CalendarDays, color: 'bg-teal-100 text-teal-600', href: '/admin/study-sessions' },
  ]

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <h1 className="text-2xl font-bold text-gray-800">管理者ダッシュボード</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link key={card.label} href={card.href}
              className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* クイックアクション */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4">クイックアクション</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/admin/study-sessions" className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <CalendarDays className="w-5 h-5 text-[#384a8f]" />
              <span className="font-medium">勉強会を管理する</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
          <Link href="/admin/applications" className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <UserPlus className="w-5 h-5 text-[#384a8f]" />
              <span className="font-medium">申込を確認する</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
          <Link href="/admin/blog/new" className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#384a8f]" />
              <span className="font-medium">ブログ記事を投稿する</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
          <Link href="/admin/users" className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-[#384a8f]" />
              <span className="font-medium">受講生の進捗を確認する</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
        </div>
      </div>
    </div>
  )
}
