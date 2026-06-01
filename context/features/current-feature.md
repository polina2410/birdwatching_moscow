# Current Feature: Authentication

## Status
In Progress

## Goals

- Install dependencies: `next-auth@beta`, `@auth/prisma-adapter`, `bcryptjs` (+ `@types/bcryptjs`), `zod`
- `lib/auth.ts` — Auth.js v5 config: Credentials provider, Prisma adapter, JWT session strategy, custom pages, exports `{ handlers, signIn, signOut, auth }`
- `app/api/auth/[...nextauth]/route.ts` — re-exports `handlers` (GET, POST)
- `app/api/auth/register/route.ts` — registration endpoint (create User, bcrypt hash, welcome mail to console)
- `app/api/auth/request-password-reset/route.ts` — request reset link
- `app/api/auth/reset-password/route.ts` — confirm reset by token
- `app/(auth)/login/page.tsx` — login form
- `app/(auth)/register/page.tsx` — registration form
- `app/(auth)/reset-password/page.tsx` — request-reset form
- `app/(auth)/reset-password/[token]/page.tsx` — set-new-password form
- `middleware.ts` — protects `/account/*` and `/admin/*`; redirects authenticated users away from `/login` and `/register`
- `lib/mail.ts` — stub mail sender (console.log in dev, interface ready for real SMTP)
- `lib/validation/auth.ts` — Zod schemas for register, login, request-reset, confirm-reset
- `prisma/schema.prisma` — add `PasswordResetToken` model + migration
- `lib/constants.ts` — add `PASSWORD_RESET_TOKEN_TTL_MS`, `BCRYPT_COST`, `PASSWORD_MIN_LENGTH`
- `.env` / `.env.example` — add `AUTH_SECRET` and `AUTH_URL`

## Notes

- See `context/specs/auth-spec.md` for full flows, invariants, and implementation rules.
- Auth.js v5 (next-auth@beta), App Router only — import from `next-auth`, not `next-auth/next`.
- JWT session strategy is required by the Credentials provider — this is a v5 constraint, not a choice.
- Every email lookup MUST filter `deletedAt: null`. Soft-deleted accounts are invisible to auth.
- Passwords: bcrypt hash only (`cost=12`), never plaintext. No homegrown comparisons.
- `PasswordResetToken` stores SHA-256 hash of the raw token — the raw token goes in the URL/email only.
- Registration does NOT auto-login — redirect to `/login` with success message.
- Password reset does NOT auto-login — redirect to `/login` with success message.
- `request-password-reset` always returns the same response whether email exists or not (anti-enumeration).
- UI is minimal — forms must work and surface errors, no design required.
- Account deletion, email verification, rate limiting, OAuth, 2FA — all explicitly out of scope.