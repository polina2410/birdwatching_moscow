# Implementation Task: Authentication

## What to build

Implement email + password authentication on Auth.js v5 (NextAuth v5) on top of the existing Prisma schema. In scope: registration, login, logout, password reset. **Account deletion is NOT in this task** — the schema already supports it (`User.deletedAt`, partial unique index on email), but the deletion feature is built separately later.

This document is a specification: build what it describes. Do not summarize it back — produce the actual code, routes, and API.

## Deliverables (definition of done)

1. **Dependencies installed:** `next-auth@beta` (Auth.js v5), `@auth/prisma-adapter`, `bcryptjs` (+ TS types), `zod` (for form/input validation) if not already present.
2. **`lib/auth.ts`** — Auth.js v5 config with Credentials provider, Prisma adapter, JWT session strategy (required by the Credentials provider), custom pages `/login`, `/register`, `/reset-password`. Exports `{ handlers, signIn, signOut, auth }`.
3. **`app/api/auth/[...nextauth]/route.ts`** — re-exports `handlers` (`GET`, `POST`).
4. **API endpoints for actions Auth.js doesn't handle itself:**
    - `app/api/auth/register/route.ts` — registration (create `User`, hash password, send welcome email to console — see below).
    - `app/api/auth/request-password-reset/route.ts` — request a reset link.
    - `app/api/auth/reset-password/route.ts` — confirm reset by token.
5. **Pages (UI without design — minimal markup, forms, basic validation):**
    - `app/(auth)/login/page.tsx`
    - `app/(auth)/register/page.tsx`
    - `app/(auth)/reset-password/page.tsx` — form to enter email and request the link.
    - `app/(auth)/reset-password/[token]/page.tsx` — form to enter a new password using the link.
6. **`middleware.ts`** — stub protecting `/account/*` and `/admin/*` (redirect to `/login` if no session). No real pages exist yet; the goal is for route-protection infrastructure to already be working.
7. **`lib/mail.ts`** — stub mail sender: in development mode writes mail kind, address, and link (for the password-reset email) to `console.log`. Real SMTP will plug in later — the interface must allow that without changing callers.
8. **`lib/validation/auth.ts`** — Zod schemas for register, login, request-reset, confirm-reset. Use the shared limit constants from the existing schema (email max 254, name 100, see below).
9. **`prisma/schema.prisma`** — `PasswordResetToken` model added (see below). Migration generated.
10. All endpoints wire through the same Prisma client used elsewhere in the project.

The task is complete when: you can register (new `User` in DB, welcome message logs to console), log in (http-only session cookie appears), log out (cookie disappears), request a password reset (link with token logs to console), follow the link and set a new password (the old password stops working, the new one works).

## Rules that must hold (read before implementing)

- **Password is never stored in plaintext.** Only a bcrypt hash in `User.passwordHash`. Cost factor 12. Comparison via `bcrypt.compare`, no homegrown comparisons.
- **Matches the schema:** `email` on `User` is NOT marked `@unique` in Prisma — uniqueness comes from a partial unique index on `deletedAt IS NULL` (see schema). The "email taken" check during registration MUST include `deletedAt: null`. A soft-deleted row does not block re-registration with the same email — this is already designed in the schema; auth just works correctly with it.
- **Every email lookup filters `deletedAt IS NULL`.** Login, user lookup for reset, "is this email taken" — everywhere. A soft-deleted account must never be found by any auth query.
- **Session = http-only cookie**, not localStorage. The JWT strategy used by the Credentials provider is wrapped inside the http-only cookie `next-auth.session-token` — this is fine and secure. Never expose the token to client JS.
- **Auth.js v5 (next-auth@beta)**, App Router, no Pages Router. Import from `next-auth`, not `next-auth/next`.
- **API endpoint validation via Zod** (re-uses the rules from the schema spec: email max 254, valid format; password min 8; name 1..100). An endpoint without validation is a bug.
- **No external sign-in providers** (Google, GitHub, Yandex) — Credentials only. They can be added later; not in scope now.

When some detail isn't specified (token length, lifetime, etc.) — pick a sensible default and leave a `// NOTE:`. Not blocking.

---

## Entities

### New model: `PasswordResetToken`

A one-time token for password reset. Don't use a field on `User` — the token should be a separate entity so history is visible and invalidation is easy.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| userId | uuid (fk → User) | R | |
| tokenHash | string | R | **hash of the token**, not the token itself. The raw token goes into the email/URL; the DB stores its SHA-256 hash. Hash length — `@db.VarChar(64)` |
| expiresAt | timestamp | R | `now() + 1 hour`. TTL constant in `lib/constants.ts` |
| usedAt | timestamp | O | null = unused; set = used once |
| createdAt | timestamp | D | `@default(now())` |

