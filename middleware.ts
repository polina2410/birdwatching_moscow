import NextAuth from 'next-auth'
import authConfig from '@/auth.config'
import { safeRedirect } from '@/utils/safeRedirect'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  if (req.auth && req.nextUrl.pathname === '/login') {
    const returnUrl =
      req.nextUrl.searchParams.get('returnUrl') ??
      req.nextUrl.searchParams.get('callbackUrl')
    return Response.redirect(new URL(safeRedirect(returnUrl), req.url))
  }
})

export const config = {
  matcher: ['/login'],
}
