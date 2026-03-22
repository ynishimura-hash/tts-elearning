'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Search, Eye } from 'lucide-react'
import { formatDate, daysSince } from '@/lib/utils'
import { ProgressBar } from '@/components/ProgressBar'
import type { User } from '@/types/database'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'offline' | 'online' | 'free'>('all')
  const [progressMap, setProgressMap] = useState<Record<string, { done: number; total: number }>>({})
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchData() {
      const { data: usersData } = await supabase
        .from('users').select('*').eq('is_admin', false).order('created_at', { ascending: false })
      if (usersData) setUsers(usersData)

      // 全コンテンツ数
      const { count: totalOffline } = await supabase
        .from('contents').select('*', { count: 'exact', head: true }).eq('is_online', false)
      const { count: totalOnline } = await supabase
        .from('contents').select('*', { count: 'exact', head: true }).eq('is_online', true)

      // 全進捗
      const { data: allProgress } = await supabase
        .from('user_progress').select('user_id').eq('completed', true)

      if (allProgress && usersData) {
        const countByUser: Record<string, number> = {}
        allProgress.forEach(p => { countByUser[p.user_id] = (countByUser[p.user_id] || 0) + 1 })

        const pMap: Record<string, { done: number; total: number }> = {}
        usersData.forEach(u => {
          pMap[u.id] = {
            done: countByUser[u.id] || 0,
            total: u.is_online ? (totalOnline || 0) : (totalOffline || 0),
          }
        })
        setProgressMap(pMap)
      }
    }
    fetchData()
  }, [])

  const filtered = users.filter(u => {
    if (filter === 'offline' && (u.is_online || u.is_free_user)) return false
    if (filter === 'online' && !u.is_online) return false
    if (filter === 'free' && !u.is_free_user) return false
    if (search) {
      const s = search.toLowerCase()
      return u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
    }
    return true
  })

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <h1 className="text-2xl font-bold text-gray-800">ユーザー管理</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="名前またはメールで検索"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none" />
        </div>
        <div className="flex gap-2">
          {(['all', 'offline', 'online', 'free'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? 'bg-[#384a8f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}>
              {{ all: '全員', offline: '対面', online: 'オンライン', free: '無料' }[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名前</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">種別</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">経過日数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">進捗</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">最終学習</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">詳細</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((user) => {
                const p = progressMap[user.id]
                const percent = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-800">{user.full_name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        user.is_free_user ? 'bg-gray-100 text-gray-600' :
                        user.is_online ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {user.is_free_user ? '無料' : user.is_online ? 'オンライン' : '対面'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {daysSince(user.account_issued_at)}日
                    </td>
                    <td className="px-4 py-3 w-40">
                      <ProgressBar value={p?.done || 0} max={p?.total || 1} />
                      <span className="text-xs text-gray-500">{percent}%</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">
                      {user.last_content || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedUser(user)}
                        className="p-2 text-[#384a8f] hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ユーザー詳細モーダル */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{selectedUser.full_name}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">メール:</span> <span className="font-medium">{selectedUser.email}</span></div>
              <div><span className="text-gray-500">顧客ID:</span> <span className="font-medium">{selectedUser.customer_id || '-'}</span></div>
              <div><span className="text-gray-500">入会日:</span> <span className="font-medium">{formatDate(selectedUser.joined_at)}</span></div>
              <div><span className="text-gray-500">デビュー日:</span> <span className="font-medium">{formatDate(selectedUser.debut_date)}</span></div>
              <div><span className="text-gray-500">カリキュラム:</span> <span className="font-medium">{selectedUser.curriculum || '-'}</span></div>
              <div><span className="text-gray-500">コミュニティ:</span> <span className="font-medium">{selectedUser.community_member ? '加入' : '未加入'}</span></div>
            </div>
            <button onClick={() => setSelectedUser(null)} className="mt-6 w-full py-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors">
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
