'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Eye, Edit, Save, X, Shield, ShieldOff, Trash2, ChevronDown, ChevronUp, CheckCircle2, Circle, KeyRound, Sparkles } from 'lucide-react'
import { formatDate, daysSince } from '@/lib/utils'
import { ProgressBar } from '@/components/ProgressBar'
import { PieChart, Pie, ResponsiveContainer } from 'recharts'
import type { User } from '@/types/database'

const CHART_COLORS = ['#384a8f', '#e39f3c', '#22c55e', '#8b5cf6', '#ef4444', '#06b6d4', '#f59e0b', '#ec4899']

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'offline' | 'online' | 'free' | 'admin' | 'test' | 'on_leave' | 'withdrew'>('all')
  const [progressMap, setProgressMap] = useState<Record<string, { done: number; total: number }>>({})
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    full_name: '', email: '', customer_id: '', is_online: false, is_free_user: false,
    is_admin: false, joined_at: '', debut_date: '', account_issued_at: '',
    curriculum: '', community_member: false, myrule_permitted: false,
    is_test: false, drive_folder_url: '',
    is_on_leave: false, withdrew_at: '',
  })
  const [saving, setSaving] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // 新規作成
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    email: '', password: '', full_name: '', customer_id: '', curriculum: '',
    drive_folder_url: '', is_online: false, is_free_user: false, is_admin: false,
    is_test: false, community_member: false, myrule_permitted: false,
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [userCourseProgress, setUserCourseProgress] = useState<{ name: string; done: number; total: number; courseId: string }[]>([])
  const [courseContentDetail, setCourseContentDetail] = useState<Record<string, { name: string; completed: boolean; completedAt: string | null }[]>>({})
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null)
  const [initialPayment, setInitialPayment] = useState<{ received_at: string; amount: number | null; transaction_id: string } | null>(null)

  useEffect(() => { fetchData() }, [])

  // ユーザー詳細表示時にコースごと進捗を取得
  useEffect(() => {
    if (!selectedUser) {
      setUserCourseProgress([]); setCourseContentDetail({}); setExpandedCourse(null);
      setInitialPayment(null)
      return
    }
    const supabase = createClient()
    // 初回入金情報のみ取得（月次は users.last_payment_* に保存）
    supabase
      .from('paypal_payments')
      .select('received_at, amount, transaction_id')
      .eq('user_id', selectedUser.id)
      .eq('is_initial', true)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setInitialPayment(data || null)
      })

    async function fetchUserProgress() {
      const isOnline = selectedUser!.is_online
      const { data: courses } = await supabase
        .from('courses').select('id, name, sort_order')
        .eq('is_online', isOnline).eq('is_free', false).order('sort_order')
      if (!courses) return

      const { data: allContents } = await supabase
        .from('contents').select('id, course_id, name, sort_order')
        .in('course_id', courses.map(c => c.id))
        .order('sort_order')

      const { data: userProg } = await supabase
        .from('user_progress').select('content_id, completed, completed_at')
        .eq('user_id', selectedUser!.id)

      const progMap: Record<string, { completed: boolean; completed_at: string | null }> = {}
      userProg?.forEach(p => { progMap[p.content_id] = { completed: p.completed, completed_at: p.completed_at } })

      if (allContents) {
        const completedSet = new Set(userProg?.filter(p => p.completed).map(p => p.content_id) || [])

        const progress = courses.map(course => {
          const courseContents = allContents.filter(c => c.course_id === course.id)
          const done = courseContents.filter(c => completedSet.has(c.id)).length
          return { name: course.name, done, total: courseContents.length, courseId: course.id }
        }).filter(p => p.total > 0)
        setUserCourseProgress(progress)

        // コースごとのコンテンツ詳細
        const detail: Record<string, { name: string; completed: boolean; completedAt: string | null }[]> = {}
        courses.forEach(course => {
          const contents = allContents
            .filter(c => c.course_id === course.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(c => ({
              name: c.name,
              completed: completedSet.has(c.id),
              completedAt: progMap[c.id]?.completed_at || null,
            }))
          if (contents.length > 0) detail[course.id] = contents
        })
        setCourseContentDetail(detail)
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
      is_on_leave: !!user.is_on_leave,
      withdrew_at: user.withdrew_at ? user.withdrew_at.split('T')[0] : '',
    })
    setSelectedUser(null)
    setPwInput('')
    setPwMessage(null)
  }

  async function suggestCustomerIdFor(isOnline: boolean, setter: (v: string) => void) {
    try {
      const res = await fetch(`/api/admin/users/next-customer-id?is_online=${isOnline}`)
      const data = await res.json()
      if (data.success && data.next_customer_id) setter(data.next_customer_id)
      else alert(data.error || '取得に失敗しました')
    } catch {
      alert('取得に失敗しました')
    }
  }

  function openCreateModal() {
    setCreateForm({
      email: '', password: '', full_name: '', customer_id: '', curriculum: '',
      drive_folder_url: '', is_online: false, is_free_user: false, is_admin: false,
      is_test: false, community_member: false, myrule_permitted: false,
    })
    setCreateError(null)
    setShowCreate(true)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (!data.success) {
        setCreateError(data.error || '作成に失敗しました')
      } else {
        setShowCreate(false)
        fetchData()
      }
    } catch {
      setCreateError('通信エラーが発生しました')
    }
    setCreating(false)
  }

  async function suggestCustomerId() {
    try {
      const res = await fetch(`/api/admin/users/next-customer-id?is_online=${editForm.is_online}`)
      const data = await res.json()
      if (data.success && data.next_customer_id) {
        setEditForm({ ...editForm, customer_id: data.next_customer_id })
      } else {
        alert(data.error || '取得に失敗しました')
      }
    } catch {
      alert('取得に失敗しました')
    }
  }

  async function handleSetPassword() {
    if (!editingUser) return
    const pw = pwInput.trim()
    if (pw.length < 6) {
      setPwMessage({ ok: false, text: 'パスワードは6文字以上で指定してください' })
      return
    }
    if (!confirm(`${editingUser.full_name} のパスワードを変更します。よろしいですか？`)) return
    setPwSaving(true)
    setPwMessage(null)
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const data = await res.json()
      if (data.success) {
        setPwMessage({ ok: true, text: data.message || '更新しました' })
        setPwInput('')
      } else {
        setPwMessage({ ok: false, text: data.error || '更新に失敗しました' })
      }
    } catch {
      setPwMessage({ ok: false, text: '通信エラーが発生しました' })
    }
    setPwSaving(false)
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
      is_on_leave: editForm.is_on_leave,
      withdrew_at: editForm.withdrew_at || null,
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
    if (filter === 'on_leave' && !u.is_on_leave) return false
    if (filter === 'withdrew' && !(u.withdrew_at && new Date(u.withdrew_at) <= new Date())) return false
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{filtered.length}人 / {users.length}人</span>
          <button onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75] transition-colors">
            <KeyRound className="w-4 h-4" /> 新規ユーザー作成
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・メール・顧客IDで検索"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'offline', 'online', 'free', 'admin', 'test', 'on_leave', 'withdrew'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? f === 'test' ? 'bg-yellow-500 text-white'
                    : f === 'on_leave' ? 'bg-amber-500 text-white'
                    : f === 'withdrew' ? 'bg-rose-500 text-white'
                    : 'bg-[#384a8f] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}>
              {{ all: '全員', offline: '対面', online: 'オンライン', free: '無料', admin: '管理者', test: 'テスト', on_leave: '休学中', withdrew: '期限切れ' }[f]}
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
                        {user.is_on_leave && (
                          <span className="text-xs px-2 py-0.5 rounded w-fit bg-amber-100 text-amber-700 border border-amber-300">休学中</span>
                        )}
                        {user.withdrew_at && new Date(user.withdrew_at) <= new Date() && (
                          <span className="text-xs px-2 py-0.5 rounded w-fit bg-rose-100 text-rose-700 border border-rose-300">期限切れ</span>
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 my-8" onClick={(e) => e.stopPropagation()}>
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
              <div><span className="text-gray-500">休学:</span> <span className={`font-medium ${selectedUser.is_on_leave ? 'text-amber-700' : ''}`}>{selectedUser.is_on_leave ? '休学中' : '-'}</span></div>
              <div><span className="text-gray-500">期限日:</span> <span className={`font-medium ${selectedUser.withdrew_at && new Date(selectedUser.withdrew_at) <= new Date() ? 'text-rose-700' : ''}`}>{selectedUser.withdrew_at ? formatDate(selectedUser.withdrew_at) : '-'}</span></div>
              <div className="col-span-2"><span className="text-gray-500">最終学習コンテンツ:</span> <span className="font-medium">{selectedUser.last_content || '-'}</span></div>
              {selectedUser.drive_folder_url && (
                <div className="col-span-2"><span className="text-gray-500">Driveフォルダ:</span> <a href={selectedUser.drive_folder_url} target="_blank" rel="noopener noreferrer" className="text-[#384a8f] hover:underline font-medium ml-1">開く</a></div>
              )}
            </div>

            {/* 入金状況 */}
            <div className="mt-6 pt-4 border-t">
              <h3 className="font-bold text-gray-800 text-sm mb-3">💰 入金状況</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-emerald-700 font-bold mb-1">初回入金</p>
                  {initialPayment ? (
                    <>
                      <p className="text-gray-700">
                        {new Date(initialPayment.received_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      {initialPayment.amount && (
                        <p className="font-bold text-gray-800">¥{Number(initialPayment.amount).toLocaleString()}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400">記録なし</p>
                  )}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-700 font-bold mb-1">最終入金</p>
                  {selectedUser.last_payment_at ? (
                    <>
                      <p className="text-gray-700">
                        {new Date(selectedUser.last_payment_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      {selectedUser.last_payment_amount && (
                        <p className="font-bold text-gray-800">¥{Number(selectedUser.last_payment_amount).toLocaleString()}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-400">記録なし</p>
                  )}
                </div>
              </div>
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
                  {/* コースバー（クリックで展開） */}
                  <div className="flex-1 space-y-2">
                    {userCourseProgress.map((cp, i) => {
                      const pct = cp.total > 0 ? Math.round((cp.done / cp.total) * 100) : 0
                      const isOpen = expandedCourse === cp.courseId
                      return (
                        <button
                          key={cp.courseId}
                          type="button"
                          onClick={() => setExpandedCourse(isOpen ? null : cp.courseId)}
                          className={`w-full text-left p-2 rounded-lg transition-colors ${isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-700 truncate mr-2 flex items-center gap-1">
                              {isOpen ? <ChevronUp className="w-3 h-3 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
                              {cp.name}
                            </span>
                            <span className="text-gray-500 flex-shrink-0 font-medium">{cp.done}/{cp.total} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 展開中のコースのコンテンツ一覧 */}
                {expandedCourse && courseContentDetail[expandedCourse] && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                        {userCourseProgress.find(c => c.courseId === expandedCourse)?.name} - コンテンツ一覧
                      </h4>
                      <button
                        type="button"
                        onClick={() => setExpandedCourse(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        閉じる
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-1">
                      {courseContentDetail[expandedCourse].map((content, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded text-xs ${
                            content.completed ? 'bg-green-50' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {content.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            )}
                            <span className={`text-gray-500 font-mono w-6 flex-shrink-0 text-right`}>{idx + 1}.</span>
                            <span className={`truncate ${content.completed ? 'text-gray-700' : 'text-gray-500'}`}>
                              {content.name}
                            </span>
                          </div>
                          {content.completedAt && (
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {formatDate(content.completedAt)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        <CheckCircle2 className="inline w-3 h-3 text-green-600 mr-1" />
                        視聴済み: {courseContentDetail[expandedCourse].filter(c => c.completed).length}本
                      </span>
                      <span>
                        <Circle className="inline w-3 h-3 text-gray-300 mr-1" />
                        未視聴: {courseContentDetail[expandedCourse].filter(c => !c.completed).length}本
                      </span>
                    </div>
                  </div>
                )}
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
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 my-8" onClick={(e) => e.stopPropagation()}>
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

              {/* パスワード設定セクション（メールの直下） */}
              <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-rose-600" /> パスワード（上書き設定）
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  6文字以上を入力して「設定」を押すと Supabase Auth に反映されます。Auth未作成なら同時に作成。
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pwInput}
                    onChange={(e) => setPwInput(e.target.value)}
                    placeholder="新しいパスワード"
                    autoComplete="new-password"
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSetPassword}
                    disabled={pwSaving || pwInput.trim().length < 6}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
                  >
                    <KeyRound className="w-4 h-4" /> {pwSaving ? '更新中...' : '設定'}
                  </button>
                </div>
                {pwMessage && (
                  <p className={`text-xs mt-2 ${pwMessage.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {pwMessage.text}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    顧客ID
                    <span className="text-xs text-gray-400 ml-1">（{editForm.is_online ? 'オンライン' : '対面'}内でユニーク）</span>
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={editForm.customer_id} onChange={(e) => setEditForm({ ...editForm, customer_id: e.target.value })}
                      className="flex-1 min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                    <button type="button" onClick={suggestCustomerId} title="次番を提案"
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-xs whitespace-nowrap">
                      <Sparkles className="w-3.5 h-3.5" /> 次番
                    </button>
                  </div>
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
                  { key: 'is_on_leave', label: '休学中' },
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={(editForm as Record<string, unknown>)[opt.key] as boolean}
                      onChange={(e) => setEditForm({ ...editForm, [opt.key]: e.target.checked })}
                      className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f]" />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">退会予定日（過ぎると退会扱い）</label>
                <input type="date" value={editForm.withdrew_at} onChange={(e) => setEditForm({ ...editForm, withdrew_at: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 outline-none" />
                <p className="text-xs text-gray-400 mt-1">
                  {editForm.withdrew_at
                    ? new Date(editForm.withdrew_at) <= new Date()
                      ? '⚠ 退会予定日を過ぎているため、現在「退会済み」扱いです'
                      : '✓ 期限内（指定日を過ぎると自動的に退会扱いになります）'
                    : '無期限'}
                </p>
                {editForm.withdrew_at && (
                  <button type="button" onClick={() => setEditForm({ ...editForm, withdrew_at: '' })}
                    className="mt-1 text-xs text-rose-600 hover:underline">退会予定日をクリア（無期限に）</button>
                )}
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

      {/* 新規ユーザー作成モーダル */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">新規ユーザー作成</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">氏名 <span className="text-red-500">*</span></label>
                <input type="text" required value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
                <input type="email" required value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
                  placeholder="user@example.com" />
              </div>
              <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-rose-600" /> パスワード <span className="text-red-500">*</span>
                </label>
                <input type="text" required minLength={6} value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="6文字以上"
                  autoComplete="new-password"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 outline-none font-mono" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    顧客ID
                    <span className="text-xs text-gray-400 ml-1">（{createForm.is_online ? 'オンライン' : '対面'}内でユニーク）</span>
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={createForm.customer_id}
                      onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}
                      className="flex-1 min-w-0 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                    <button type="button"
                      onClick={() => suggestCustomerIdFor(createForm.is_online, (v) => setCreateForm({ ...createForm, customer_id: v }))}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-xs whitespace-nowrap">
                      <Sparkles className="w-3.5 h-3.5" /> 次番
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">カリキュラム</label>
                  <input type="text" value={createForm.curriculum}
                    onChange={(e) => setCreateForm({ ...createForm, curriculum: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DriveフォルダURL</label>
                <input type="url" value={createForm.drive_folder_url}
                  onChange={(e) => setCreateForm({ ...createForm, drive_folder_url: e.target.value })}
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
                    <input type="checkbox"
                      checked={(createForm as Record<string, unknown>)[opt.key] as boolean}
                      onChange={(e) => setCreateForm({ ...createForm, [opt.key]: e.target.checked })}
                      className="rounded border-gray-300 text-[#384a8f] focus:ring-[#384a8f]" />
                    {opt.label}
                  </label>
                ))}
              </div>
              {createError && (
                <div className="p-3 rounded-lg text-sm bg-rose-50 text-rose-700 border border-rose-200">
                  {createError}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={creating}
                  className="flex items-center gap-2 px-6 py-2 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] disabled:opacity-50">
                  <Save className="w-4 h-4" /> {creating ? '作成中...' : '作成'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