**Indexes:**
- `userId` — to invalidate the user's old tokens when issuing a new one.
- `tokenHash` — unique, for lookup by the presented token.

**Invariants:**
- The raw token (what goes in the email) is a cryptographically secure random string, at least 32 URL-safe bytes (e.g. `crypto.randomBytes(32).toString('base64url')`). Only the SHA-256 hash of that token is stored in the DB. This protects against DB leaks: even with a dump, an attacker cannot forge an active link.
- When issuing a new token for a user, **invalidate all that user's previous unused tokens** (set `usedAt = now()` or delete them). At most one active token per user at a time.
- A token is valid iff `expiresAt > now AND usedAt IS NULL`. Used or expired — invalid.
- After a successful reset, mark the token `usedAt = now()`. Reusing the same link must be impossible.

---

## Flows

Each flow is described as "input → steps → result → errors."

### 1. Registration

**Input (POST `/api/auth/register`):** `{ email, password, name }`.

**Steps:**
1. Zod validation: email format + max 254, password min 8, name 1..100.
2. Active-user lookup: `User.findFirst({ where: { email, deletedAt: null } })`. If found — "email is taken" error. **Soft-deleted rows are ignored** (this is option A from the schema).
3. Password hash: `bcrypt.hash(password, 12)`.
4. `User.create({ data: { email, name, passwordHash, role: 'USER' } })`.
5. Welcome email via `lib/mail.ts` (in dev — `console.log`).
6. Auto-login after registration — **NO**. After registration, redirect to `/login` with a success message "Registration successful, please log in." This reduces the number of complex code paths.

**Response:** `{ ok: true }` or a validation error with field info.

**Errors:** `400` (validation), `409` (email taken), `500`.

### 2. Login

**Via Auth.js Credentials provider.** No custom API route needed; the `/login` form calls `signIn('credentials', { email, password, redirect: false })`.

**`authorize` logic in `lib/auth.ts`:**
1. Parse credentials via Zod (email + password non-empty, valid format).
2. User lookup: `User.findFirst({ where: { email, deletedAt: null } })`.
3. If not found — return `null` (Auth.js will surface a generic "invalid credentials" error). **Do not distinguish "no such email" from "wrong password" in the response** — that leaks which emails are registered.
4. `bcrypt.compare(password, user.passwordHash)`. If mismatch — `null`.
5. If OK — return an object `{ id, email, name, role }`. This object ends up in the JWT.

**Session (`jwt` + `session` callbacks):** put `id` and `role` into the JWT; mirror them in the session, so `auth()` on the server returns `{ user: { id, email, name, role } }`. `role` will be needed for admin route checks.

**Cookies:** http-only, secure in prod, sameSite=lax (Auth.js default).

### 3. Logout

A button calls `signOut({ redirect: true, redirectTo: '/' })`. No custom logic.

### 4. Request password reset

**Input (POST `/api/auth/request-password-reset`):** `{ email }`.

**Steps:**
1. Zod validation.
2. Active-user lookup by email (`deletedAt: null`).
3. **If user found:** invalidate the user's previous unused tokens, generate a fresh raw token (32 random bytes), compute SHA-256, create `PasswordResetToken`, send a mail via `lib/mail.ts` with the link `https://<host>/reset-password/<raw token>`.
4. **If user not found:** **do nothing, but return the same response.** This is the defense against email enumeration: an attacker must not be able to tell from the response whether an email exists.

**Response is always identical:** `{ ok: true, message: 'If this email is registered, a reset link has been sent.' }`. Both for found and not-found.

**Errors:** only `400` (validation). 200 in all other cases.

### 5. Confirm password reset

**Input (POST `/api/auth/reset-password`):** `{ token, newPassword }`.

**Steps:**
1. Zod validation (newPassword min 8, token non-empty).
2. Hash the presented token: SHA-256. Lookup `PasswordResetToken.findUnique({ where: { tokenHash } })`.
3. If not found / `usedAt != null` / `expiresAt <= now` — "invalid or expired link" error.
4. Load the associated `User`, ensure `deletedAt: null`. If soft-deleted — same error message (do not reveal that the user was deleted).
5. Transaction:
    - `User.update({ where: { id: userId }, data: { passwordHash: <new bcrypt> } })`.
    - `PasswordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })`.
6. Do not auto-login — redirect to `/login` with a message "Password updated, please log in."

**Response:** `{ ok: true }` or error.

---

## Middleware and route protection

