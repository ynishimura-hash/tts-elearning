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
  const publicPaths = ['/login', '/apply', '/api/']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/login') {
    // ユーザー種別に応じてリダイレクト
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin, is_online, is_free_user')
      .eq('auth_id', user.id)
      .single()

    const url = request.nextUrl.clone()
    if (profile?.is_admin) {
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

  return supabaseResponse
}
