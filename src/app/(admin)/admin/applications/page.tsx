'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Search } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Application } from '@/types/database'

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'offline' | 'online'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase
      .from('applications').select('*').order('created_at', { ascending: false })
    if (data) setApplications(data)
  }

  async function handleAction(id: string, status: 'approved' | 'rejected') {
    const actionLabel = status === 'approved' ? '承認' : '却下'
    if (!confirm(`この申込を${actionLabel}しますか？`)) return
    const supabase = createClient()
    await supabase.from('applications')
      .update({ status, processed_at: new Date().toISOString() })
      .eq('id', id)
    fetchData()
  }

  const filtered = applications.filter(app => {
    if (filter === 'pending' && app.status !== 'pending') return false
    if (filter === 'approved' && app.status !== 'approved') return false
    if (filter === 'rejected' && app.status !== 'rejected') return false
    if (typeFilter === 'offline' && app.course_type !== 'offline') return false
    if (typeFilter === 'online' && app.course_type !== 'online') return false
    if (search) {
      const s = search.toLowerCase()
      return app.full_name.toLowerCase().includes(s) || app.email.toLowerCase().includes(s)
    }
    return true
  })

  const pendingCount = applications.filter(a => a.status === 'pending').length

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">申込管理</h1>
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingCount}件未処理
            </span>
          )}
        </div>
        <span className="text-sm text-gray-500">{filtered.length}件</span>
      </div>

      {/* フィルター */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="名前またはメールで検索"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f ? 'bg-[#384a8f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}>
              {{ all: 'すべて', pending: '未処理', approved: '承認済', rejected: '却下' }[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        {(['all', 'offline', 'online'] as const).map((f) => (
          <button key={f} onClick={() => setTypeFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === f ? 'bg-[#e39f3c] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}>
            {{ all: '全タイプ', offline: '対面', online: 'オンライン' }[f]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((app) => (
          <div key={app.id} className={`bg-white rounded-xl p-6 shadow-sm ${app.status === 'pending' ? 'ring-2 ring-yellow-200' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-gray-800">{app.full_name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    app.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {app.status === 'pending' ? '未処理' : app.status === 'approved' ? '承認済み' : '却下'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    app.course_type === 'offline' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {app.course_type === 'offline' ? '対面' : 'オンライン'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{app.email} {app.phone && `/ ${app.phone}`}</p>
                <p className="text-xs text-gray-400 mt-1">
                  申込日: {formatDateTime(app.created_at)}
                  {app.processed_at && ` / 処理日: ${formatDateTime(app.processed_at)}`}
                </p>
              </div>
            </div>
            {app.message && <p className="text-gray-600 text-sm bg-gray-50 rounded-lg p-3 mb-4">{app.message}</p>}

            {app.status === 'pending' && (
              <div className="flex gap-3">
                <button onClick={() => handleAction(app.id, 'approved')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                  <CheckCircle2 className="w-4 h-4" /> 承認
                </button>
                <button onClick={() => handleAction(app.id, 'rejected')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors">
                  <XCircle className="w-4 h-4" /> 却下
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">申込はありません</div>
        )}
      </div>
    </div>
  )
}
