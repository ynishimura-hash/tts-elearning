'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Mail, Send, Upload, UserPlus, Plus, Trash2, Eye, TestTube, Clock,
  CheckCircle2, History, Sparkles, X, FileDown, AlertCircle, KeyRound,
  Search, ChevronUp, ChevronDown,
} from 'lucide-react'

// ============================================================
// 型
// ============================================================
type Recipient = {
  email: string
  full_name?: string | null
  customer_id?: string | null
  temp_password?: string | null
}

type ViewMode = 'compose' | 'history'

type UserRow = {
  id: string
  email: string
  full_name: string
  customer_id: string | null
  is_admin: boolean
  is_online: boolean
  is_free_user: boolean
  is_test?: boolean
  is_on_leave?: boolean
  withdrew_at?: string | null
}

type BroadcastResult = {
  total: number
  sent: number
  failed: number
  skipped: number
  errors: { email: string; error: string }[]
}

type IssuedPassword = {
  user_id: string
  email: string
  full_name: string
  customer_id: string | null
  temp_password: string
  status: 'created' | 'updated' | 'failed'
  error?: string
}

// ============================================================
// テンプレート
// ============================================================
const TEMPLATES: Array<{ id: string; name: string; subject: string; body: string }> = [
  {
    id: 'adalo-migration',
    name: 'Adalo からの移行案内（仮パスワード）',
    subject: '【TTS e-ラーニング】新システムへの移行のお知らせ',
    body: `{{full_name}}様

いつもお世話になっております。TTS e-ラーニング事務局です。

このたび TTS の e-ラーニングシステムを新しいプラットフォームへ移行いたしました。
お手数ですが、下記情報で初回ログインをお願いいたします。

──────────────────────
ログインURL: {{login_url}}
メールアドレス: {{email}}
仮パスワード: {{temp_password}}
──────────────────────

※初回ログイン後、マイページからパスワードの変更をお願いします。
※ご不明な点は、本メールへご返信ください。

引き続きよろしくお願いいたします。
TTS e-ラーニング事務局`,
  },
  {
    id: 'general-announce',
    name: '一般お知らせ',
    subject: '【TTS】お知らせ',
    body: `{{full_name}}様

いつもお世話になっております。

（本文を入力してください）

TTS e-ラーニング事務局`,
  },
]

const VARIABLES = [
  { key: 'full_name', desc: '受講者氏名' },
  { key: 'email', desc: 'メールアドレス' },
  { key: 'customer_id', desc: '顧客ID' },
  { key: 'temp_password', desc: '仮パスワード（移行モードで自動付与）' },
  { key: 'login_url', desc: 'ログインURL' },
]

