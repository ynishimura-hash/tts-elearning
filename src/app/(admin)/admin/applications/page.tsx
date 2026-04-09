'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, XCircle, Search, Link2, Plus, Copy, Trash2, CreditCard, UserPlus, ExternalLink } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Application } from '@/types/database'

interface EnrollmentLink {
  id: string
  code: string
  course_type: string
  label: string | null
  monthly_price: number
  is_active: boolean
  used_count: number
  created_at: string
}

export default function AdminApplicationsPage() {
  const [tab, setTab] = useState<'applications' | 'links'>('applications')
  const [applications, setApplications] = useState<Application[]>([])
  const [links, setLinks] = useState<EnrollmentLink[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [search, setSearch] = useState('')
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [linkForm, setLinkForm] = useState({ label: '', course_type: 'offline', monthly_price: '' })
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const supabase = createClient()
    const { data: apps } = await supabase.from('applications').select('*').order('created_at', { ascending: false })
    if (apps) setApplications(apps)
    const { data: lnks } = await supabase.from('enrollment_links').select('*').order('created_at', { ascending: false })
    if (lnks) setLinks(lnks)
  }

  // URL発行
  async function createLink(e: React.FormEvent) {
    e.preventDefault()
    const code = Math.random().toString(36).substring(2, 10)
    const supabase = createClient()
    await supabase.from('enrollment_links').insert({
      code,
      course_type: linkForm.course_type,
      label: linkForm.label || null,
      monthly_price: linkForm.monthly_price ? parseInt(linkForm.monthly_price) : 0,
    })
    setShowLinkForm(false)
    setLinkForm({ label: '', course_type: 'offline', monthly_price: '' })
    fetchData()
  }

  // URLコピー
  function copyUrl(code: string, id: string) {
    const url = `${window.location.origin}/enroll/${code}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // URL無効化
  async function toggleLink(id: string, isActive: boolean) {
    const supabase = createClient()
    await supabase.from('enrollment_links').update({ is_active: !isActive }).eq('id', id)
    fetchData()
  }

  // 申込承認
  async function handleAction(id: string, status: 'approved' | 'rejected') {
    const actionLabel = status === 'approved' ? '承認' : '却下'
    if (!confirm(`この申込を${actionLabel}しますか？`)) return
    const supabase = createClient()
    await supabase.from('applications').update({ status, processed_at: new Date().toISOString() }).eq('id', id)
    if (status === 'approved') {
      const app = applications.find(a => a.id === id)
      if (app) {
        try {
          await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: app.email,
              subject: '【TTS e-ラーニング】受講申込が承認されました',
              body: `${app.full_name} 様\n\nTTS e-ラーニングへの受講申込が承認されました。\n\n後日、ログイン情報をお送りいたしますので、しばらくお待ちください。\n\n---\nTTS トレーダー養成訓練学校`,
            }),
          })
        } catch {}
      }
    }
    fetchData()
  }

  // 入金URLを設定してメール送信
  async function sendPaymentLink(id: string) {
    const paymentUrl = prompt('PayPal決済URLを入力してください:')
    if (!paymentUrl) return
    const supabase = createClient()
    await supabase.from('applications').update({ payment_url: paymentUrl }).eq('id', id)
    const app = applications.find(a => a.id === id)
    if (app) {
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: app.email,
            subject: '【TTS e-ラーニング】お支払いのご案内',
            body: `${app.full_name} 様\n\nTTS e-ラーニングへのお申し込みありがとうございます。\n\n以下のリンクからお支払い手続きをお願いいたします。\n\n▼ お支払いページ\n${paymentUrl}\n\n---\nTTS トレーダー養成訓練学校`,
          }),
        })
        alert('決済URLをメールで送信しました')
      } catch {}
    }
    fetchData()
  }

  // 入金済みに変更
  async function markPaid(id: string) {
    if (!confirm('入金確認済みに変更しますか？')) return
    const supabase = createClient()
    await supabase.from('applications').update({ payment_status: 'paid' }).eq('id', id)
    fetchData()
  }

  const filtered = applications.filter(app => {
    if (filter === 'pending' && app.status !== 'pending') return false
    if (filter === 'approved' && app.status !== 'approved') return false
    if (filter === 'rejected' && app.status !== 'rejected') return false
    if (search) {
      const s = search.toLowerCase()
      return app.full_name.toLowerCase().includes(s) || app.email.toLowerCase().includes(s)
    }
    return true
  })

  const pendingCount = applications.filter(a => a.status === 'pending').length

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">申込管理</h1>
        {pendingCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{pendingCount}件未処理</span>
        )}
      </div>

      {/* タブ */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('applications')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'applications' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
          申込一覧
        </button>
        <button onClick={() => setTab('links')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'links' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
          申込URL管理
        </button>
      </div>

      {/* === 申込URL管理タブ === */}
      {tab === 'links' && (
        <div className="space-y-4">
          <button onClick={() => setShowLinkForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium hover:bg-[#2d3d75]">
            <Plus className="w-4 h-4" /> 新しい申込URLを発行
          </button>

          {showLinkForm && (
            <form onSubmit={createLink} className="bg-white rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800">申込URL発行</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ラベル</label>
                  <input type="text" value={linkForm.label} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })}
                    placeholder="例: 2026年4月入会"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">コース種別</label>
                  <select value={linkForm.course_type} onChange={(e) => setLinkForm({ ...linkForm, course_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-sm">
                    <option value="offline">対面</option>
                    <option value="online">オンライン</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">月額料金(円)</label>
                  <input type="number" value={linkForm.monthly_price} onChange={(e) => setLinkForm({ ...linkForm, monthly_price: e.target.value })}
                    placeholder="例: 5000"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-[#384a8f] text-white rounded-lg text-sm font-medium">発行</button>
                <button type="button" onClick={() => setShowLinkForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">キャンセル</button>
              </div>
            </form>
          )}

          {links.map(link => (
            <div key={link.id} className={`bg-white rounded-xl p-5 shadow-sm ${!link.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#384a8f]" />
                  <span className="font-bold text-gray-800">{link.label || '無題'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${link.course_type === 'online' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {link.course_type === 'online' ? 'オンライン' : '対面'}
                  </span>
                  {link.monthly_price > 0 && (
                    <span className="text-xs text-[#e39f3c] font-medium">¥{link.monthly_price.toLocaleString()}/月</span>
                  )}
                  <span className="text-xs text-gray-400">{link.used_count}名申込</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => copyUrl(link.code, link.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      copiedId === link.id ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}>
                    <Copy className="w-3 h-3" /> {copiedId === link.id ? 'コピー済み!' : 'URLをコピー'}
                  </button>
                  <button onClick={() => toggleLink(link.id, link.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${link.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {link.is_active ? '無効化' : '有効化'}
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 font-mono truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/enroll/${link.code}` : `/enroll/${link.code}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === 申込一覧タブ === */}
      {tab === 'applications' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="名前またはメールで検索"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === f ? 'bg-[#384a8f] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}>
                  {{ all: 'すべて', pending: '未処理', approved: '承認済', rejected: '却下' }[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filtered.map(app => {
              const paymentStatus = (app as any).payment_status || 'unpaid'
              const paymentUrl = (app as any).payment_url
              return (
                <div key={app.id} className={`bg-white rounded-xl p-5 shadow-sm ${app.status === 'pending' ? 'ring-2 ring-yellow-200' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-gray-800">{app.full_name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          app.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {app.status === 'pending' ? '未処理' : app.status === 'approved' ? '承認済み' : '却下'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          app.course_type === 'offline' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'
                        }`}>
                          {app.course_type === 'offline' ? '対面' : 'オンライン'}
                        </span>
                        {/* 入金ステータス */}
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          paymentUrl ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {paymentStatus === 'paid' ? '入金済み' : paymentUrl ? '決済URL送信済み' : '未入金'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{app.email} {app.phone && `/ ${app.phone}`}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        申込日: {formatDateTime(app.created_at)}
                        {app.processed_at && ` / 処理日: ${formatDateTime(app.processed_at)}`}
                      </p>
                    </div>
                  </div>
                  {app.message && <p className="text-gray-600 text-sm bg-gray-50 rounded-lg p-3 mb-3">{app.message}</p>}

                  <div className="flex gap-2 flex-wrap">
                    {app.status === 'pending' && (
                      <>
                        <button onClick={() => handleAction(app.id, 'approved')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                          <CheckCircle2 className="w-4 h-4" /> 承認
                        </button>
                        <button onClick={() => handleAction(app.id, 'rejected')}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100">
                          <XCircle className="w-4 h-4" /> 却下
                        </button>
                      </>
                    )}
                    {app.status === 'approved' && paymentStatus !== 'paid' && (
                      <>
                        <button onClick={() => sendPaymentLink(app.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#e39f3c] text-white rounded-lg text-sm font-medium hover:bg-[#d08f30]">
                          <CreditCard className="w-4 h-4" /> {paymentUrl ? '決済URL再送' : '決済URL送信'}
                        </button>
                        <button onClick={() => markPaid(app.id)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100">
                          <CheckCircle2 className="w-4 h-4" /> 入金確認済み
                        </button>
                      </>
                    )}
                    {paymentStatus === 'paid' && !(app as any).account_created && (
                      <span className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                        <UserPlus className="w-4 h-4" /> アカウント発行待ち
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center text-gray-400">申込はありません</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
