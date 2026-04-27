import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 公開ページのパス
  const publicPaths = ['/login', '/apply', '/api/', '/expired', '/blog', '/unsubscribe']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ログイン済みユーザー: 退会判定 & ログインページ振り分け
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin, is_online, is_free_user, withdrew_at')
      .eq('auth_id', user.id)
      .single()

    const isWithdrawn =
      profile?.withdrew_at && new Date(profile.withdrew_at) <= new Date()

    // 退会済みなら /expired に強制（管理者は除外）
    if (
      isWithdrawn &&
      !profile?.is_admin &&
      !request.nextUrl.pathname.startsWith('/expired') &&
      !request.nextUrl.pathname.startsWith('/api/') &&
      request.nextUrl.pathname !== '/login'
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/expired'
      return NextResponse.redirect(url)
    }

    // ログインページにアクセスしたら適切なホームへ
    if (request.nextUrl.pathname === '/login') {
      const url = request.nextUrl.clone()
      if (isWithdrawn && !profile?.is_admin) {
        url.pathname = '/expired'
      } else if (profile?.is_admin) {
        url.pathname = '/admin'
      } else if (profile?.is_free_user) {
        url.pathname = '/free/home'
      } else if (profile?.is_online) {
        url.pathname = '/online/home'
      } else {
        url.pathname = '/home'
      }
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
