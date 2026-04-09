'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { Users, CheckCircle2, Plus, X } from 'lucide-react'

export default function OnlineConsultationPage() {
  const { user } = useUser()
  const [dates, setDates] = useState<string[]>([''])
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const addDate = () => setDates([...dates, ''])
  const removeDate = (i: number) => setDates(dates.filter((_, idx) => idx !== i))
  const updateDate = (i: number, val: string) => {
    const next = [...dates]
    next[i] = val
    setDates(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const validDates = dates.filter(d => d.trim())
    if (validDates.length === 0) return

    const supabase = createClient()
    await supabase.from('consultations').insert({
      user_id: user.id,
      preferred_dates: validDates,
      message: message.trim(),
      is_online: true,
    })

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">申込を受け付けました</h2>
          <p className="text-gray-600">担当者から連絡させていただきますので、しばらくお待ちください。</p>
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

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <p className="text-gray-600 mb-6">
          トレードに関する個別相談を承っております。希望日時を複数ご入力ください。
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">希望日時（複数可）</label>
            {dates.map((d, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-400 w-16 flex-shrink-0">第{i + 1}希望</span>
                <input type="datetime-local" value={d} onChange={(e) => updateDate(i, e.target.value)} required={i === 0}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#384a8f] outline-none" />
                {dates.length > 1 && (
                  <button type="button" onClick={() => removeDate(i)} className="p-1.5 text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {dates.length < 5 && (
              <button type="button" onClick={addDate}
                className="flex items-center gap-1 text-sm text-[#384a8f] hover:underline mt-1">
                <Plus className="w-3.5 h-3.5" /> 希望日時を追加
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">相談内容</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={5}
              placeholder="相談したい内容をお書きください"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#384a8f] outline-none" />
          </div>
          <button type="submit"
            className="w-full py-3 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors">
            申し込む
          </button>
        </form>
      </div>
    </div>
  )
}
