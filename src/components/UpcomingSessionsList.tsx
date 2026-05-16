'use client'

import Link from 'next/link'
import { CalendarDays, Clock, MapPin, Video, CheckCircle2, XCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { formatDateWithWeekday } from '@/lib/utils'
import type { StudySession, StudySessionAttendance } from '@/types/database'

interface UpcomingSessionsListProps {
  sessions: StudySession[]
  attendance: Record<string, StudySessionAttendance>
  // 出欠ページのリンク先（オンラインは /online/study-sessions、対面は /study-sessions）
  linkHref: string
  // 表示件数の上限
  limit?: number
}

export function UpcomingSessionsList({
  sessions,
  attendance,
  linkHref,
  limit = 5,
}: UpcomingSessionsListProps) {
  const upcoming = sessions
    .filter(s => new Date(s.session_date) >= new Date())
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime())
    .slice(0, limit)

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm h-full">
      <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-[#384a8f]" />
        今後の勉強会
      </h3>

      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">予定されている勉強会はありません</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((session) => {
            const att = attendance[session.id]
            return (
              <div
                key={session.id}
                className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        session.is_online
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {session.is_online ? 'オンライン' : 'リアル'}
                    </span>
                    {!att ? (
                      <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                        <AlertCircle className="w-3 h-3" />未回答
                      </span>
                    ) : att.status === 'attending' ? (
                      <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                        <CheckCircle2 className="w-3 h-3" />出席
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        <XCircle className="w-3 h-3" />欠席
                      </span>
                    )}
                  </div>
                </div>

                <p className="font-medium text-gray-800 text-sm mb-1">{session.title}</p>

                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-0.5">
                    <CalendarDays className="w-3 h-3" />
                    {formatDateWithWeekday(session.session_date)}
                  </span>
                  {session.session_time && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {session.session_time}
                    </span>
                  )}
                  {session.is_online && session.zoom_url && att?.status === 'attending' && (
                    <a
                      href={session.zoom_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[#384a8f] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Video className="w-3 h-3" />Zoom
                    </a>
                  )}
                  {!session.is_online && session.location && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {session.location}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link
        href={linkHref}
        className="mt-3 inline-flex items-center text-sm text-[#384a8f] hover:underline"
      >
        出欠を回答する <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
