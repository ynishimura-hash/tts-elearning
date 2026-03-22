import { Navigation } from '@/components/Navigation'

export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Navigation mode="offline" />
      <main className="flex-1 lg:ml-64">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
