import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { safeRedirect } from '@/utils/safeRedirect'
import { AUTH_PAGE_PATHS, LOGIN_PATH, PROTECTED_PATH_PREFIXES } from '@/lib/constants'

/**
 * Required, not optional: Auth.js can only re-issue a refreshed session cookie
 * from a context that can write `Set-Cookie`. Without this file the sliding
 * renewal configured in `lib/auth.ts` silently never fires.
 *
 * Also owns the Content-Security-Policy (moved here from the former proxy.ts —
 * Next.js allows only one of the two conventions to exist).
 */
export default auth((req) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isDev = process.env.NODE_ENV === 'development'

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
    "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com",
    "img-src 'self' data: blob: https://flagcdn.com https://upload.wikimedia.org https://unpkg.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  const { pathname } = req.nextUrl
  const isLoggedIn = Boolean(req.auth)

  const isProtected = PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (isProtected && !isLoggedIn) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = LOGIN_PATH
    loginUrl.searchParams.set('returnUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isLoggedIn && (AUTH_PAGE_PATHS as readonly string[]).includes(pathname)) {
    const returnUrl =
      req.nextUrl.searchParams.get('returnUrl') ?? req.nextUrl.searchParams.get('callbackUrl')
    return NextResponse.redirect(new URL(safeRedirect(returnUrl), req.url))
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('content-security-policy', csp)

  // Returning a response on every matched request is what lets the rotated
  // session cookie reach the browser.
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', csp)

  return response
})

export const config = {
  // Everything except API routes, Next internals, static assets and /admin
  // (rewritten to the Django admin).
  matcher: ['/((?!api|_next/static|_next/image|_next/webpack-hmr|favicon\\.ico|admin).*)'],
  // Auth.js here pulls in Prisma and bcrypt — neither runs on the edge runtime.
  runtime: 'nodejs',
}
