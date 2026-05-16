'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { StudySession, StudySessionAttendance } from '@/types/database'

interface StudySessionCalendarProps {
  sessions: StudySession[]
  attendance: Record<string, StudySessionAttendance>
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function StudySessionCalendar({ sessions, attendance }: StudySessionCalendarProps) {
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // 日付 → 勉強会リスト
  const sessionsByDate = useMemo(() => {
    const map: Record<string, StudySession[]> = {}
    for (const s of sessions) {
      const key = ymd(new Date(s.session_date))
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return map
  }, [sessions])

  // カレンダー描画
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
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label="前月"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h3 className="text-base font-bold text-gray-800">
          {year}年 {month + 1}月
        </h3>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
          aria-label="次月"
        >
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
          if (!d) return <div key={idx} className="aspect-square" />
          const key = ymd(d)
          const daySessions = sessionsByDate[key] || []
          const isToday = key === todayKey
          const dow = d.getDay()
          const hasOnline = daySessions.some(s => s.is_online)
          const hasOffline = daySessions.some(s => !s.is_online)

          // 出欠状態の集約
          const myAttendances = daySessions
            .map(s => attendance[s.id])
            .filter(Boolean)
          const hasAttending = myAttendances.some(a => a?.status === 'attending')

          return (
            <div
              key={idx}
              className={`aspect-square flex flex-col items-center justify-start p-1 rounded relative ${
                isToday ? 'bg-[#384a8f]/10 ring-1 ring-[#384a8f]/30' : ''
              }`}
              title={daySessions.map(s => `${s.title}${s.session_time ? ' ' + s.session_time : ''}`).join('\n')}
            >
              <span
                className={`text-xs ${
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
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {hasOnline && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${hasAttending ? 'bg-green-500' : 'bg-purple-500'}`}
                      title="オンライン"
                    />
                  )}
                  {hasOffline && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${hasAttending ? 'bg-green-500' : 'bg-emerald-600'}`}
                      title="リアル"
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 凡例 */}
      <div className="mt-4 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500" />オンライン
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-600" />リアル
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />出席登録済み
        </span>
      </div>
    </div>
  )
}
