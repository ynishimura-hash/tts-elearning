'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Wrench, CheckCircle2, Clock, RefreshCw, Mail } from 'lucide-react'

type Application = {
  id: string
  tradingview_username: string
  status: 'pending' | 'completed' | 'cancelled'
  applied_at: string
  completed_at: string | null
  note: string | null
  user: {
    id: string
    full_name: string
    email: string
    customer_id: string | null
  } | null
}

export default function AdminPeakBottomPage() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/peak-bottom')
      const data = await res.json()
      if (data.success) setApps(data.applications || [])
      else toast.error(data.error || '取得に失敗しました')
    } catch {
      toast.error('通信エラー')
    }
    setLoading(false)
  }

  async function handleComplete(app: Application) {
    if (!confirm(`${app.user?.full_name || '不明'} の申請を「登録完了」にしますか？\n（LINE紐付け済みの方には通知が飛びます）`)) return
    setCompleting(app.id)
    try {
      const res = await fetch(`/api/admin/peak-bottom/${app.id}/complete`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success('登録完了に変更しました', {
          description: data.line_sent ? 'LINEに通知を送信しました' : 'LINE未紐付けのため通知は送られていません',
        })
        await fetchData()
      } else {
        toast.error(data.error || '更新に失敗しました')
      }
    } catch {
      toast.error('通信エラー')
    }
    setCompleting(null)
  }

  const filtered = apps.filter((a) => {
    if (filter === 'pending') return a.status === 'pending'
    if (filter === 'completed') return a.status === 'completed'
    return true
  })

  const counts = {
    pending: apps.filter((a) => a.status === 'pending').length,
    completed: apps.filter((a) => a.status === 'completed').length,
    all: apps.length,
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-[#384a8f]" /> 反対線ピークボトムツール 申請
        </h1>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" /> 更新
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'pending', label: '申請中', count: counts.pending, color: 'bg-amber-500' },
          { key: 'completed', label: '登録完了', count: counts.completed, color: 'bg-emerald-500' },
          { key: 'all', label: 'すべて', count: counts.all, color: 'bg-[#384a8f]' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as 'all' | 'pending' | 'completed')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? `${f.color} text-white`
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-slate-200'
            }`}
          >
            {f.label}
            <span className={`px-2 py-0.5 rounded text-xs ${
              filter === f.key ? 'bg-white/20' : 'bg-gray-100'
            }`}>{f.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
          {filter === 'pending' ? '申請中の方はいません' : '該当する申請がありません'}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">受講生</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">TradingViewアカウント</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">申請日時</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ステータス</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{app.user?.full_name || '不明'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" /> {app.user?.email}
                      </div>
                      {app.user?.customer_id && (
                        <div className="text-xs text-gray-400 mt-0.5">ID: {app.user.customer_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-700">{app.tradingview_username}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(app.applied_at).toLocaleString('ja-JP')}
                      {app.completed_at && (
                        <div className="text-emerald-600 mt-0.5">完了: {new Date(app.completed_at).toLocaleString('ja-JP')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {app.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3" /> 申請中
                        </span>
                      )}
                      {app.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> 登録完了
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {app.status === 'pending' && (
                        <button
                          onClick={() => handleComplete(app)}
                          disabled={completing === app.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {completing === app.id ? '処理中...' : '登録完了'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
