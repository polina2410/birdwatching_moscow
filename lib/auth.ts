import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authorizeCredentials, authorizeLoginCode, authorizeAdminTwoFactor } from '@/lib/auth/authorize'
import { AuthCodeError } from '@/lib/auth/errors'
import { SESSION_MAX_AGE_SECONDS, SESSION_UPDATE_AGE_SECONDS, LOGIN_CODE_PROVIDER_ID, ADMIN_2FA_PROVIDER_ID } from '@/lib/constants'
import authConfig from '@/auth.config'
import type { AuthorizedUser } from '@/types/auth'

/**
 * Auth.js only copies `code` into the client-visible redirect for
 * `CredentialsSignin` instances; every other error is swallowed as a
 * generic configuration failure.
 */
async function withSigninErrors(
  run: () => Promise<AuthorizedUser | null>
): Promise<AuthorizedUser | null> {
  try {
    return await run()
  } catch (err) {
    if (err instanceof AuthCodeError) {
      const signinError = new CredentialsSignin()
      signinError.code = err.code
      throw signinError
    }
    throw err
  }
}

// NOTE: no `satisfies NextAuthConfig` here — contextually typing this object
// re-checks the spread `authConfig` callbacks and loses the `next-auth/jwt`
// module augmentation, which surfaces as bogus `unknown` errors in
// auth.config.ts. `NextAuth()` still type-checks the argument.
export const authOptions = {
  ...authConfig,
  // `updateAge` gives sliding renewal — middleware.ts must fire on every request.
  session: {
    strategy: 'jwt' as const,
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  providers: [
    // ADMIN/SUPERADMIN — password. Both authorize helpers validate the raw
    // credentials with Zod themselves, so they take them unknown.
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (credentials) => withSigninErrors(() => authorizeCredentials(credentials)),
    }),
    // USER — one-time code emailed to the address
    Credentials({
      id: LOGIN_CODE_PROVIDER_ID,
      credentials: { email: {}, code: {} },
      authorize: (credentials) => withSigninErrors(() => authorizeLoginCode(credentials)),
    }),
    // ADMIN/SUPERADMIN — second factor: challenge token (from verify-login-code) + password
    Credentials({
      id: ADMIN_2FA_PROVIDER_ID,
      credentials: { email: {}, challengeToken: {}, password: {} },
      authorize: (credentials) => withSigninErrors(() => authorizeAdminTwoFactor(credentials)),
    }),
  ],
}

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions)
