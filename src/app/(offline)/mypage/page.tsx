'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { User, Lock, Save, CheckCircle2, ExternalLink } from 'lucide-react'
import { formatDate, daysSince } from '@/lib/utils'

export default function MyPage() {
  const { user, loading } = useUser()
  const [editing, setEditing] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')

    if (newPassword.length < 6) {
      setPasswordError('パスワードは6文字以上で設定してください')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('パスワードが一致しません')
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPasswordError('パスワードの変更に失敗しました')
      return
    }

    setPasswordSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => setPasswordSuccess(false), 3000)
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
      </div>
    )
  }

  const elapsed = daysSince(user.account_issued_at)

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">マイページ</h1>
      </div>

      {/* プロフィール情報 */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#384a8f] mb-4">プロフィール</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">お名前</p>
            <p className="font-medium text-gray-800">{user.full_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">メールアドレス</p>
            <p className="font-medium text-gray-800">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">顧客ID</p>
            <p className="font-medium text-gray-800">{user.customer_id || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">入会日</p>
            <p className="font-medium text-gray-800">{formatDate(user.joined_at)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">アカウント発行日</p>
            <p className="font-medium text-gray-800">{formatDate(user.account_issued_at)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">経過日数</p>
            <p className="font-medium text-gray-800">{elapsed}日</p>
          </div>
          {user.debut_date && (
            <div>
              <p className="text-sm text-gray-500">デビュー日</p>
              <p className="font-medium text-gray-800">{formatDate(user.debut_date)}</p>
            </div>
          )}
          {user.drive_folder_url && (
            <div>
              <p className="text-sm text-gray-500">売買記録表</p>
              <a
                href={user.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#384a8f] hover:underline"
              >
                Google Drive <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* カリキュラム */}
      {user.curriculum && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#384a8f] mb-2">現在のカリキュラム</h2>
          <p className="text-gray-800">{user.curriculum}</p>
        </div>
      )}

      {/* パスワード変更 */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#384a8f] mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          パスワード変更
        </h2>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード確認</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
            />
          </div>

          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> パスワードを変更しました
            </p>
          )}

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors"
          >
            <Save className="w-4 h-4" />
            変更する
          </button>
        </form>
      </div>
    </div>
  )
}
