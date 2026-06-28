import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAdmin } from '@/lib/auth/permissions';
import { safeRedirect } from '@/lib/auth/safeRedirect';
import { Role } from '@/generated/prisma/client';

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

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
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const { pathname } = request.nextUrl;

  const isProtectedAccount = pathname.startsWith('/account');
  const isProtectedAdmin = pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (isProtectedAccount || isProtectedAdmin || isAuthPage) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });

    if ((isProtectedAccount || isProtectedAdmin) && !token) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }

    if (isProtectedAdmin && token) {
      const rawRole = token.role as string
      if (!(Object.values(Role) as string[]).includes(rawRole)) {
        return NextResponse.redirect(new URL('/', request.nextUrl))
      }
      const role = rawRole as Role

      if (!isAdmin(role)) {
        return NextResponse.redirect(new URL('/', request.nextUrl));
      }
    }

    if (isAuthPage && token) {
      const rawRole = token.role as string
      const role = (Object.values(Role) as string[]).includes(rawRole) ? rawRole as Role : null

      const returnUrl =
        request.nextUrl.searchParams.get('returnUrl') ??
        request.nextUrl.searchParams.get('callbackUrl')

      const authenticatedHome = role && isAdmin(role) ? '/admin' : '/'
      const destination = safeRedirect(returnUrl, authenticatedHome)

      return NextResponse.redirect(new URL(destination, request.nextUrl));
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};