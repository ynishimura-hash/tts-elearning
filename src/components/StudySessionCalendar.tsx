'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import type { StudySession, StudySessionAttendance } from '@/types/database'

interface StudySessionCalendarProps {
  sessions: StudySession[]
  attendance: Record<string, StudySessionAttendance>
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function statusOf(att: StudySessionAttendance | undefined): 'attending' | 'absent' | 'none' {
  if (!att) return 'none'
  if (att.status === 'attending') return 'attending'
  if (att.status === 'absent') return 'absent'
  return 'none'
}

export function StudySessionCalendar({ sessions, attendance }: StudySessionCalendarProps) {
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const sessionsByDate = useMemo(() => {
    const map: Record<string, StudySession[]> = {}
    for (const s of sessions) {
      const key = ymd(new Date(s.session_date))
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return map
  }, [sessions])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const cells: (Date | null)[] = []

  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date()
  const todayKey = ymd(today)

  function prevMonth() {
    setCursor(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    setCursor(new Date(year, month + 1, 1))
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 transition-colors" aria-label="前月">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h3 className="text-base font-bold text-gray-800">
          {year}年 {month + 1}月
        </h3>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 transition-colors" aria-label="次月">
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-xs font-medium pb-1 ${
              i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, idx) => {
          if (!d) return <div key={idx} className="min-h-[3.5rem]" />
          const key = ymd(d)
          const daySessions = sessionsByDate[key] || []
          const isToday = key === todayKey
          const dow = d.getDay()

          return (
            <div
              key={idx}
              className={`min-h-[3.5rem] flex flex-col items-stretch p-1 rounded relative ${
                isToday ? 'bg-[#384a8f]/10 ring-1 ring-[#384a8f]/30' : ''
              }`}
              title={daySessions.map(s => `${s.is_online ? '[オンライン]' : '[リアル]'} ${s.title}${s.session_time ? ' ' + s.session_time : ''}`).join('\n')}
            >
              <span
                className={`text-xs text-center ${
                  isToday
                    ? 'font-bold text-[#384a8f]'
                    : dow === 0
                    ? 'text-rose-500'
                    : dow === 6
                    ? 'text-blue-500'
                    : 'text-gray-700'
                }`}
              >
                {d.getDate()}
              </span>

              {daySessions.length > 0 && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {daySessions.map((s) => {
                    const att = attendance[s.id]
                    const status = statusOf(att)
                    const baseColor = s.is_online ? 'purple' : 'emerald'
                    const label = s.is_online ? 'オン' : 'リアル'

                    // 出席/欠席に応じて色変更
                    const bgClass =
                      status === 'attending'
                        ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                        : status === 'absent'
                        ? 'bg-red-50 text-red-600 ring-1 ring-red-200 opacity-80'
                        : baseColor === 'purple'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-emerald-100 text-emerald-700'

                    return (
                      <div
                        key={s.id}
                        className={`text-[10px] leading-none px-1 py-0.5 rounded flex items-center justify-center gap-0.5 ${bgClass}`}
                      >
                        {status === 'attending' && <Check className="w-2.5 h-2.5 flex-shrink-0" />}
                        {status === 'absent' && <X className="w-2.5 h-2.5 flex-shrink-0" />}
                        <span className="truncate">{label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 凡例 */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-600">
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
          オン
          <span className="text-gray-500 ml-0.5">=オンライン</span>
        </div>
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
          リアル
          <span className="text-gray-500 ml-0.5">=対面</span>
        </div>
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700">
          <Check className="w-3 h-3" />=出席
        </div>
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600">
          <X className="w-3 h-3" />=欠席
        </div>
      </div>
    </div>
  )
}
