import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TTS e-ラーニング',
  description: 'TTS トレード塾 e-ラーニングシステム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
