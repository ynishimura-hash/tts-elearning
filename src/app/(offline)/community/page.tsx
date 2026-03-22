'use client'

import { useUser } from '@/lib/hooks/useUser'
import { Users, ExternalLink } from 'lucide-react'

export default function CommunityPage() {
  const { user } = useUser()

  if (!user?.community_member) {
    return (
      <div className="space-y-6 pt-12 lg:pt-0 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#384a8f]/10 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-[#384a8f]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">TTSコミュニティ</h1>
        </div>
        <div className="bg-white rounded-xl p-8 shadow-sm text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">コミュニティ未加入</h2>
          <p className="text-gray-600 mb-4">
            TTSコミュニティに参加すると、他の受講生と情報交換ができます。
          </p>
          <p className="text-sm text-gray-500">
            参加を希望される方は、勉強会またはLINEにてお問い合わせください。
          </p>
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
        <h1 className="text-2xl font-bold text-gray-800">TTSコミュニティ</h1>
      </div>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#384a8f] mb-3">コミュニティについて</h2>
        <p className="text-gray-600">
          TTSコミュニティでは、受講生同士でトレードに関する情報交換や、
          学習の進捗を共有することができます。
        </p>
      </div>
    </div>
  )
}
