import { createClient } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const publicRoutes = ['/', '/login', '/api/auth/callback', '/api/notion/webhook']
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route)
  )

  const isProtectedRoute = pathname.startsWith('/dashboard')

  if (isProtectedRoute && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Exclude webhook so it bypasses middleware entirely (Notion verification)
    '/((?!_next/static|_next/image|favicon.ico|api/notion/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
