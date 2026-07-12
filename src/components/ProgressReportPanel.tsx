'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Send, Lock, CheckCircle2 } from 'lucide-react'

interface ReportRow {
  id: string
  current_topic: string | null
  content: string
  reported_at: string
}

const INTERVAL_DAYS = 14

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function ProgressReportPanel() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [now] = useState(() => Date.now()) // マウント時刻を固定（render中の Date.now() を避ける）
  const [currentTopic, setCurrentTopic] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function load() {
    fetch('/api/progress-reports')
      .then((r) => r.json())
      .then((data) => { if (data?.success) setReports(data.reports as ReportRow[]) })
      .catch(() => { /* 取得失敗は一覧を空のままにする */ })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!content.trim()) { setError('進捗内容を入力してください'); return }
    if (!confirm('進捗を報告します。提出後は編集できません。よろしいですか？')) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/progress-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentTopic, content }),
      })
      const data = await res.json()
      if (data.success) {
        setCurrentTopic('')
        setContent('')
        load()
      } else {
        setError(data.message || '送信に失敗しました')
      }
    } catch {
      setError('送信に失敗しました。時間をおいて再度お試しください。')
    }
    setSubmitting(false)
  }

  const lastReport = reports[0]
  const daysSinceLast = lastReport && now
    ? Math.floor((now - new Date(lastReport.reported_at).getTime()) / (24 * 60 * 60 * 1000))
    : null
  const isDue = daysSinceLast === null || daysSinceLast >= INTERVAL_DAYS

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">進捗報告</h1>
      </div>

      {/* 状態バナー */}
      {!loading && (
        <div className={`rounded-xl px-4 py-3 text-sm ${isDue ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
          {daysSinceLast === null
            ? 'まだ進捗報告がありません。今の学習状況を記録しましょう（2週間に1回が目安です）。'
            : isDue
              ? `前回の報告から${daysSinceLast}日経っています。今の進捗を記録しましょう（2週間に1回が目安です）。`
              : `前回の報告から${daysSinceLast}日です。次回の目安まであと${INTERVAL_DAYS - daysSinceLast}日ほどです。`}
        </div>
      )}

      {/* 記録フォーム */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#384a8f] mb-4">進捗を記録する</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">現在の学習箇所（任意）</label>
            <input
              type="text"
              value={currentTopic}
              onChange={(e) => setCurrentTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.preventDefault() }}
              placeholder="例: カリキュラム 第3章 / 動画No.12 あたり"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">進捗内容 <span className="text-rose-500">*</span></label>
            <textarea
              rows={5}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="今どこまで進んだか、取り組んだこと、つまずいている点などを記録してください。"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-[#384a8f] focus:border-transparent outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> 提出後は編集できません（記録として残ります）。
          </p>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? '送信中...' : '報告する'}
          </button>
        </form>
      </div>

      {/* これまでの報告 */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#384a8f] mb-4">これまでの報告</h2>
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="animate-spin w-6 h-6 border-4 border-[#384a8f] border-t-transparent rounded-full" />
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-gray-400">まだ報告はありません。</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
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
    </div>
  )
}
