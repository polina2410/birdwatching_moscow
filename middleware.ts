'use server'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { safeRedirect } from '@/utils/safeRedirect'
import { AUTH_PAGE_PATHS, CALLBACK_URL_PARAM, LOGIN_PATH, PROTECTED_PATH_PREFIXES, RETURN_URL_PARAM } from '@/lib/constants'

export default auth((req) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
    "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com",
    "img-src 'self' data: blob: https://flagcdn.com https://upload.wikimedia.org https://unpkg.com https://storage.yandexcloud.net",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  const { pathname } = req.nextUrl
  const session = req.auth
  const isLoggedIn = Boolean(session)
  const role = session?.user?.role

  // Admin route protection — role-gated, not just auth-gated
  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = LOGIN_PATH
      loginUrl.searchParams.set(RETURN_URL_PARAM, pathname)
      return NextResponse.redirect(loginUrl)
    }
    if (role === 'USER') {
      return NextResponse.redirect(new URL('/', req.url))
    }
    if (role === 'ADMIN' && pathname.startsWith('/admin/users')) {
      return NextResponse.redirect(new URL('/admin/walks?error=superadmin_required', req.url))
    }
  }

  const isProtected = PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (isProtected && !isLoggedIn) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = LOGIN_PATH
    loginUrl.searchParams.set(RETURN_URL_PARAM, pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isLoggedIn && (AUTH_PAGE_PATHS as readonly string[]).includes(pathname)) {
    const returnUrl =
      req.nextUrl.searchParams.get(RETURN_URL_PARAM) ?? req.nextUrl.searchParams.get(CALLBACK_URL_PARAM)
    return NextResponse.redirect(new URL(safeRedirect(returnUrl), req.url))
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', csp)

  return response
})

export const config = {
  // Everything except API routes, Next internals, and static assets.
  matcher: ['/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon\\.ico).*)'],
  runtime: 'nodejs',
}
