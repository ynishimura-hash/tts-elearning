'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit, Trash2, Save, X, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Announcement } from '@/types/database'

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '', link_url: '', image_url: '', is_online: false,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (data) setAnnouncements(data)
    setLoading(false)
  }

  function startEdit(ann: Announcement) {
    setEditingId(ann.id)
    setForm({
      title: ann.title,
      link_url: ann.link_url || '',
      image_url: ann.image_url || '',
      is_online: ann.is_online,
    })
    setShowForm(true)
  }

  function startNew() {
    setEditingId(null)
    setForm({ title: '', link_url: '', image_url: '', is_online: false })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const payload = {
      title: form.title,
      link_url: form.link_url || null,
      image_url: form.image_url || null,
      is_online: form.is_online,
    }

    if (editingId) {
      const { error } = await supabase.from('announcements').update(payload).eq('id', editingId)
      if (error) { alert('更新に失敗しました: ' + error.message); return }
    } else {
      const { error } = await supabase.from('announcements').insert(payload)
      if (error) { alert('作成に失敗しました: ' + error.message); return }
    }

    setShowForm(false)
    setEditingId(null)
    setForm({ title: '', link_url: '', image_url: '', is_online: false })
    fetchData()
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`「${title}」を削除しますか？`)) return
    const supabase = createClient()
    await supabase.from('announcements').delete().eq('id', id)
    fetchData()
  }

  const filtered = announcements.filter(a => {
    if (filter === 'online' && !a.is_online) return false
    if (filter === 'offline' && a.is_online) return false
    return true
  })

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">お知らせ管理</h1>
        <button onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors">
          <Plus className="w-4 h-4" /> 新規作成
        </button>
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        {(['all', 'offline', 'online'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-[#384a8f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}>
            {{ all: 'すべて', offline: '対面向け', online: 'オンライン向け' }[f]}
          </button>
        ))}
      </div>

      {/* 作成・編集フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">{editingId ? 'お知らせ編集' : '新規お知らせ'}</h2>
            <button onClick={() => { setShowForm(false); setEditingId(null) }} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
              <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
                placeholder="お知らせのタイトルを入力" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">リンクURL</label>
                <input type="url" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
                  placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">画像URL</label>
                <input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
                  placeholder="https://..." />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ann_is_online" checked={form.is_online}
                onChange={(e) => setForm({ ...form, is_online: e.target.checked })}
                className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f]" />
              <label htmlFor="ann_is_online" className="text-sm text-gray-700">オンライン向け</label>
            </div>
            {form.image_url && (
              <div className="border rounded-lg p-3 bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">プレビュー:</p>
                <img src={form.image_url} alt="プレビュー" className="max-h-40 rounded-lg object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors">
                <Save className="w-4 h-4" /> {editingId ? '更新' : '作成'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null) }}
                className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">キャンセル</button>
            </div>
          </form>
        </div>
      )}

      {/* お知らせ一覧 */}
      <div className="space-y-3">
        {filtered.map((ann) => (
          <div key={ann.id} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                {ann.image_url && (
                  <img src={ann.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-gray-800">{ann.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${ann.is_online ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {ann.is_online ? 'オンライン' : '対面'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>{formatDate(ann.created_at)}</span>
                    {ann.link_url && (
                      <a href={ann.link_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#384a8f] hover:underline">
                        <ExternalLink className="w-3 h-3" /> リンク
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button onClick={() => startEdit(ann)}
                  className="p-2 text-[#384a8f] hover:bg-blue-50 rounded-lg transition-colors" title="編集">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(ann.id, ann.title)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
            お知らせがありません
          </div>
        )}
      </div>
    </div>
  )
}
