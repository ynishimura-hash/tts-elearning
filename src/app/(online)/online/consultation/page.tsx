'use client'

import { Users, ExternalLink } from 'lucide-react'

const FORM_1H = 'https://docs.google.com/forms/d/e/1FAIpQLSetGC_kPUp08bT0Xl94T6YspI7eX0ZV674TAJQM5QAu8gHEwg/viewform'
const FORM_3H = 'https://docs.google.com/forms/d/e/1FAIpQLScXBZTyAxHEODAU6FZcvOjmoiDN_j7JaStjLhQBtG-pm1usQg/viewform'

export default function OnlineConsultationPage() {
  return (
    <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-[#384a8f]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">個別相談申し込みについて</h1>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div className="text-gray-700 leading-relaxed space-y-1">
          <p>下部のボタンは有料の個別相談申込フォームとなっております。</p>
          <p>1時間22,000円（税込）と3時間パック55,000円（税込）で承っております。</p>
          <p>PayPal決済にてお支払いの上、相談内容を予めフォームに入力ください。</p>
          <p>希望日時を複数日ご提示いただき、希望に添えるように講師の日程を調整させていただきます。</p>
          <p>提示いただいた日程で調整が難しい場合は、ご連絡させていただきます。</p>
        </div>

        <div className="pt-2 space-y-3">
          <a
            href={FORM_1H}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors"
          >
            有料個別相談申し込みフォーム 1時間22,000円（税込）
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={FORM_3H}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 bg-[#384a8f] text-white rounded-lg font-medium hover:bg-[#2d3d75] transition-colors"
          >
            有料個別相談申し込みフォーム 3時間パック55,000円（税込）
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
