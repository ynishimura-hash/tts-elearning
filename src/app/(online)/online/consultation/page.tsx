'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Users, CheckCircle2, Plus, X, ExternalLink } from 'lucide-react'

const PAYMENT_1H = 'https://docs.google.com/forms/d/e/1FAIpQLSetGC_kPUp08bT0Xl94T6YspI7eX0ZV674TAJQM5QAu8gHEwg/viewform'
const PAYMENT_3H = 'https://docs.google.com/forms/d/e/1FAIpQLScXBZTyAxHEODAU6FZcvOjmoiDN_j7JaStjLhQBtG-pm1usQg/viewform'

type Plan = '1h_22000' | '3h_55000'

const PLAN_LABEL: Record<Plan, string> = {
  '1h_22000': '1時間 22,000円（税込）',
  '3h_55000': '3時間パック 55,000円（税込）',
}

const PLAN_URL: Record<Plan, string> = {
  '1h_22000': PAYMENT_1H,
  '3h_55000': PAYMENT_3H,
}

interface TimeSlot {
  date: string
  startTime: string
  endTime: string
}

const emptySlot: TimeSlot = { date: '', startTime: '', endTime: '' }

function formatSlot(slot: TimeSlot): string {
  return `${slot.date} ${slot.startTime}-${slot.endTime}`
}

function isSlotValid(slot: TimeSlot): boolean {
  return Boolean(slot.date && slot.startTime && slot.endTime && slot.startTime < slot.endTime)
}

export default function OnlineConsultationPage() {
  const { user } = useUser()
  const [plan, setPlan] = useState<Plan>('1h_22000')
  const [slots, setSlots] = useState<TimeSlot[]>([{ ...emptySlot }])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [consultationId, setConsultationId] = useState<string | null>(null)
  const [submittedPlan, setSubmittedPlan] = useState<Plan | null>(null)
  const [confirmingPaid, setConfirmingPaid] = useState(false)
  const [done, setDone] = useState(false)

  const addSlot = () => setSlots([...slots, { ...emptySlot }])
  const removeSlot = (i: number) => setSlots(slots.filter((_, idx) => idx !== i))
  const updateSlot = (i: number, patch: Partial<TimeSlot>) => {
    const next = [...slots]
    next[i] = { ...next[i], ...patch }
    setSlots(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!user) return

    const filled = slots.filter(s => s.date || s.startTime || s.endTime)
    if (filled.length === 0) {
      setError('希望日時を1件以上入力してください')
      return
    }
    const invalid = filled.find(s => !isSlotValid(s))
    if (invalid) {
      setError('各希望について、日付・開始時刻・終了時刻をすべて入力してください（終了は開始より後にしてください）')
      return
    }
    if (!message.trim()) {
      setError('相談内容を入力してください')
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { data, error: err } = await supabase.from('consultations').insert({
      user_id: user.id,
      preferred_dates: filled.map(formatSlot),
      message: message.trim(),
      plan,
      is_online: true,
    }).select('id').single()
    setSaving(false)

    if (err || !data) {
      setError('送信に失敗しました: ' + (err?.message || '不明なエラー'))
      return
    }

    setConsultationId(data.id)
    setSubmittedPlan(plan)
  }

  async function handleConfirmPaid() {
    if (!consultationId) return
    setConfirmingPaid(true)
    const supabase = createClient()
    await supabase.from('consultations').update({ payment_status: 'paid' }).eq('id', consultationId)
    setConfirmingPaid(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl p-6 sm:p-8 shadow-sm text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-800">お申し込みが完了しました</h2>
          <p className="text-gray-600 text-sm">担当者から日程調整のご連絡をさせていただきます。しばらくお待ちください。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">個別相談申し込み</h1>
      </div>

      <div className="bg-white rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="text-gray-700 text-sm leading-relaxed space-y-1">
          <p>トレードに関する個別相談を承っております。</p>
          <p>1時間 22,000円（税込）／ 3時間パック 55,000円（税込）</p>
          <p>申込フォーム送信後、PayPalで決済にお進みください。</p>
          <p>ご希望日時を複数ご提示いただき、講師と調整させていただきます。</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">プラン選択</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(PLAN_LABEL) as Plan[]).map((p) => (
                <label key={p}
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    plan === p ? 'border-[#384a8f] bg-[#384a8f]/5' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input type="radio" name="plan" value={p} checked={plan === p}
                    onChange={() => setPlan(p)}
                    className="accent-[#384a8f]" />
                  <span className="text-sm font-medium text-gray-800">{PLAN_LABEL[p]}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">希望日時（複数可）</label>
            <div className="space-y-3">
              {slots.map((slot, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 font-medium">第{i + 1}希望</span>
                    {slots.length > 1 && (
                      <button type="button" onClick={() => removeSlot(i)}
                        className="p-1 text-gray-400 hover:text-red-500" aria-label="削除">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <input type="date" value={slot.date}
                      onChange={(e) => updateSlot(i, { date: e.target.value })}
                      required={i === 0}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-sm" />
                    <div className="hidden sm:block text-gray-400 text-xs text-center">空いている時間</div>
                    <div className="flex items-center gap-2">
                      <input type="time" value={slot.startTime} step={900}
                        onChange={(e) => updateSlot(i, { startTime: e.target.value })}
                        required={i === 0}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-sm" />
                      <span className="text-gray-400 text-sm">〜</span>
                      <input type="time" value={slot.endTime} step={900}
                        onChange={(e) => updateSlot(i, { endTime: e.target.value })}
                        required={i === 0}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {slots.length < 5 && (
              <button type="button" onClick={addSlot}
                className="flex items-center gap-1 text-sm text-[#384a8f] hover:underline mt-2">
                <Plus className="w-3.5 h-3.5" /> 希望日時を追加
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">相談内容</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={5}
              placeholder="相談したい内容をお書きください"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors disabled:opacity-50">
            {saving ? '送信中...' : '決済に進む'}
          </button>
        </form>
      </div>

      {consultationId && submittedPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => { /* 背景クリックでは閉じない（誤操作防止） */ }}
        >
          <div
            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b">
              <h2 className="font-bold text-gray-800">決済へお進みください</h2>
            </div>
            <div className="p-5 space-y-4 text-sm text-gray-700">
              <p>下記のボタンから決済ページを開き、お支払いを完了してください。</p>
              <a
                href={PLAN_URL[submittedPlan]}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-[#ffc439] text-[#003087] rounded-lg font-bold hover:brightness-95 transition-all"
              >
                PayPalで支払う（{PLAN_LABEL[submittedPlan]}）
                <ExternalLink className="w-4 h-4" />
              </a>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 leading-relaxed">
                決済完了後、このページに戻り、下の「決済完了」ボタンを押してください。
              </div>
              <button
                onClick={handleConfirmPaid}
                disabled={confirmingPaid}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {confirmingPaid ? '処理中...' : '決済完了'}
              </button>
              <button
                onClick={() => { setConsultationId(null); setSubmittedPlan(null) }}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                あとで決済する（閉じる）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