`middleware.ts` at the project root. Uses `auth` from `lib/auth.ts`.

- Protected prefixes: `/account/*`, `/admin/*`.
- No session → redirect to `/login?callbackUrl=<original URL>`.
- Session present but non-admin hits `/admin/*` → redirect to `/` (or a 403 page; a redirect is enough at this stage).
- An authenticated user hits `/login` or `/register` → redirect to `/account/profile` (the page doesn't exist yet, but the redirect is correct and will start working when it does).

You don't need to protect the actual `account/admin` pages now — those pages will come from other features. The goal is for middleware to already be working so any new page under those prefixes is protected from day one.

---

## Lib / shared

### `lib/mail.ts`

Minimal interface:

```ts
type MailKind = 'welcome' | 'password-reset';

export async function sendMail(args: {
  to: string;
  kind: MailKind;
  data: Record<string, string>;
}): Promise<void>
```

In development: `console.log('[mail]', args)`. No external calls. Real SMTP will plug in later behind this same interface, so callers don't change.

### `lib/validation/auth.ts`

Zod schemas. Limits come from shared constants (see **Field constraints** in the DB schema): email max 254 + `z.string().email()`, name 1..100, password min 8, token non-empty.

### Constants in `lib/constants.ts` (or continuation of the existing file, if there is one)

- `PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000` (1 hour).
- `BCRYPT_COST = 12`.
- `PASSWORD_MIN_LENGTH = 8`.

These numbers are used by both Zod and the token logic — single source of truth.

---

## Environment variables

In `.env` (and `.env.example`):

- `AUTH_SECRET` — generated with `npx auth secret` or `openssl rand -base64 32`. Required.
- `AUTH_URL` — for dev `http://localhost:3000`. In prod = your domain.
- `DATABASE_URL` — already exists for Prisma.

`.env` must already be in `.gitignore`. If not — add it.

---

## What we are NOT doing in this feature (explicitly out of scope)

- **Account deletion** — separate feature later. The schema already supports it; auth just works correctly with `deletedAt`.
- **Email verification at registration** — not needed now. Registration produces an active account immediately. Can be added later as a separate feature; in the schema this would add `emailVerifiedAt` on `User`. For now — do not add.
- **Rate limiting** on login / reset endpoints. Needed before prod (defense against brute force), but it's a separate step closer to deploy, not in this feature.
- **Real SMTP.** Email goes to console; the interface is ready for substitution.
- **OAuth providers** (Google, Yandex ID, GitHub). Not in scope.
- **2FA.** Not in scope.
- **The actual `/account/*`, `/admin/*` pages** — those pages don't exist yet; just middleware infrastructure.

---

## Build steps

1. Install dependencies: `pnpm add next-auth@beta @auth/prisma-adapter bcryptjs zod`, `pnpm add -D @types/bcryptjs`.
2. Generate `AUTH_SECRET`, put it in `.env`.
3. Add the `PasswordResetToken` model to `schema.prisma`, generate migration: `pnpm prisma migrate dev --name auth-password-reset`.
4. Write `lib/auth.ts`, `lib/mail.ts`, `lib/validation/auth.ts`, the constants.
5. Write API routes: register, request-password-reset, reset-password; plus the `[...nextauth]` route.
6. Write pages: login, register, reset-password (×2). Minimal markup — forms + error messages. No design, no styling beyond defaults. The goal is working flows, not a pretty page.
7. Write `middleware.ts`.
8. Verify manually: register → log in console → register again with the same email → 409 → log in → cookie present → log out → request reset (link logs to console) → follow link → new password → old password fails, new one works. Reset request for a non-existent email returns the same success message.

## Notes for the implementer

- **The http-only cookie is a requirement, not a trade-off.** Do not try to put the token in localStorage even "for SPA convenience." This isn't an SPA; it's App Router with server rendering.
- **JWT strategy for Credentials is a v5 constraint**, not a user choice. Auth.js does not support the database strategy with Credentials. This does not contradict "session in a cookie" — the JWT IS the cookie contents.
- **Do not implement "remember me" now** — it's an extra form parameter unnecessary for the current scope. Auth.js's default session lifetime (30 days) is fine.
- **Do not develop UI beyond the minimum.** The spec deliberately doesn't prescribe styles — forms must work, surface errors, do redirects. Design will plug in later as a separate feature.
- **Server Actions vs API routes:** implementing register/request-password-reset/reset-password as Server Actions instead of `app/api/.../route.ts` is acceptable if it's more natural for the call site. The main thing is consistency.
- **If a detail is not specified** — pick a sensible default and leave a `// NOTE:`. Not blocking.