// ============================================================
// ページ
// ============================================================
export default function AdminBroadcastsPage() {
  const [view, setView] = useState<ViewMode>('compose')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [manualEmail, setManualEmail] = useState('')
  const [manualName, setManualName] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<BroadcastResult | null>(null)
  const [preview, setPreview] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 配信履歴
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ユーザー選択モーダル
  const [showUserModal, setShowUserModal] = useState(false)
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userFilter, setUserFilter] = useState<'all' | 'offline' | 'online' | 'free' | 'admin'>('all')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())

  // テスト送信
  const [showTestModal, setShowTestModal] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  // 移行モード
  const [migrateScope, setMigrateScope] =
    useState<'all' | 'offline' | 'online' | 'free'>('all')
  const [migrating, setMigrating] = useState(false)
  const [issued, setIssued] = useState<IssuedPassword[] | null>(null)
  const [migrateError, setMigrateError] = useState<string | null>(null)

  // ============================================================
  // 操作: テンプレート / 変数挿入
  // ============================================================
  function applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    setSubject(t.subject)
    setBodyText(t.body)
  }

  function insertVariable(key: string) {
    setBodyText((prev) => `${prev}{{${key}}}`)
  }

  // ============================================================
  // 宛先操作
  // ============================================================
  function addManualRecipient() {
    if (!manualEmail.includes('@')) return
    if (recipients.find((r) => r.email === manualEmail)) return
    setRecipients([...recipients, { email: manualEmail, full_name: manualName || null }])
    setManualEmail('')
    setManualName('')
  }

  function removeRecipient(idx: number) {
    setRecipients(recipients.filter((_, i) => i !== idx))
  }

  function clearRecipients() {
    if (recipients.length === 0) return
    if (confirm('全ての宛先を削除しますか？')) setRecipients([])
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = (ev.target?.result as string).replace(/^\ufeff/, '') // BOM 除去
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length === 0) return

      // ヘッダー解析: email/full_name/temp_password/customer_id 列を自動検出
      const splitCsv = (line: string) => {
        const out: string[] = []
        let cur = ''
        let inQuote = false
        for (let i = 0; i < line.length; i++) {
          const c = line[i]
          if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue }
          if (c === '"') { inQuote = !inQuote; continue }
          if (c === ',' && !inQuote) { out.push(cur); cur = ''; continue }
          cur += c
        }
        out.push(cur)
        return out.map((s) => s.trim())
      }

      const header = splitCsv(lines[0]).map((h) => h.toLowerCase())
      const hasHeader =
        header.includes('email') ||
        header.includes('full_name') ||
        header.includes('temp_password') ||
        header.includes('name')

      const idxEmail = header.indexOf('email')
      const idxName = header.includes('full_name')
        ? header.indexOf('full_name')
        : header.indexOf('name')
      const idxPw = header.indexOf('temp_password')
      const idxCust = header.indexOf('customer_id')

      const next: Recipient[] = []
      const dataLines = hasHeader ? lines.slice(1) : lines
      for (const line of dataLines) {
        const cols = splitCsv(line)
        let email = ''
        let name: string | null = null
        let pw: string | null = null
        let cust: string | null = null
        if (hasHeader && idxEmail >= 0) {
          email = cols[idxEmail] || ''
          name = idxName >= 0 ? (cols[idxName] || null) : null
          pw = idxPw >= 0 ? (cols[idxPw] || null) : null
          cust = idxCust >= 0 ? (cols[idxCust] || null) : null
        } else {
          // ヘッダー無しは email を含む列を自動検出
          const emailCol = cols.findIndex((c) => c.includes('@'))
          if (emailCol < 0) continue
          email = cols[emailCol]
          name = cols.filter((_, i) => i !== emailCol).join(' ').trim() || null
        }
        if (email && !next.find((r) => r.email === email)) {
          next.push({
            email,
            full_name: name,
            temp_password: pw,
            customer_id: cust,
          })
        }
      }

      setRecipients((prev) => {
        const existing = new Set(prev.map((r) => r.email))
        return [...prev, ...next.filter((r) => !existing.has(r.email))]
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ============================================================
  // ユーザー選択
  // ============================================================
  async function openUserModal() {
    setShowUserModal(true)
    setUserSearch('')
    setSelectedUserIds(new Set())
    if (users.length === 0) {
      setUsersLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('users')
        .select('id, email, full_name, customer_id, is_admin, is_online, is_free_user, is_test, is_on_leave, withdrew_at')
        .order('full_name', { ascending: true })
      setUsers((data || []) as UserRow[])
      setUsersLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (!u.email) return false
      if (recipients.find((r) => r.email === u.email)) return false
      // テストアカウント・退会済みは配信対象外として常に非表示
      // （withdrew_at は退会予定日。今日以前のものは退会済み扱い）
      if (u.is_test) return false
      if (u.withdrew_at && new Date(u.withdrew_at) <= new Date()) return false
      if (userFilter === 'offline' && (u.is_online || u.is_free_user || u.is_admin)) return false
      if (userFilter === 'online' && (!u.is_online || u.is_free_user || u.is_admin)) return false
      if (userFilter === 'free' && !u.is_free_user) return false
      if (userFilter === 'admin' && !u.is_admin) return false
      if (userSearch) {
        const q = userSearch.toLowerCase()
        if (
          !u.full_name?.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !(u.customer_id || '').toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }, [users, userFilter, userSearch, recipients])

  function toggleSelectUser(id: string) {
    const next = new Set(selectedUserIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedUserIds(next)
  }

  function selectAllFiltered() {
    setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)))
  }

  function addSelectedUsers() {
    const next: Recipient[] = []
    for (const id of selectedUserIds) {
      const u = users.find((x) => x.id === id)
      if (u?.email) {
        next.push({
          email: u.email,
          full_name: u.full_name,
          customer_id: u.customer_id,
        })
      }
    }
    setRecipients((prev) => {
      const existing = new Set(prev.map((r) => r.email))
      return [...prev, ...next.filter((r) => !existing.has(r.email))]
    })
    setSelectedUserIds(new Set())
    setShowUserModal(false)
  }

  // ============================================================
  // 送信
  // ============================================================
  async function handleSend() {
    if (!subject || !bodyText || recipients.length === 0) {
      alert('件名・本文・宛先を入力してください')
      return
    }
    if (!confirm(`${recipients.length}名にメールを送信します。よろしいですか？`)) return

    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, bodyText, recipients }),
      })
      const data = await res.json()
      if (data.success) setResult(data.result)
      else alert(data.error || '送信に失敗しました')
    } catch {
      alert('送信中にエラーが発生しました')
    }
    setSending(false)
  }

  async function handleTestSend() {
    if (!subject || !bodyText || !testEmail.includes('@')) {
      alert('件名・本文・テスト送信先を入力してください')
      return
    }
    setTestSending(true)
    setTestMessage(null)
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, bodyText, testEmail }),
      })
      const data = await res.json()
      if (data.success) setTestMessage(`テスト送信完了: ${testEmail}`)
      else setTestMessage(`失敗: ${data.error}`)
    } catch {
      setTestMessage('送信中にエラーが発生しました')
    }
    setTestSending(false)
  }

  // ============================================================
  // 履歴
  // ============================================================
  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/admin/broadcast')
      const data = await res.json()
      if (data.success) setHistory(data.data || [])
    } catch {
      // ignore
    }
    setHistoryLoading(false)
  }

  // ============================================================
  // Adalo 移行: 仮パスワード一括発行
  // ============================================================
  async function handleIssuePasswords() {
    if (
      !confirm(
        '対象ユーザー全員に仮パスワードを発行します。\n既存ユーザーはパスワードが上書きされます。\n実行しますか？'
      )
    )
      return
    setMigrating(true)
    setIssued(null)
    setMigrateError(null)
    try {
      const res = await fetch('/api/admin/migrate/temp-passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: migrateScope, dryRun: false }),
      })
      const data = await res.json()
      if (!data.success) {
        setMigrateError(data.error || '仮パスワード発行に失敗しました')
      } else {
        setIssued(data.issued || [])
      }
    } catch (err) {
      setMigrateError(String(err))
    }
    setMigrating(false)
  }

  function downloadIssuedCsv() {
    if (!issued?.length) return
    const header = 'email,full_name,customer_id,temp_password,status\n'
    const rows = issued
      .map((i) =>
        [i.email, i.full_name, i.customer_id ?? '', i.temp_password, i.status]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n')
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tts-temp-passwords-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function loadIssuedAsRecipients() {
    if (!issued?.length) return
    const next: Recipient[] = issued
      .filter((i) => i.status !== 'failed')
      .map((i) => ({
        email: i.email,
        full_name: i.full_name,
        customer_id: i.customer_id,
        temp_password: i.temp_password,
      }))
    setRecipients(next)
    setView('compose')
    applyTemplate('adalo-migration')
  }

  // ============================================================
  // プレビュー
  // ============================================================
  function getPreview(): { subject: string; body: string } {
    const sample = recipients[0] ?? {
      email: 'sample@example.com',
      full_name: '山田太郎',
      customer_id: 'CUS-0001',
      temp_password: 'Abcd1234XyZ',
    }
    const vars: Record<string, string> = {
      full_name: sample.full_name || '',
      email: sample.email,
      customer_id: sample.customer_id || '',
      temp_password: sample.temp_password || '',
      login_url: `${origin()}/login`,
    }
    const render = (s: string) =>
      s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => vars[k] ?? '')
    return { subject: render(subject), body: render(bodyText) }
  }

  // ============================================================
  // レイアウト
  // ============================================================
  return (
    <div className="space-y-6">
      {/* タブ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Mail className="w-6 h-6 text-[#384a8f]" />
          メール配信
        </h1>
        <div className="flex items-center gap-2">
          <TabBtn active={view === 'compose'} onClick={() => setView('compose')}>
            <Send className="w-4 h-4" /> 配信
          </TabBtn>
          <TabBtn
            active={view === 'history'}
            onClick={() => {
              setView('history')
              loadHistory()
            }}
          >
            <History className="w-4 h-4" /> 履歴
          </TabBtn>
        </div>
      </div>

      {view === 'compose' && (
        <ComposeView
          subject={subject}
          setSubject={setSubject}
          bodyText={bodyText}
          setBodyText={setBodyText}
          recipients={recipients}
          setRecipients={setRecipients}
          result={result}
          sending={sending}
          preview={preview}
          setPreview={setPreview}
          getPreview={getPreview}
          onApplyTemplate={applyTemplate}
          onInsertVariable={insertVariable}
          onAddManual={addManualRecipient}
          onRemoveRecipient={removeRecipient}
          onClearRecipients={clearRecipients}
          manualEmail={manualEmail}
          setManualEmail={setManualEmail}
          manualName={manualName}
          setManualName={setManualName}
          fileRef={fileRef}
          onCSV={handleCSV}
          onOpenUserModal={openUserModal}
          onSend={handleSend}
          onOpenTest={() => setShowTestModal(true)}
        />
      )}

      {view === 'history' && (
        <HistoryView loading={historyLoading} history={history} onBack={() => setView('compose')} />
      )}

      {/* テスト送信モーダル */}
      {showTestModal && (
        <Modal onClose={() => { setShowTestModal(false); setTestMessage(null) }}>
          <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <TestTube className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">テスト送信</h2>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-500">
              件名に「[テスト]」を付けて、指定アドレスに 1 通だけ送信します。
              変数は仮の値で置換されます（full_name=テスト宛先 等）。
            </p>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your-email@example.com"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              autoFocus
            />
            {testMessage && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  testMessage.startsWith('テスト送信完了')
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {testMessage}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
            <button
              onClick={() => { setShowTestModal(false); setTestMessage(null) }}
              className="px-4 py-2.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              閉じる
            </button>
            <button
              onClick={handleTestSend}
              disabled={!testEmail.includes('@') || testSending}
              className="px-6 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {testSending ? '送信中...' : 'テスト送信'}
            </button>
          </div>
        </Modal>
      )}

      {/* ユーザー選択モーダル */}
      {showUserModal && (
        <Modal onClose={() => setShowUserModal(false)} maxWidth="max-w-3xl">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" /> 受講者から宛先を選択
            </h2>
            <span className="text-xs text-slate-500">
              {filteredUsers.length}名表示 / {selectedUserIds.size}名選択中
            </span>
          </div>
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="名前・メール・顧客IDで検索..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'offline', 'online', 'free', 'admin'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setUserFilter(f)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    userFilter === f
                      ? 'bg-emerald-100 text-emerald-700 font-medium'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f === 'all' && '全員'}
                  {f === 'offline' && '対面のみ'}
                  {f === 'online' && 'オンラインのみ'}
                  {f === 'free' && '無料ユーザー'}
                  {f === 'admin' && '管理者'}
                </button>
              ))}
              <button
                onClick={selectAllFiltered}
                className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100"
              >
                表示中を全選択
              </button>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[50vh]">
            {usersLoading ? (
              <div className="text-center py-12 text-slate-400">読み込み中...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                該当ユーザーがいません
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="表示中を全選択/全解除"
                        checked={
                          filteredUsers.length > 0 &&
                          filteredUsers.every((u) => selectedUserIds.has(u.id))
                        }
                        ref={(el) => {
                          if (!el) return
                          const some = filteredUsers.some((u) => selectedUserIds.has(u.id))
                          const all = filteredUsers.every((u) => selectedUserIds.has(u.id))
                          el.indeterminate = some && !all
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserIds(new Set([
                              ...selectedUserIds,
                              ...filteredUsers.map((u) => u.id),
                            ]))
                          } else {
                            const next = new Set(selectedUserIds)
                            for (const u of filteredUsers) next.delete(u.id)
                            setSelectedUserIds(next)
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">名前</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600 hidden md:table-cell">メール</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">区分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => toggleSelectUser(u.id)}
                      className={`cursor-pointer ${
                        selectedUserIds.has(u.id) ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.id)}
                          readOnly
                          className="rounded border-slate-300 text-emerald-600 pointer-events-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{u.full_name}</td>
                      <td className="px-3 py-2.5 text-slate-500 hidden md:table-cell">{u.email}</td>
                      <td className="px-3 py-2.5 text-xs space-x-1">
                        {u.is_admin && <Tag color="violet">管理者</Tag>}
                        {u.is_free_user && <Tag color="amber">無料</Tag>}
                        {!u.is_admin && !u.is_free_user && (u.is_online ? <Tag color="cyan">オンライン</Tag> : <Tag color="blue">対面</Tag>)}
                        {u.is_on_leave && <Tag color="amber">休学</Tag>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-white">
            <button
              onClick={() => setShowUserModal(false)}
              className="px-4 py-2.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              キャンセル
            </button>
            <button
              onClick={addSelectedUsers}
              disabled={selectedUserIds.size === 0}
              className="px-6 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
            >
              {selectedUserIds.size > 0 ? `${selectedUserIds.size}名を宛先に追加` : '選択してください'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ============================================================
// 配信ビュー
// ============================================================
interface ComposeViewProps {
  subject: string
  setSubject: (v: string) => void
  bodyText: string
  setBodyText: (v: string) => void
  recipients: Recipient[]
  setRecipients: (v: Recipient[]) => void
  result: BroadcastResult | null
  sending: boolean
  preview: boolean
  setPreview: (v: boolean) => void
  getPreview: () => { subject: string; body: string }
  onApplyTemplate: (id: string) => void
  onInsertVariable: (key: string) => void
  onAddManual: () => void
  onRemoveRecipient: (idx: number) => void
  onClearRecipients: () => void
  manualEmail: string
  setManualEmail: (v: string) => void
  manualName: string
  setManualName: (v: string) => void
  fileRef: React.RefObject<HTMLInputElement | null>
  onCSV: (e: React.ChangeEvent<HTMLInputElement>) => void
  onOpenUserModal: () => void
  onSend: () => void
  onOpenTest: () => void
}

function ComposeView(p: ComposeViewProps) {
  const previewData = p.preview ? p.getPreview() : null
  return (
    <>
      {p.result && (
        <div
          className={`p-4 rounded-xl border ${
            p.result.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2
              className={`w-5 h-5 ${p.result.failed > 0 ? 'text-amber-600' : 'text-emerald-600'}`}
            />
            <div>
              <p className="font-medium text-slate-800">
                {p.result.sent}名に送信完了
                {p.result.failed > 0 && `（${p.result.failed}名失敗）`}
                {p.result.skipped > 0 && `（${p.result.skipped}名が配信停止中のためスキップ）`}
              </p>
              {p.result.errors?.map((e, i) => (
                <p key={i} className="text-sm text-rose-600 mt-1">
                  {e.email}: {e.error}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左：作成 */}
        <div className="lg:col-span-2 space-y-4">
          {/* テンプレート */}
          <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> テンプレート
            </label>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => p.onApplyTemplate(t.id)}
                  className="px-3 py-2 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 font-medium"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* 件名・本文 */}
          <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm border border-slate-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">件名</label>
              <input
                type="text"
                value={p.subject}
                onChange={(e) => p.setSubject(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none"
                placeholder="例: 【TTS】新システム移行のお知らせ"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">本文</label>
                <button
                  onClick={() => p.setPreview(!p.preview)}
                  className="flex items-center gap-1 text-xs text-[#384a8f] hover:text-[#2a3970]"
                >
                  <Eye className="w-3.5 h-3.5" /> {p.preview ? '編集に戻る' : 'プレビュー'}
                </button>
              </div>
              {p.preview && previewData ? (
                <div className="border border-slate-200 rounded-lg p-5 min-h-[300px] bg-slate-50">
                  <div className="text-xs text-slate-500 mb-2">
                    プレビュー（{p.recipients[0] ? `1人目: ${p.recipients[0].email}` : 'サンプル値'}）
                  </div>
                  <div className="font-bold text-slate-800 mb-3">{previewData.subject}</div>
                  <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                    {previewData.body}
                  </div>
                </div>
              ) : (
                <textarea
                  value={p.bodyText}
                  onChange={(e) => p.setBodyText(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none resize-y min-h-[300px] text-sm leading-relaxed font-mono"
                  placeholder={'{{full_name}}様\n\nいつもお世話になっております。\n...'}
                />
              )}
            </div>

            {/* 変数挿入 */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500 mb-2">
                <strong>動的変数</strong>（クリックで本文末尾に挿入）
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => p.onInsertVariable(v.key)}
                    title={v.desc}
                    className="px-2.5 py-1 text-xs font-mono bg-slate-100 text-slate-700 rounded hover:bg-[#384a8f] hover:text-white transition-colors"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右：宛先＋送信 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 md:p-5 shadow-sm border border-slate-100">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4" /> 宛先{' '}
              <span className="text-sm font-normal text-slate-400">({p.recipients.length}名)</span>
            </h2>

            <input
              ref={p.fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={p.onCSV}
              className="hidden"
            />

            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                onClick={() => p.fileRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
              >
                <Upload className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={p.onOpenUserModal}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100"
              >
                <UserPlus className="w-3 h-3" /> 受講者DB
              </button>
            </div>

            {/* 手動追加 */}
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={p.manualName}
                onChange={(e) => p.setManualName(e.target.value)}
                placeholder="名前（任意）"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#384a8f] outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="email"
                  value={p.manualEmail}
                  onChange={(e) => p.setManualEmail(e.target.value)}
                  placeholder="メールアドレス"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#384a8f] outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && p.onAddManual()}
                />
                <button
                  onClick={p.onAddManual}
                  className="px-3 py-2 bg-[#384a8f] text-white rounded-lg hover:bg-[#2a3970]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {p.recipients.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  宛先を追加してください
                </p>
              ) : (
                p.recipients.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 group"
                  >
                    <div className="min-w-0">
                      {r.full_name && (
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {r.full_name}
                          {r.temp_password && (
                            <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded">
                              仮pw付
                            </span>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 truncate">{r.email}</p>
                    </div>
                    <button
                      onClick={() => p.onRemoveRecipient(i)}
                      className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {p.recipients.length > 0 && (
              <button
                onClick={p.onClearRecipients}
                className="w-full mt-3 text-xs text-slate-400 hover:text-rose-500"
              >
                全てクリア
              </button>
            )}
          </div>

          <div className="space-y-2">
            <button
              onClick={p.onOpenTest}
              disabled={!p.subject || !p.bodyText}
              className="w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-40"
            >
              <TestTube className="w-4 h-4" /> テスト送信
            </button>

            <button
              onClick={p.onSend}
              disabled={p.sending || !p.subject || !p.bodyText || p.recipients.length === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#384a8f] text-white rounded-xl font-medium hover:bg-[#2a3970] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {p.sending ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" /> 送信中...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" /> {p.recipients.length}名に送信
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ============================================================
// 移行ビュー
// ============================================================
interface MigrateViewProps {
  scope: 'all' | 'offline' | 'online' | 'free'
  setScope: (v: 'all' | 'offline' | 'online' | 'free') => void
  migrating: boolean
  issued: IssuedPassword[] | null
  error: string | null
  onIssue: () => void
  onDownloadCsv: () => void
  onLoadAsRecipients: () => void
}

function MigrateView(p: MigrateViewProps) {
  return (
    <div className="space-y-6">
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-rose-800 space-y-1">
          <p className="font-semibold">Adalo からの移行モード</p>
          <p>
            対象ユーザーに対して 12 桁のランダムな仮パスワードを発行し、Supabase Auth へ反映します。
          </p>
          <p>
            既存ユーザーはパスワードが上書きされ、過去のログイン認証情報は使えなくなります。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">配信対象</label>
          <div className="flex flex-wrap gap-2">
            {(['all', 'offline', 'online', 'free'] as const).map((s) => (
              <button
                key={s}
                onClick={() => p.setScope(s)}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  p.scope === s
                    ? 'border-[#384a8f] bg-[#384a8f] text-white font-medium'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {s === 'all' && '全員（管理者除く）'}
                {s === 'offline' && '対面のみ'}
                {s === 'online' && 'オンラインのみ'}
                {s === 'free' && '無料ユーザーのみ'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={p.onIssue}
          disabled={p.migrating}
          className="flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-lg font-medium hover:bg-rose-700 disabled:opacity-50"
        >
          {p.migrating ? (
            <>
              <Clock className="w-5 h-5 animate-spin" /> 発行中...
            </>
          ) : (
            <>
              <KeyRound className="w-5 h-5" /> 仮パスワードを発行
            </>
          )}
        </button>

        {p.error && (
          <div className="p-3 rounded-lg text-sm bg-rose-50 text-rose-700 border border-rose-200">
            {p.error}
          </div>
        )}
      </div>

      {p.issued && p.issued.length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-slate-800">
              発行結果（{p.issued.length}件）
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={p.onDownloadCsv}
                className="flex items-center gap-1 px-3 py-2 text-xs bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <FileDown className="w-4 h-4" /> CSV ダウンロード
              </button>
              <button
                onClick={p.onLoadAsRecipients}
                className="flex items-center gap-1 px-3 py-2 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <Send className="w-4 h-4" /> ログイン案内メールへ
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            新規作成: {p.issued.filter((i) => i.status === 'created').length}件 ／
            更新: {p.issued.filter((i) => i.status === 'updated').length}件 ／
            失敗: {p.issued.filter((i) => i.status === 'failed').length}件
          </div>

          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">名前</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">メール</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">仮パスワード</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-slate-600">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {p.issued.map((i) => (
                  <tr key={i.user_id}>
                    <td className="px-3 py-2.5 text-slate-800">{i.full_name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{i.email}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{i.temp_password}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {i.status === 'created' && <Tag color="emerald">新規</Tag>}
                      {i.status === 'updated' && <Tag color="blue">更新</Tag>}
                      {i.status === 'failed' && (
                        <span className="text-rose-600" title={i.error}>失敗</span>
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

// ============================================================
// 履歴ビュー
// ============================================================
interface HistoryRow {
  id: string
  subject: string
  body_text: string | null
  body_html: string | null
  sender_email: string
  sender_name: string | null
  total_recipients: number
  sent_count: number
  failed_count: number
  skipped_count: number
  errors: { email: string; error: string }[] | null
  variables_used: string[] | null
  created_at: string
}

function HistoryView({
  loading,
  history,
  onBack,
}: {
  loading: boolean
  history: HistoryRow[]
  onBack: () => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) {
    return <div className="text-center py-12 text-slate-400">読み込み中...</div>
  }
  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        配信履歴はありません
        <div className="mt-3">
          <button
            onClick={onBack}
            className="text-sm text-[#384a8f] hover:underline"
          >
            配信画面に戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {history.map((item) => {
        const isOpen = expandedId === item.id
        return (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden"
          >
            {/* サマリー行（クリックで展開） */}
            <button
              type="button"
              onClick={() => setExpandedId(isOpen ? null : item.id)}
              className="w-full text-left p-4 md:p-5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-slate-800 truncate flex items-center gap-2">
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    {item.subject}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 ml-6">
                    送信者: {item.sender_email} ・{' '}
                    {new Date(item.created_at).toLocaleString('ja-JP')}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-sm">
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    {item.sent_count}
                  </span>
                  {item.failed_count > 0 && (
                    <span className="text-rose-600">失敗 {item.failed_count}</span>
                  )}
                  {item.skipped_count > 0 && (
                    <span className="text-amber-600">スキップ {item.skipped_count}</span>
                  )}
                  <span className="text-slate-400">/ {item.total_recipients}名</span>
                </div>
              </div>
            </button>

            {/* 詳細セクション */}
            {isOpen && (
              <div className="border-t border-slate-100 bg-slate-50/50 p-4 md:p-5 space-y-4">
                {/* メタ情報 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-slate-400 mb-0.5">配信日時</p>
                    <p className="text-slate-700 font-medium">{new Date(item.created_at).toLocaleString('ja-JP')}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">送信者</p>
                    <p className="text-slate-700 font-medium">{item.sender_name || '-'}</p>
                    <p className="text-slate-500">{item.sender_email}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">配信件数</p>
                    <p className="text-slate-700 font-medium">
                      <span className="text-emerald-600">成功 {item.sent_count}</span>
                      {item.failed_count > 0 && <span className="text-rose-600 ml-2">失敗 {item.failed_count}</span>}
                      {item.skipped_count > 0 && <span className="text-amber-600 ml-2">スキップ {item.skipped_count}</span>}
                      <span className="text-slate-400"> / 合計 {item.total_recipients}名</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">使用変数</p>
                    <p className="text-slate-700 font-mono text-[11px]">
                      {item.variables_used?.length
                        ? item.variables_used.map((v) => `{{${v}}}`).join(' ')
                        : '-'}
                    </p>
                  </div>
                </div>

                {/* 件名 */}
                <div>
                  <p className="text-xs text-slate-400 mb-1">件名</p>
                  <p className="text-sm font-medium text-slate-800 bg-white rounded-lg px-3 py-2 border border-slate-200">
                    {item.subject}
                  </p>
                </div>

                {/* 本文 */}
                <div>
                  <p className="text-xs text-slate-400 mb-1">本文</p>
                  <div className="bg-white rounded-lg px-4 py-3 border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-sans max-h-[400px] overflow-y-auto">
                    {item.body_text || (item.body_html
                      ? item.body_html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                      : '(本文なし)')}
                  </div>
                </div>

                {/* エラー一覧 */}
                {item.errors && item.errors.length > 0 && (
                  <div>
                    <p className="text-xs text-rose-500 mb-1">送信失敗 ({item.errors.length}件)</p>
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs space-y-1 max-h-[200px] overflow-y-auto">
                      {item.errors.map((e, i) => (
                        <div key={i}>
                          <span className="text-rose-700 font-medium">{e.email}</span>
                          <span className="text-rose-500 ml-2">{e.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// 共通コンポーネント
// ============================================================
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
        active
          ? 'bg-[#384a8f] text-white font-medium'
          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

function Modal({
  children,
  onClose,
  maxWidth = 'max-w-md',
}: {
  children: React.ReactNode
  onClose: () => void
  maxWidth?: string
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl w-full ${maxWidth} shadow-xl max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const TAG_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  amber: 'bg-amber-100 text-amber-700',
  violet: 'bg-violet-100 text-violet-700',
}

function Tag({ color, children }: { color: keyof typeof TAG_COLORS; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${TAG_COLORS[color]}`}>
      {children}
    </span>
  )
}

function origin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
