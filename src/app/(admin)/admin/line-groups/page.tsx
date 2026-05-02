'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { MessageCircle, RefreshCw, Copy, Check, Info, Bell } from 'lucide-react'

type LineGroup = {
  id: string
  group_id: string
  source_type: string
  display_name: string | null
  is_peak_bottom_target: boolean
  last_event_type: string | null
  last_event_at: string | null
  created_at: string
}

export default function LineGroupsPage() {
  const [groups, setGroups] = useState<LineGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/line-groups')
      const data = await res.json()
      if (data.success) setGroups(data.groups || [])
    } catch {
      toast.error('取得失敗')
    }
    setLoading(false)
  }

  async function copyId(groupId: string) {
    await navigator.clipboard.writeText(groupId)
    setCopied(groupId)
    setTimeout(() => setCopied(null), 1500)
  }

  async function setTarget(g: LineGroup) {
    const res = await fetch(`/api/admin/line-groups?id=${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_peak_bottom_target: !g.is_peak_bottom_target }),
    })
    const data = await res.json()
    if (data.success) {
      toast.success(g.is_peak_bottom_target ? '通知先から外しました' : '通知先に設定しました')
      fetchData()
    } else toast.error(data.error || '更新失敗')
  }

  async function saveName(g: LineGroup) {
    const res = await fetch(`/api/admin/line-groups?id=${g.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: editName }),
    })
    const data = await res.json()
    if (data.success) {
      setEditing(null)
      fetchData()
    } else toast.error(data.error || '更新失敗')
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-[#06C755]" /> LINEグループ / トーク管理
        </h1>
        <button onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> 更新
        </button>
      </div>

      {/* セットアップ手順 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p className="font-bold">グループID 取得手順</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-800">
              <li>
                LINE Developers の Messaging API 設定で <strong>Webhook URL</strong> を以下に設定<br />
                <code className="bg-white px-2 py-0.5 rounded text-xs font-mono">https://tts-e.vercel.app/api/line/webhook</code>
              </li>
              <li>「Webhookの利用」を ON にする</li>
              <li>TTS LINE Bot を**通知したいグループに招待**（または Bot に1対1で話しかける）</li>
              <li>グループ内で「**ID教えて**」と発言 → Bot が ID を返信 + この画面に自動登録</li>
              <li>下の表で「通知先」ボタンを押して、ピークボトム申請通知の宛先に設定</li>
            </ol>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
          まだグループ/トークが登録されていません。<br />
          上記の手順に従って Bot にメッセージを送ってみてください。
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">表示名</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">種別</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">最終受信</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map((g) => (
                <tr key={g.id} className={g.is_peak_bottom_target ? 'bg-emerald-50' : ''}>
                  <td className="px-4 py-3">
                    {editing === g.id ? (
                      <div className="flex gap-1">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-1 border rounded text-sm" />
                        <button onClick={() => saveName(g)} className="px-2 py-1 text-xs bg-[#384a8f] text-white rounded">保存</button>
                        <button onClick={() => setEditing(null)} className="px-2 py-1 text-xs bg-gray-200 rounded">×</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditing(g.id); setEditName(g.display_name || '') }}
                        className="text-left hover:underline">
                        {g.display_name || <span className="text-gray-400">（名前を設定）</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      g.source_type === 'group' ? 'bg-purple-100 text-purple-700' :
                      g.source_type === 'room' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {g.source_type === 'group' ? 'グループ' : g.source_type === 'room' ? 'トークルーム' : '個人'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => copyId(g.group_id)}
                      className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 hover:bg-slate-100 px-2 py-1 rounded">
                      {copied === g.group_id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {g.group_id.slice(0, 14)}…
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {g.last_event_at ? new Date(g.last_event_at).toLocaleString('ja-JP') : '-'}
                    {g.last_event_type && <div className="text-xs text-gray-400">{g.last_event_type}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setTarget(g)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg font-medium ${
                        g.is_peak_bottom_target
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      <Bell className="w-3 h-3" />
                      {g.is_peak_bottom_target ? 'ピークボトム通知先' : '通知先にする'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
