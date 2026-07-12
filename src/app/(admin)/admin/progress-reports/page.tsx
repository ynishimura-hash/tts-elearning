'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ClipboardList, Send, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react'

const INTERVAL_DAYS = 14
const DAY = 24 * 60 * 60 * 1000

interface Tester {
  id: string
  full_name: string
  is_online: boolean
  account_issued_at: string | null
}
interface Report {
  id: string
  user_id: string
  current_topic: string | null
  content: string
  reported_at: string
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminProgressReportsPage() {
  const [testers, setTesters] = useState<Tester[]>([])
  const [reportsByUser, setReportsByUser] = useState<Record<string, Report[]>>({})
  const [loading, setLoading] = useState(true)
  const [now] = useState(() => Date.now()) // マウント時刻を固定（render中の Date.now() を避ける）
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  function fetchData() {
    const supabase = createClient()
    Promise.all([
      supabase
        .from('users')
        .select('id, full_name, is_online, account_issued_at')
        .eq('is_admin', false)
        .eq('is_test', false)
        .eq('is_tester', true)
        .order('full_name', { ascending: true }),
      fetch('/api/admin/progress-reports').then((r) => r.json()).catch(() => null),
    ])
      .then(([usersRes, reportsRes]) => {
        const users = (usersRes.data ?? []) as Tester[]
        const reports: Report[] = reportsRes?.success ? (reportsRes.reports as Report[]) : []
        const map: Record<string, Report[]> = {}
        reports.forEach((r) => {
          if (!map[r.user_id]) map[r.user_id] = []
          map[r.user_id].push(r)
        })
        setReportsByUser(map)
        setTesters(users)
      })
      .catch(() => { /* 取得失敗時は空表示 */ })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function sendInvite() {
    if (!confirm('対象テスター全員に、進捗報告の案内をLINEで今すぐ送信しますか？')) return
    setSending(true)
    try {
      const res = await fetch('/api/line/progress-invite', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert(`進捗報告の案内を${data.sentCount ?? 0}人に送信しました（対象${data.targetCount ?? 0}人）。実際の着信もご確認ください。`)
      } else {
        alert(data.message || '送信に失敗しました')
      }
    } catch {
      alert('送信に失敗しました')
    }
    setSending(false)
  }

  /** 最終報告からの経過日数（未報告は null） */
  function daysSinceLast(userId: string): number | null {
    const list = reportsByUser[userId]
    if (!list || list.length === 0) return null
    const latest = list.reduce((a, b) => (a.reported_at > b.reported_at ? a : b))
    return Math.floor((now - new Date(latest.reported_at).getTime()) / DAY)
  }

  // 遅延（未報告 or 14日超）を上に、次いで経過日数が多い順
  const sorted = [...testers].sort((a, b) => {
    const da = daysSinceLast(a.id)
    const db = daysSinceLast(b.id)
    const va = da === null ? Number.MAX_SAFE_INTEGER : da
    const vb = db === null ? Number.MAX_SAFE_INTEGER : db
    return vb - va
  })

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-[#384a8f]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">進捗報告管理</h1>
        </div>
        <button onClick={sendInvite} disabled={sending}
          className="flex items-center gap-2 px-4 py-2 bg-[#06C755] text-white rounded-lg text-sm font-medium hover:bg-[#05a548] transition-colors disabled:opacity-50">
          <Send className="w-4 h-4" />
          {sending ? '送信中...' : '進捗報告の案内を送信'}
        </button>
      </div>

      <p className="text-sm text-gray-500">
        対象はテスターです。2週間に1回の報告を目安に、前回報告から14日を過ぎた方へは自動でLINE催促されます。
      </p>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-8 h-8 border-4 border-[#384a8f] border-t-transparent rounded-full" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">テスターがいません</div>
      ) : (
        <div className="space-y-3">
          {sorted.map((t) => {
            const list = reportsByUser[t.id] ?? []
            const since = daysSinceLast(t.id)
            const overdue = since === null || since >= INTERVAL_DAYS
            const isOpen = expanded.has(t.id)
            return (
              <div key={t.id} className="bg-white rounded-xl shadow-sm">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{t.full_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${t.is_online ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                        {t.is_online ? 'オンライン' : '対面'}
                      </span>
                      {overdue ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {since === null ? '未報告' : `${since}日経過`}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />{since}日前
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">報告 {list.length} 件</p>
                  </div>
                  {list.length > 0 && (
                    <button onClick={() => toggle(t.id)}
                      className="inline-flex items-center gap-1 text-sm text-[#384a8f] hover:underline flex-shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {isOpen ? '閉じる' : '報告を見る'}
                    </button>
                  )}
                </div>

                {isOpen && list.length > 0 && (
                  <div className="border-t px-4 py-3 space-y-3">
                    {list.map((r) => (
                      <div key={r.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs text-gray-500">{formatDateTime(r.reported_at)}</span>
                          {r.current_topic && (
                            <span className="text-xs px-2 py-0.5 rounded bg-[#384a8f]/10 text-[#384a8f]">{r.current_topic}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
