'use client'

/**
 * LINE 一斉配信（会員種別ごと）
 *
 * オンライン会員／対面会員を切り替え、連携済みの会員に LINE で一斉配信する。
 * 「誰に届くか（連携済み・通知オン）」「届かない人（未連携・通知オフ）」を可視化する。
 * 管理者通知の送信先グループ設定（旧 LINEグループ）はページ下部からリンクで残す。
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Send, CheckCircle2, Settings, Users } from 'lucide-react'
import type { User } from '@/types/database'

type Member = Pick<
  User,
  | 'id'
  | 'full_name'
  | 'customer_id'
  | 'is_online'
  | 'is_admin'
  | 'is_test'
  | 'is_free_user'
  | 'study_notify_enabled'
  | 'line_user_id_online'
  | 'line_user_id_offline'
>

type Audience = 'online' | 'offline'

export default function LineBroadcastPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [audience, setAudience] = useState<Audience>('offline')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('users')
        .select(
          'id, full_name, customer_id, is_online, is_admin, is_test, is_free_user, study_notify_enabled, line_user_id_online, line_user_id_offline'
        )
      if (data) setMembers(data as Member[])
      setLoading(false)
    })()
  }, [])

  const groups = useMemo(() => {
    const typeOf = (m: Member) =>
      audience === 'online' ? m.is_online : !m.is_online && !m.is_free_user
    const lineIdOf = (m: Member) =>
      audience === 'online' ? m.line_user_id_online : m.line_user_id_offline

    const list = members.filter((m) => !m.is_admin && !m.is_test && typeOf(m))
    const connected = list.filter((m) => !!lineIdOf(m))
    const willReceive = connected
      .filter((m) => m.study_notify_enabled !== false)
      .sort((a, b) => (a.customer_id ?? '').localeCompare(b.customer_id ?? '', 'ja'))
    const notifyOff = connected.filter((m) => m.study_notify_enabled === false)
    const notConnected = list.filter((m) => !lineIdOf(m))
    return { willReceive, notifyOff, notConnected }
  }, [members, audience])

  async function handleSend() {
    if (!message.trim() || sending) return
    if (groups.willReceive.length === 0) {
      setResult({ ok: false, text: '送信対象（連携済み・通知オン）がいません。' })
      return
    }
    const label = audience === 'online' ? 'オンライン' : '対面'
    if (!confirm(`${label}会員のうち、連携済み ${groups.willReceive.length}名 にLINEで一斉配信します。よろしいですか？`)) {
      return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/line-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, message: message.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        const failTxt = data.failed ? ` / ${data.failed}名 失敗` : ''
        setResult({
          ok: data.failed === 0,
          text: `送信完了: ${data.sent}名 成功${failTxt}。実際の着信もご確認ください。`,
        })
        if (data.failed === 0) setMessage('')
      } else {
        const reasons: Record<string, string> = {
          forbidden: '権限がありません（管理者でログインしてください）。',
          invalid_input: '入力内容を確認してください。',
          server_error: 'サーバーエラーが発生しました。',
        }
        setResult({ ok: false, text: reasons[data.reason] || '送信に失敗しました。' })
      }
    } catch {
      setResult({ ok: false, text: '通信エラーが発生しました。' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-1 flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-[#06C755]" />
        LINE一斉配信
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        会員種別ごとに、連携済みの方へLINEで一斉配信します。
      </p>

      {/* 対象種別 */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'offline' as Audience, label: '対面会員' },
          { key: 'online' as Audience, label: 'オンライン会員' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setAudience(t.key)
              setResult(null)
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              audience === t.key
                ? 'bg-[#384a8f] text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">読み込み中...</p>
      ) : (
        <>
          {/* 対象サマリー */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                送信対象：{groups.willReceive.length}名（連携済み・通知オン）
              </span>
            </div>
            {groups.willReceive.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {groups.willReceive.map((m) => (
                  <span
                    key={m.id}
                    className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded"
                  >
                    {m.customer_id ? `${m.customer_id} ` : ''}
                    {m.full_name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">送信対象がいません。</p>
            )}

            {(groups.notConnected.length > 0 || groups.notifyOff.length > 0) && (
              <div className="mt-3 pt-3 border-t text-xs text-gray-400 space-y-1">
                {groups.notConnected.length > 0 && (
                  <p>未連携（届きません）：{groups.notConnected.length}名 — {groups.notConnected.map((m) => m.full_name).join('、')}</p>
                )}
                {groups.notifyOff.length > 0 && (
                  <p>通知オフ（除外）：{groups.notifyOff.length}名 — {groups.notifyOff.map((m) => m.full_name).join('、')}</p>
                )}
              </div>
            )}
          </div>

          {/* メッセージ */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">メッセージ</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder={'例）\n{{full_name}}様\n\n次回の勉強会のご案内です。'}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06C755] focus:border-[#06C755] outline-none transition resize-y text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              <code className="bg-gray-100 px-1 rounded">{'{{full_name}}'}</code> と書くと、各会員の氏名に置き換わります。
            </p>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !message.trim() || groups.willReceive.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#06C755] text-white font-medium hover:bg-[#05a548] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? '送信中...' : `${audience === 'online' ? 'オンライン' : '対面'}会員 ${groups.willReceive.length}名に配信`}
          </button>

          {result && (
            <div
              className={`mt-3 flex items-start gap-2 text-sm p-3 rounded-lg ${
                result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {result.ok && <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              <span>{result.text}</span>
            </div>
          )}

          {/* 通知先グループ設定（旧 LINEグループ）への導線 */}
          <div className="mt-8 pt-4 border-t">
            <Link
              href="/admin/line-groups"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#384a8f]"
            >
              <Settings className="w-3.5 h-3.5" />
              管理者通知の送信先グループ設定（空き待ち・新規申込の通知先）
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
