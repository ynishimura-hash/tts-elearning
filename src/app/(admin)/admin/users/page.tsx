'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Eye, Edit, Save, X, Shield, ShieldOff, Trash2 } from 'lucide-react'
import { formatDate, daysSince } from '@/lib/utils'
import { ProgressBar } from '@/components/ProgressBar'
import { PieChart, Pie, ResponsiveContainer } from 'recharts'
import type { User } from '@/types/database'

const CHART_COLORS = ['#384a8f', '#e39f3c', '#22c55e', '#8b5cf6', '#ef4444', '#06b6d4', '#f59e0b', '#ec4899']

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'offline' | 'online' | 'free' | 'admin' | 'test'>('all')
  const [progressMap, setProgressMap] = useState<Record<string, { done: number; total: number }>>({})
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    full_name: '', email: '', customer_id: '', is_online: false, is_free_user: false,
    is_admin: false, joined_at: '', debut_date: '', account_issued_at: '',
    curriculum: '', community_member: false, myrule_permitted: false,
    is_test: false, drive_folder_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [userCourseProgress, setUserCourseProgress] = useState<{ name: string; done: number; total: number }[]>([])

  useEffect(() => { fetchData() }, [])

  // ユーザー詳細表示時にコースごと進捗を取得
  useEffect(() => {
    if (!selectedUser) { setUserCourseProgress([]); return }
    const supabase = createClient()
    async function fetchUserProgress() {
      const isOnline = selectedUser!.is_online
      const { data: courses } = await supabase
        .from('courses').select('id, name, sort_order')
        .eq('is_online', isOnline).eq('is_free', false).order('sort_order')
      if (!courses) return

      const { data: allContents } = await supabase
        .from('contents').select('id, course_id')
        .in('course_id', courses.map(c => c.id))

      const { data: userProg } = await supabase
        .from('user_progress').select('content_id')
        .eq('user_id', selectedUser!.id).eq('completed', true)

      const completedSet = new Set(userProg?.map(p => p.content_id) || [])

      if (allContents) {
        const progress = courses.map(course => {
          const courseContents = allContents.filter(c => c.course_id === course.id)
          const done = courseContents.filter(c => completedSet.has(c.id)).length
          return { name: course.name, done, total: courseContents.length }
        }).filter(p => p.total > 0)
        setUserCourseProgress(progress)
      }
    }
    fetchUserProgress()
  }, [selectedUser])

  async function fetchData() {
    const supabase = createClient()

    const { data: usersData } = await supabase
      .from('users').select('*').order('created_at', { ascending: false })
    if (usersData) setUsers(usersData)

    const { count: totalOffline } = await supabase
      .from('contents').select('*', { count: 'exact', head: true }).eq('is_online', false)
    const { count: totalOnline } = await supabase
      .from('contents').select('*', { count: 'exact', head: true }).eq('is_online', true)

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

  function startEdit(user: User) {
    setEditingUser(user)
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      customer_id: user.customer_id || '',
      is_online: user.is_online,
      is_free_user: user.is_free_user,
      is_admin: user.is_admin,
      joined_at: user.joined_at ? user.joined_at.split('T')[0] : '',
      debut_date: user.debut_date ? user.debut_date.split('T')[0] : '',
      account_issued_at: user.account_issued_at ? user.account_issued_at.split('T')[0] : '',
      curriculum: user.curriculum || '',
      community_member: user.community_member,
      myrule_permitted: user.myrule_permitted,
      is_test: user.is_test,
      drive_folder_url: user.drive_folder_url || '',
    })
    setSelectedUser(null)
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('users').update({
      full_name: editForm.full_name,
      customer_id: editForm.customer_id || null,
      is_online: editForm.is_online,
      is_free_user: editForm.is_free_user,
      is_admin: editForm.is_admin,
      joined_at: editForm.joined_at || null,
      debut_date: editForm.debut_date || null,
      account_issued_at: editForm.account_issued_at || null,
      curriculum: editForm.curriculum || null,
      community_member: editForm.community_member,
      myrule_permitted: editForm.myrule_permitted,
      is_test: editForm.is_test,
      drive_folder_url: editForm.drive_folder_url || null,
    }).eq('id', editingUser.id)

    setSaving(false)
    if (error) { alert('保存に失敗しました: ' + error.message); return }
    setEditingUser(null)
    fetchData()
  }

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  async function handleDeleteUser() {
    if (!deleteTarget) return
    const supabase = createClient()
    // 進捗データを先に削除
    await supabase.from('user_progress').delete().eq('user_id', deleteTarget.id)
    // ユーザーを削除
    await supabase.from('users').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    setSelectedUser(null)
    fetchData()
  }

  async function toggleAdmin(user: User) {
    const msg = user.is_admin
      ? `${user.full_name} の管理者権限を削除しますか？`
      : `${user.full_name} を管理者に設定しますか？`
    if (!confirm(msg)) return
    const supabase = createClient()
    await supabase.from('users').update({ is_admin: !user.is_admin }).eq('id', user.id)
    fetchData()
  }

  const filtered = users.filter(u => {
    if (filter === 'offline' && (u.is_online || u.is_free_user || u.is_admin)) return false
    if (filter === 'online' && !u.is_online) return false
    if (filter === 'free' && !u.is_free_user) return false
    if (filter === 'admin' && !u.is_admin) return false
    if (filter === 'test' && !u.is_test) return false
    if (search) {
      const s = search.toLowerCase()
      return u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) ||
        (u.customer_id && u.customer_id.toLowerCase().includes(s))
    }
    return true
  })

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">ユーザー管理</h1>
        <span className="text-sm text-gray-500">{filtered.length}人 / {users.length}人</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・メール・顧客IDで検索"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'offline', 'online', 'free', 'admin', 'test'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? f === 'test' ? 'bg-yellow-500 text-white' : 'bg-[#384a8f] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}>
              {{ all: '全員', offline: '対面', online: 'オンライン', free: '無料', admin: '管理者', test: 'テスト' }[f]}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
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
                        {user.customer_id && <p className="text-xs text-gray-400">ID: {user.customer_id}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs px-2 py-1 rounded w-fit ${
                          user.is_admin ? 'bg-red-100 text-red-700' :
                          user.is_free_user ? 'bg-gray-100 text-gray-600' :
                          user.is_online ? 'bg-purple-100 text-purple-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {user.is_admin ? '管理者' : user.is_free_user ? '無料' : user.is_online ? 'オンライン' : '対面'}
                        </span>
                        {user.is_test && (
                          <span className="text-xs px-2 py-0.5 rounded w-fit bg-yellow-100 text-yellow-700 border border-yellow-300">テスト</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {daysSince(user.account_issued_at)}日
                    </td>
                    <td className="px-4 py-3 w-40">
                      <ProgressBar value={p?.done || 0} max={p?.total || 1} />
                      <span className="text-xs text-gray-500">{percent}% ({p?.done || 0}/{p?.total || 0})</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">
                      {user.last_content || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedUser(user)}
                          className="p-2 text-[#384a8f] hover:bg-blue-50 rounded-lg transition-colors" title="詳細">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => startEdit(user)}
                          className="p-2 text-[#e39f3c] hover:bg-orange-50 rounded-lg transition-colors" title="編集">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleAdmin(user)}
                          className={`p-2 rounded-lg transition-colors ${user.is_admin ? 'text-red-500 hover:bg-red-50' : 'text-gray-400 hover:bg-gray-50'}`}
                          title={user.is_admin ? '管理者権限を削除' : '管理者に設定'}>
                          {user.is_admin ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleteTarget(user)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400">ユーザーが見つかりません</div>
        )}
      </div>

      {/* ユーザー詳細モーダル */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">{selectedUser.full_name}</h2>
              <button onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">メール:</span> <span className="font-medium">{selectedUser.email}</span></div>
              <div><span className="text-gray-500">顧客ID:</span> <span className="font-medium">{selectedUser.customer_id || '-'}</span></div>
              <div><span className="text-gray-500">種別:</span> <span className="font-medium">{selectedUser.is_admin ? '管理者' : selectedUser.is_free_user ? '無料' : selectedUser.is_online ? 'オンライン' : '対面'}</span></div>
              <div><span className="text-gray-500">入会日:</span> <span className="font-medium">{formatDate(selectedUser.joined_at)}</span></div>
              <div><span className="text-gray-500">アカウント発行日:</span> <span className="font-medium">{formatDate(selectedUser.account_issued_at)}</span></div>
              <div><span className="text-gray-500">デビュー日:</span> <span className="font-medium">{formatDate(selectedUser.debut_date)}</span></div>
              <div><span className="text-gray-500">カリキュラム:</span> <span className="font-medium">{selectedUser.curriculum || '-'}</span></div>
              <div><span className="text-gray-500">コミュニティ:</span> <span className="font-medium">{selectedUser.community_member ? '加入' : '未加入'}</span></div>
              <div><span className="text-gray-500">マイルール許可:</span> <span className="font-medium">{selectedUser.myrule_permitted ? 'あり' : 'なし'}</span></div>
              <div className="col-span-2"><span className="text-gray-500">最終学習コンテンツ:</span> <span className="font-medium">{selectedUser.last_content || '-'}</span></div>
              {selectedUser.drive_folder_url && (
                <div className="col-span-2"><span className="text-gray-500">Driveフォルダ:</span> <a href={selectedUser.drive_folder_url} target="_blank" rel="noopener noreferrer" className="text-[#384a8f] hover:underline font-medium ml-1">開く</a></div>
              )}
            </div>
            {/* コースごとの進捗 */}
            {userCourseProgress.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="font-bold text-gray-800 text-sm mb-4">コース別進捗</h3>
                <div className="flex gap-6">
                  {/* 円グラフ */}
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { value: userCourseProgress.reduce((s, c) => s + c.done, 0), fill: '#384a8f' },
                          ]}
                          cx="50%" cy="50%"
                          innerRadius={30} outerRadius={45}
                          startAngle={90}
                          endAngle={90 - (userCourseProgress.reduce((s, c) => s + c.done, 0) / Math.max(userCourseProgress.reduce((s, c) => s + c.total, 0), 1)) * 360}
                          dataKey="value" stroke="none" isAnimationActive={false}
                        />
                        <Pie
                          data={[{ value: 1, fill: '#e5e7eb' }]}
                          cx="50%" cy="50%"
                          innerRadius={30} outerRadius={45}
                          dataKey="value" stroke="none" isAnimationActive={false}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold text-[#384a8f]">
                        {Math.round((userCourseProgress.reduce((s, c) => s + c.done, 0) / Math.max(userCourseProgress.reduce((s, c) => s + c.total, 0), 1)) * 100)}%
                      </span>
                    </div>
                  </div>
                  {/* コースバー */}
                  <div className="flex-1 space-y-2">
                    {userCourseProgress.map((cp, i) => {
                      const pct = cp.total > 0 ? Math.round((cp.done / cp.total) * 100) : 0
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-gray-600 truncate mr-2">{cp.name}</span>
                            <span className="text-gray-500 flex-shrink-0">{cp.done}/{cp.total}</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <button onClick={() => { startEdit(selectedUser) }}
                className="flex-1 py-2 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors">
                編集する
              </button>
              <button onClick={() => setSelectedUser(null)}
                className="flex-1 py-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ユーザー編集モーダル */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setEditingUser(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">ユーザー編集</h2>
              <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
                <input type="text" required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メール（変更不可）</label>
                <input type="email" value={editForm.email} disabled
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">顧客ID</label>
                  <input type="text" value={editForm.customer_id} onChange={(e) => setEditForm({ ...editForm, customer_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">カリキュラム</label>
                  <input type="text" value={editForm.curriculum} onChange={(e) => setEditForm({ ...editForm, curriculum: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入会日</label>
                  <input type="date" value={editForm.joined_at} onChange={(e) => setEditForm({ ...editForm, joined_at: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">アカウント発行日</label>
                  <input type="date" value={editForm.account_issued_at} onChange={(e) => setEditForm({ ...editForm, account_issued_at: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">デビュー日</label>
                  <input type="date" value={editForm.debut_date} onChange={(e) => setEditForm({ ...editForm, debut_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DriveフォルダURL</label>
                <input type="url" value={editForm.drive_folder_url} onChange={(e) => setEditForm({ ...editForm, drive_folder_url: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
              </div>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'is_online', label: 'オンライン受講生' },
                  { key: 'is_free_user', label: '無料特典ユーザー' },
                  { key: 'is_admin', label: '管理者' },
                  { key: 'community_member', label: 'コミュニティメンバー' },
                  { key: 'myrule_permitted', label: 'マイルール許可' },
                  { key: 'is_test', label: 'テストアカウント' },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={(editForm as Record<string, unknown>)[opt.key] as boolean}
                      onChange={(e) => setEditForm({ ...editForm, [opt.key]: e.target.checked })}
                      className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f]" />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? '保存中...' : '保存'}
                </button>
                <button type="button" onClick={() => setEditingUser(null)}
                  className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-2">ユーザーを削除</h2>
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-bold">{deleteTarget.full_name}</span> を削除しますか？
              </p>
              <p className="text-xs text-gray-400 mb-6">
                {deleteTarget.email}<br />
                進捗データも全て削除されます。この操作は取り消せません。
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2.5 bg-gray-100 rounded-lg text-gray-600 font-medium hover:bg-gray-200 transition-colors">
                  キャンセル
                </button>
                <button onClick={handleDeleteUser}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors">
                  削除する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
