'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ProgressBar } from '@/components/ProgressBar'
import { TrendingUp, User } from 'lucide-react'

interface UserProgress {
  id: string
  full_name: string
  completedCount: number
  totalCount: number
}

export default function ProgressPage() {
  const [users, setUsers] = useState<UserProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchData() {
      // 全対面ユーザー取得
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('is_online', false)
        .eq('is_admin', false)
        .eq('is_free_user', false)

      if (!allUsers) { setLoading(false); return }

      // 全対面コンテンツ数
      const { count: totalCount } = await supabase
        .from('contents')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', false)

      // 各ユーザーの進捗
      const { data: progress } = await supabase
        .from('user_progress')
        .select('user_id')
        .eq('completed', true)

      const countByUser: Record<string, number> = {}
      progress?.forEach(p => {
        countByUser[p.user_id] = (countByUser[p.user_id] || 0) + 1
      })

      const result = allUsers.map(u => ({
        id: u.id,
        full_name: u.full_name,
        completedCount: countByUser[u.id] || 0,
        totalCount: totalCount || 0,
      }))

      result.sort((a, b) => b.completedCount - a.completedCount)
      setUsers(result)
      setLoading(false)
    }

    fetchData()
  }, [])

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">みんなの進捗一覧</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u, i) => (
            <div key={u.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-8 h-8 bg-[#384a8f]/10 rounded-full flex items-center justify-center text-sm font-bold text-[#384a8f]">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  {u.full_name}
                </p>
                <div className="mt-1">
                  <ProgressBar
                    value={u.completedCount}
                    max={u.totalCount}
                    label={`${u.completedCount}/${u.totalCount}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
