'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Users, BookOpen, CalendarDays, FileText, Bell, UserPlus, ChevronRight, HelpCircle, Wrench, Wallet } from 'lucide-react'

type PendingPeakBottom = {
  id: string
  tradingview_username: string
  applied_at: string
  user: { full_name: string; email: string } | null
}

type PendingPayment = {
  id: string
  full_name: string
  email: string
  created_at: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    offlineUsers: 0,
    onlineUsers: 0,
    freeUsers: 0,
    totalCourses: 0,
    onlineCourses: 0,
    offlineCourses: 0,
    totalContents: 0,
    pendingApplications: 0,
    upcomingSessions: 0,
    totalAnnouncements: 0,
    totalFaqs: 0,
    pendingPeakBottom: 0,
    pendingPayments: 0,
  })
  const [recentApps, setRecentApps] = useState<{ id: string; full_name: string; course_type: string; created_at: string }[]>([])
  const [pendingPeakBottomList, setPendingPeakBottomList] = useState<PendingPeakBottom[]>([])
  const [pendingPaymentsList, setPendingPaymentsList] = useState<PendingPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchStats() {
      const [users, courses, contents, apps, sessions, announcements, faqs, recentApplications, peakBottomCount, peakBottomList, paymentCount, paymentList] = await Promise.all([
        supabase.from('users').select('is_online, is_free_user, is_admin'),
        supabase.from('courses').select('id, is_online'),
        supabase.from('contents').select('id', { count: 'exact', head: true }),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('study_sessions').select('id', { count: 'exact', head: true })
          .gte('session_date', new Date().toISOString()),
        supabase.from('announcements').select('id', { count: 'exact', head: true }),
        supabase.from('faqs').select('id', { count: 'exact', head: true }),
        supabase.from('applications').select('id, full_name, course_type, created_at')
          .eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
        supabase.from('peak_bottom_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('peak_bottom_applications')
          .select('id, tradingview_username, applied_at, user:users!peak_bottom_applications_user_id_fkey(full_name, email)')
          .eq('status', 'pending').order('applied_at', { ascending: false }).limit(5),
        supabase.from('applications').select('id', { count: 'exact', head: true }).eq('course_type', 'online').eq('payment_status', 'unpaid'),
        supabase.from('applications').select('id, full_name, email, created_at')
          .eq('course_type', 'online').eq('payment_status', 'unpaid').order('created_at', { ascending: false }).limit(5),
      ])

      const userData = users.data || []
      const nonAdmin = userData.filter(u => !u.is_admin)
      const courseData = courses.data || []

      setStats({
        totalUsers: nonAdmin.length,
        offlineUsers: nonAdmin.filter(u => !u.is_online && !u.is_free_user).length,
        onlineUsers: nonAdmin.filter(u => u.is_online).length,
        freeUsers: nonAdmin.filter(u => u.is_free_user).length,
        totalCourses: courseData.length,
        onlineCourses: courseData.filter(c => c.is_online).length,
        offlineCourses: courseData.filter(c => !c.is_online).length,
        totalContents: contents.count || 0,
        pendingApplications: apps.count || 0,
        upcomingSessions: sessions.count || 0,
        totalAnnouncements: announcements.count || 0,
        totalFaqs: faqs.count || 0,
        pendingPeakBottom: peakBottomCount.count || 0,
        pendingPayments: paymentCount.count || 0,
      })

      if (recentApplications.data) setRecentApps(recentApplications.data)
      if (peakBottomList.data) {
        setPendingPeakBottomList(peakBottomList.data as unknown as PendingPeakBottom[])
      }
      if (paymentList.data) setPendingPaymentsList(paymentList.data as PendingPayment[])
      setLoading(false)
    }

    fetchStats()
  }, [])

  const cards = [
    { label: '総ユーザー数', value: stats.totalUsers, icon: Users, color: 'bg-blue-100 text-blue-600', href: '/admin/users' },
    { label: '対面受講生', value: stats.offlineUsers, icon: Users, color: 'bg-green-100 text-green-600', href: '/admin/users?filter=offline' },
    { label: 'オンライン受講生', value: stats.onlineUsers, icon: Users, color: 'bg-purple-100 text-purple-600', href: '/admin/users?filter=online' },
    { label: '無料特典ユーザー', value: stats.freeUsers, icon: Users, color: 'bg-gray-100 text-gray-600', href: '/admin/users?filter=free' },
    { label: 'コース数', value: stats.totalCourses, sub: `対面${stats.offlineCourses} / オンライン${stats.onlineCourses}`, icon: BookOpen, color: 'bg-indigo-100 text-indigo-600', href: '/admin/courses' },
    { label: 'コンテンツ数', value: stats.totalContents, icon: FileText, color: 'bg-orange-100 text-orange-600', href: '/admin/courses' },
    { label: '未処理の申込', value: stats.pendingApplications, icon: UserPlus, color: stats.pendingApplications > 0 ? 'bg-red-100 text-red-600 ring-2 ring-red-200' : 'bg-red-100 text-red-600', href: '/admin/applications' },
    { label: '今後の勉強会', value: stats.upcomingSessions, icon: CalendarDays, color: 'bg-teal-100 text-teal-600', href: '/admin/study-sessions' },
    { label: 'ピークボトム申請中', value: stats.pendingPeakBottom, icon: Wrench, color: stats.pendingPeakBottom > 0 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' : 'bg-amber-100 text-amber-700', href: '/admin/peak-bottom' },
    { label: '入金待ち', value: stats.pendingPayments, icon: Wallet, color: stats.pendingPayments > 0 ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-300' : 'bg-orange-100 text-orange-700', href: '/admin/payments' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">管理者ダッシュボード</h1>
        <span className="text-sm text-gray-500">
          {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
        </span>
      </div>

      {/* 統計カード */}
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
                  {'sub' in card && card.sub && <p className="text-xs text-gray-400">{card.sub}</p>}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 未処理の申込 */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">未処理の申込</h2>
            <Link href="/admin/applications" className="text-sm text-[#384a8f] hover:underline">
              すべて見る
            </Link>
          </div>
          {recentApps.length > 0 ? (
            <div className="space-y-3">
              {recentApps.map((app) => (
                <div key={app.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{app.full_name}</p>
                    <p className="text-xs text-gray-500">
                      {app.course_type === 'offline' ? '対面' : 'オンライン'} /
                      {new Date(app.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">未処理</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">未処理の申込はありません</p>
          )}
        </div>

        {/* 入金待ち */}
        <div className={`bg-white rounded-xl p-5 shadow-sm ${stats.pendingPayments > 0 ? 'ring-2 ring-orange-200' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-orange-600" />
              入金待ち
              {stats.pendingPayments > 0 && (
                <span className="px-2 py-0.5 rounded text-xs bg-orange-500 text-white">{stats.pendingPayments}</span>
              )}
            </h2>
            <Link href="/admin/payments" className="text-sm text-[#384a8f] hover:underline">
              すべて見る
            </Link>
          </div>
          {pendingPaymentsList.length > 0 ? (
            <div className="space-y-3">
              {pendingPaymentsList.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-orange-50/60 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 text-sm truncate">{p.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{p.email}</p>
                    <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleString('ja-JP')}</p>
                  </div>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded flex-shrink-0">入金待ち</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">入金待ちはありません</p>
          )}
        </div>

        {/* ピークボトム申請中 */}
        <div className={`bg-white rounded-xl p-5 shadow-sm ${stats.pendingPeakBottom > 0 ? 'ring-2 ring-amber-200' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              ピークボトム申請中
              {stats.pendingPeakBottom > 0 && (
                <span className="px-2 py-0.5 rounded text-xs bg-amber-500 text-white">{stats.pendingPeakBottom}</span>
              )}
            </h2>
            <Link href="/admin/peak-bottom" className="text-sm text-[#384a8f] hover:underline">
              すべて見る
            </Link>
          </div>
          {pendingPeakBottomList.length > 0 ? (
            <div className="space-y-3">
              {pendingPeakBottomList.map((app) => (
                <div key={app.id} className="flex items-center justify-between p-3 bg-amber-50/60 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 text-sm truncate">
                      {app.user?.full_name || '不明'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      TradingView: <span className="font-mono">{app.tradingview_username}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(app.applied_at).toLocaleString('ja-JP')}
                    </p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded flex-shrink-0">申請中</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">申請中はありません</p>
          )}
        </div>

        {/* クイックアクション */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">クイックアクション</h2>
          <div className="grid grid-cols-1 gap-2">
            {[
              { href: '/admin/courses', icon: BookOpen, label: 'コースを管理する' },
              { href: '/admin/announcements', icon: Bell, label: 'お知らせを管理する' },
              { href: '/admin/study-sessions', icon: CalendarDays, label: '勉強会を管理する' },
              { href: '/admin/applications', icon: UserPlus, label: '申込を確認する' },
              { href: '/admin/blog/new', icon: FileText, label: 'ブログ記事を投稿する' },
              { href: '/admin/qa', icon: HelpCircle, label: 'Q&Aを管理する' },
              { href: '/admin/users', icon: Users, label: '受講生の進捗を確認する' },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-[#384a8f]" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
