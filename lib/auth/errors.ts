/**
 * Sign-in failures whose `code` is safe to show the user.
 *
 * These are plain `Error`s, not `CredentialsSignin`, so that the authorize
 * logic stays free of the `next-auth` runtime (which drags in `next/server`).
 * `lib/auth.ts` re-throws them as `CredentialsSignin` — the only error class
 * Auth.js forwards a `code` to the client for.
 */
export class AuthCodeError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = new.target.name
    this.code = code
  }
}

export const AUTH_ERROR_ACCOUNT_BLOCKED = 'account_blocked'
export const AUTH_ERROR_PASSWORD_RESET_REQUIRED = 'password_reset_required'

export class AccountBlockedError extends AuthCodeError {
  constructor() {
    super(AUTH_ERROR_ACCOUNT_BLOCKED)
  }
}

export class PasswordResetRequiredError extends AuthCodeError {
  constructor() {
    super(AUTH_ERROR_PASSWORD_RESET_REQUIRED)
  }
}
