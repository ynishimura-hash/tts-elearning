'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Application } from '@/types/database'

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase
      .from('applications').select('*').order('created_at', { ascending: false })
    if (data) setApplications(data)
  }

  async function handleAction(id: string, status: 'approved' | 'rejected') {
    const supabase = createClient()
    await supabase.from('applications')
      .update({ status, processed_at: new Date().toISOString() })
      .eq('id', id)
    fetchData()
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <h1 className="text-2xl font-bold text-gray-800">申込管理</h1>

      <div className="space-y-4">
        {applications.map((app) => (
          <div key={app.id} className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-800">{app.full_name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    app.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {app.status === 'pending' ? '未処理' : app.status === 'approved' ? '承認済み' : '却下'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{app.email} {app.phone && `/ ${app.phone}`}</p>
                <p className="text-sm text-gray-500">
                  受講形式: {app.course_type === 'offline' ? '対面' : 'オンライン'} / 申込日: {formatDateTime(app.created_at)}
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
        {applications.length === 0 && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">申込はありません</div>
        )}
      </div>
    </div>
  )
}
