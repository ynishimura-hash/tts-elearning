import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { to, subject, html } = await request.json()

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Resend未設定の場合はスキップ
    return NextResponse.json({ message: 'Email service not configured' }, { status: 200 })
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'TTS e-ラーニング <noreply@tts-elearning.com>',
        to: [to],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
