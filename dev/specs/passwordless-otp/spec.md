# Spec: Passwordless email-OTP login for regular users

**Goal:** `USER` accounts sign in with a one-time code emailed to them (valid 5 minutes) instead of a password, while `ADMIN`/`SUPERADMIN` keep password login, and every session lives 2 weeks with sliding renewal.

**Depends on:** `context/specs/auth-spec.md` (all its invariants still hold unless contradicted below).

---

## Terminology (two different secrets — do not conflate)

| Term | What it is | Lifetime | Where it lives |
|---|---|---|---|
| **code** | 6-character one-time login code, typed by hand from an email | 5 minutes | SHA-256 hash in `LoginCode.codeHash`; raw value only in the email |
| **token** | the Auth.js JWT session, inside the http-only session cookie | 14 days, sliding | signed cookie, never in the DB |

---

## Decisions that resolve ambiguity in the request

### D1 — Code format: 6 characters, not 16

The code is **6 characters** drawn uniformly from a 32-symbol ambiguity-free alphabet
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0/O`, `1/I/L`).

Justification: 32^6 ≈ 1.07 × 10^9 ≈ 2^30 of entropy inside a 5-minute window with one active code per
email and a 5-attempt cap — brute force is infeasible. A 16-character hand-typed code is not a
recognised pattern in any OTP guidance and roughly triples transcription-error rate and entry time,
which is the dominant cost in this flow. See **Q1** — this decision is contingent on the reading of
"16 symbols minimum".

### D2 — "16 symbols minimum" is read as the ADMIN password minimum

`PASSWORD_MIN_LENGTH` rises from 8 to 16, applied to the only accounts that still have passwords
(`ADMIN`/`SUPERADMIN`). This reading follows the sentence order of the request ("Admin and Superadmin
should still use a password. the length should be 16 symbols minimum") and is a standard hardening
step for privileged accounts. **Blocking — see Q1.**

### D2b — Existing admin passwords: forced rotation

All current `ADMIN`/`SUPERADMIN` accounts must reset their password before they can log in again. Because bcrypt hashes are one-way, it is impossible to check whether an existing hash corresponds to a ≥ 16-character password, so the migration pessimistically assumes they are all short. The approach:

- Add `passwordResetRequired Boolean @default(false)` to `User`.
- Migration: `UPDATE "User" SET "passwordResetRequired" = true WHERE role IN ('ADMIN', 'SUPERADMIN')`.
- In the `credentials` `authorize` callback: after a successful `bcrypt.compare`, if `user.passwordResetRequired === true`, throw a new `PasswordResetRequiredError` (code `'password_reset_required'`).
- `/login/password` maps that error code to `AUTH_ERRORS.passwordResetRequired` — a message directing the user to request a reset link.
- `app/api/auth/reset-password/route.ts`: on a successful reset, additionally `User.update({ passwordResetRequired: false })`.

### D3 — "as django docs recommends" is read as two things

1. **Storage**: only the SHA-256 hash of the code is persisted, never the plaintext — mirrors Django's
   `default_token_generator` philosophy and the existing `PasswordResetToken` pattern in this repo.
2. **Session lifetime**: Django's `SESSION_COOKIE_AGE` default is `1209600` seconds = exactly 2 weeks,
   and `SESSION_SAVE_EVERY_REQUEST = True` is Django's documented way to get sliding renewal. This is
   the direct source of the "2 weeks with continuation" requirement, so we mirror both numbers.

### D4 — Two separate login routes, not one role-detecting page

- `/login` — email → code (USER flow). **Always** advances to the code-entry step, whatever the email is.
- `/login/password` — email + password (ADMIN/SUPERADMIN flow). The current `/login` form, moved.

Justification: the alternative — one page that asks for the email and then returns which form to show —
is an **email-enumeration and role-disclosure oracle**: the response tells an attacker both that an
address is registered and that it is privileged, i.e. exactly which accounts are worth attacking.
Separate routes remove the oracle entirely and keep the password path byte-for-byte the behaviour it
has today. Cost: an admin landing on `/login` must click one link ("Вход для сотрудников").

**The route must not be `/admin/login`**: `next.config.ts` rewrites `/admin/:path*` to the Django admin
(dev) and nginx does the same in production, so that path is unreachable from Next.js.

---

## What to build

### 1. Constants — `lib/constants.ts`

```ts
export const LOGIN_CODE_LENGTH = 6
export const LOGIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L
export const LOGIN_CODE_TTL_MS = 5 * 60 * 1000
export const LOGIN_CODE_MAX_ATTEMPTS = 5
// Django's SESSION_COOKIE_AGE default (2 weeks) + SESSION_SAVE_EVERY_REQUEST semantics
export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60 // 1209600
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60   // extend at most once per day
export const PASSWORD_MIN_LENGTH = 16 // was 8 — ADMIN/SUPERADMIN only now
```

### 2. Schema — `prisma/schema.prisma` + migration

```prisma
model User {
  passwordHash          String?  // was String — USER accounts have none
  passwordResetRequired Boolean  @default(false)
  // ...unchanged
}

model LoginCode {
  id        String    @id @default(uuid())
  email     String    @db.VarChar(254)
  codeHash  String    @db.VarChar(64)
  expiresAt DateTime
  usedAt    DateTime?
  attempts  Int       @default(0)
  createdAt DateTime  @default(now())

  @@index([email])
}
```

- Keyed by **email, not `userId`** — no FK, so the request endpoint performs an identical amount of
  work whether or not the account exists.
- `codeHash` is deliberately **not `@unique`** (unlike `PasswordResetToken.tokenHash`): the 6-character
  space makes cross-account collisions realistic. **Lookup is always `email + codeHash` together.**
  Looking up by `codeHash` alone would let a code issued for one account authenticate another.
- Migration:
  1. `ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL` — irreversible.
  2. `UPDATE "User" SET "passwordHash" = NULL WHERE "role" = 'USER'` — nulls dead credentials.
  3. `ALTER TABLE "User" ADD COLUMN "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false`
  4. `UPDATE "User" SET "passwordResetRequired" = true WHERE "role" IN ('ADMIN', 'SUPERADMIN')` — forces existing admins to rotate to a ≥ 16-character password.

### 3. Code generation — `lib/login-code.ts` (new)

- `generateLoginCode(): string` — `LOGIN_CODE_LENGTH` chars, each index from `crypto.randomInt(0, 32)`.
  Not `Math.random`.
- `hashLoginCode(raw: string): string` — `normalizeLoginCode` then `sha256` hex, matching the existing
  hashing in `app/api/auth/reset-password/route.ts`.
- `normalizeLoginCode(raw: string): string` — strip all whitespace and hyphens, uppercase. Applied on
  both write and read so `"ab c-d2f"` verifies against `ABCD2F`.

### 4. `POST /api/auth/request-login-code` (new)

1. Validate `{ email }` with `requestLoginCodeSchema`.
2. `prisma.user.findFirst({ where: { email, deletedAt: null } })`.
3. Send a code **only if** the user exists **and** `role === 'USER'` **and** `blockedAt === null`:
   - `deleteMany` the email's unused `LoginCode` rows (one active code per email, mirroring the
     password-reset invalidation pattern),
   - create a row with `codeHash`, `expiresAt = now + LOGIN_CODE_TTL_MS`,
   - `sendMail({ to, kind: 'login-code', data: { code } })`.
4. **Always** respond `200 { ok: true, message: 'Если этот email зарегистрирован, мы отправили код.' }` —
   identical body and status for unknown email, ADMIN/SUPERADMIN, blocked, and soft-deleted accounts.
5. Only other possible response is `400` on Zod failure.

### 5. Second Credentials provider — `lib/auth.ts`

Register a second provider alongside the existing one, `Credentials({ id: 'login-code', ... })`.
`authorize`:

1. Parse `{ email, code }` with `verifyLoginCodeSchema`; `null` on failure.
2. Find the user (`email`, `deletedAt: null`); `null` if absent or `role !== 'USER'`.
3. Find `LoginCode` where `email` matches AND `codeHash = hashLoginCode(code)` AND `usedAt IS NULL`
   AND `expiresAt > now` AND `attempts < LOGIN_CODE_MAX_ATTEMPTS`.
4. On no match: increment `attempts` on the email's newest unused, unexpired row (so guessing burns the
   budget), return `null`.
5. On match: set `usedAt = now` and return `{ id, email, name, role }` in a single transaction.
6. `blockedAt !== null` → throw `AccountBlockedError` (same class and `code` the password provider uses,
   so `/login` can reuse `AUTH_ERRORS.accountBlocked`).

The existing default `credentials` provider gains one guard: `if (!user.passwordHash) return null`
(a `USER` row can no longer satisfy the password path even if a stale hash survives).

### 6. Session lifetime — `lib/auth.ts` and new `middleware.ts`

```ts
session: {
  strategy: 'jwt',
  maxAge: SESSION_MAX_AGE_SECONDS,
  updateAge: SESSION_UPDATE_AGE_SECONDS,
}
```

**`middleware.ts` at the repo root is required, not optional.** Auth.js only re-issues a refreshed
session cookie from a context that can write `Set-Cookie`. `auth()` inside a Server Component cannot
set cookies during render, and this repo currently has **no `middleware.ts` and no `SessionProvider`**
— so with the config above alone the session would silently expire 14 days after login with no sliding
renewal, which fails the requirement. The middleware must:

- be `export default auth((req) => { ... })` from `@/lib/auth` and return a response on every matched
  request, so the rotated cookie reaches the browser;
- `matcher` covering app pages, excluding `/api/*`, `/_next/*`, static assets, and `/admin/*` (Django);
- redirect unauthenticated requests for protected prefixes to `/login?callbackUrl=…`
  (the `auth-spec.md` stub that was specified but never built).

### 7. Registration without a password

- `registerSchema` drops `password` entirely.
- `app/api/auth/register/route.ts` drops the `bcrypt.hash` call and creates the user with no
  `passwordHash`. Welcome email unchanged. Post-register redirect to `/login?registered=1` unchanged.
- `app/(auth)/register/page.tsx` drops the password field and stops sending `password`.

### 8. Password reset stays admin-only

`app/api/auth/request-password-reset/route.ts`: add `&& user.role !== 'USER'` to the issue condition.
A `USER` gets the existing `SAFE_RESPONSE` with no token created and no mail sent. The reset-confirm
route is unchanged except that `confirmResetSchema.newPassword` now uses the raised
`PASSWORD_MIN_LENGTH`. `/login/password` keeps the "Забыли пароль?" link; `/login` does not have one.

### 9. Mail — `lib/mail.ts`

Add `'login-code'` to `MailKind` and a `loginCodeTemplate` returning subject `Ваш код входа`, with the
code rendered prominently in `html` and present in `text`, plus "Код действует 5 минут." Both branches
must contain `data.code` verbatim (uppercase, unspaced) so it is copy-pasteable.

### 10. Pages and labels

- `app/(auth)/login/page.tsx` — two steps in one client component: email → code. Step 2 shows the
  masked email, a code input (`inputMode="text"`, `autoComplete="one-time-code"`, `maxLength` 6 after
  normalisation), a "back" control, and a "send again" control that re-posts to step 1.
  Submits `signIn('login-code', { email, code, redirect: false })`.
- `app/(auth)/login/password/page.tsx` — the current `/login` form moved verbatim.
- `AUTH_LABELS` gains a `loginCode` group; `AUTH_ERRORS` gains `invalidCode`
  (`'Неверный или устаревший код.'`) — one message for wrong/expired/used/attempts-exhausted.

### 11. Django admin must not break

`AppUser.passwordHash` becoming nullable breaks `django_admin/birdwatch/backends.py`. Today
`bcrypt.checkpw(password.encode(), None)` raises `TypeError` **outside** the `try` block → HTTP 500 on
the Django login page whenever a `USER` email is entered. Fix:

- `django_admin/birdwatch/models.py`: `passwordHash = models.CharField(..., null=True, blank=True)`.
- `django_admin/birdwatch/backends.py`: move the `app_user.role not in _ADMIN_ROLES` check **above** the
  bcrypt call, and add `if not pwd_hash: return None`.

---

## Success criteria

Unit/integration tests under `__tests__/`, all green via `pnpm test:run`.

- [ ] `generateLoginCode()` returns a string of length `LOGIN_CODE_LENGTH` whose every character is in `LOGIN_CODE_ALPHABET`; over 1000 calls no character is `0`, `O`, `1`, `I` or `L`, and at least 25 distinct characters appear.
- [ ] `normalizeLoginCode(' ab c-d2f ') === 'ABCD2F'`, and `hashLoginCode('ab cd2f') === hashLoginCode('ABCD2F')`.
- [ ] `hashLoginCode(x)` returns 64 lowercase hex chars and never equals `x`.
- [ ] `Prisma.ModelName.LoginCode === 'LoginCode'` and `LoginCodeScalarFieldEnum` exposes `email`, `codeHash`, `expiresAt`, `usedAt`, `attempts`.
- [ ] Generated Prisma types: `UserCreateInput` accepts an object with no `passwordHash` key and type-checks (`pnpm build` succeeds).
- [ ] `POST /api/auth/request-login-code` with a registered `USER` email returns `200`, creates exactly one `LoginCode` row for that email, and calls `sendMail` once with `kind: 'login-code'`.
- [ ] The `code` passed to `sendMail` does **not** appear anywhere in the created row: `row.codeHash !== code` and `row.codeHash === hashLoginCode(code)`.
- [ ] Requesting a second code for the same email leaves exactly one unused `LoginCode` row for that email.
- [ ] `POST /api/auth/request-login-code` returns a byte-identical body and status `200` for: unknown email, `ADMIN` email, `SUPERADMIN` email, `blockedAt != null` email, `deletedAt != null` email. In the last four cases `sendMail` is **not** called and no `LoginCode` row is created.
- [ ] `POST /api/auth/request-login-code` with `{ email: 'not-an-email' }` returns `400`.
- [ ] `login-code` `authorize` with a valid unexpired code returns `{ id, email, name, role: 'USER' }` and sets `usedAt` on the row.
- [ ] Replaying the same code immediately after a successful sign-in returns `null`.
- [ ] `authorize` returns `null` when the clock is advanced past `expiresAt` (`LOGIN_CODE_TTL_MS + 1` ms) — verified with `vi.useFakeTimers`.
- [ ] A code created for `a@test.com` fails `authorize` when submitted with `email: 'b@test.com'`, even though `codeHash` matches.
- [ ] After `LOGIN_CODE_MAX_ATTEMPTS` wrong submissions, the **correct** code returns `null`.
- [ ] Each wrong submission increments `attempts` by exactly 1.
- [ ] `authorize` throws `AccountBlockedError` (`code === 'account_blocked'`) for a valid code on a `blockedAt != null` user.
- [ ] `login-code` `authorize` returns `null` for a valid-looking code when the account's role is `ADMIN`.
- [ ] The default `credentials` provider returns `null` when `user.passwordHash` is `null`, without calling `bcrypt.compare`.
- [ ] The NextAuth config object has `session.maxAge === 1209600` and `session.updateAge === 86400`.
- [ ] `middleware.ts` exports a default built from `auth` and a `config.matcher` that excludes `/admin/:path*`, `/api/:path*` and `/_next/:path*`.
- [ ] `registerSchema.safeParse({ email, name })` succeeds; `registerSchema` has no `password` key in its shape.
- [ ] `POST /api/auth/register` creates a user with `passwordHash === null` and does not call `bcrypt.hash`.
- [ ] Rendering `RegisterPage` finds no element labelled `AUTH_LABELS.common.passwordField`.
- [ ] `confirmResetSchema.safeParse({ token: 't', newPassword: '123456789012345' })` (15 chars) fails; 16 chars succeeds.
- [ ] `POST /api/auth/request-password-reset` with a `USER` email returns the existing `SAFE_RESPONSE` and creates zero `PasswordResetToken` rows; with an `ADMIN` email it creates one.
- [ ] `sendMail({ kind: 'login-code', data: { code: 'ABCD2F' } })` calls the transporter once with subject `Ваш код входа`, and both `html` and `text` contain `ABCD2F` and `5`.
- [ ] `credentials` `authorize` with a valid password but `passwordResetRequired === true` throws `PasswordResetRequiredError` (code `'password_reset_required'`), not `AccountBlockedError`.
- [ ] `app/api/auth/reset-password/route.ts`: a successful reset sets `passwordResetRequired = false`; the user can log in immediately after.
- [ ] `POST /api/auth/reset-password` rejects `newPassword` of 15 characters and accepts 16.
- [ ] Migration sets `passwordResetRequired = true` for all seeded `ADMIN`/`SUPERADMIN` rows and `false` for all `USER` rows.
- [ ] `LoginPage` step 1 renders an email field and no password field; after a successful submit it renders a code field and no email field.
- [ ] Submitting the code calls `signIn` with `'login-code'` and `{ email, code, redirect: false }`.
- [ ] `signIn` resolving with `{ error: 'CredentialsSignin' }` renders `AUTH_ERRORS.invalidCode`; with `{ code: 'account_blocked' }` renders `AUTH_ERRORS.accountBlocked`.
- [ ] `/login` renders a link to `/login/password` and no link to `/reset-password`.
- [ ] `app/(auth)/login/password/page.tsx` passes the existing `__tests__/app/auth/login.test.tsx` assertions after the import path is repointed.
- [ ] Django: `AppUserAuthBackend.authenticate` returns `None` (no exception) when `AppUser.passwordHash` is `None`, asserted with a `MagicMock(role='USER', passwordHash=None)` in `django_admin/birdwatch/tests.py`.
- [ ] Django: `authenticate` returns `None` for `role='USER'` with a non-null hash **without** invoking `bcrypt.checkpw` (assert the patched `checkpw` was not called).
- [ ] `pnpm lint` and `pnpm build` pass.

---

## Edge cases

- **Code entered in lowercase / with spaces or hyphens** — normalised before hashing; verifies.
- **Two codes requested in a row** — the first is deleted; only the newest works.
- **Code requested, then the account is blocked before entry** — `AccountBlockedError`, code not consumed.
- **Code requested, then the account is soft-deleted** — `authorize` returns `null` (lookup filters `deletedAt: null`).
- **Existing `USER` rows carrying a live bcrypt hash** at migration time — nulled by the migration, and independently rejected by the `!user.passwordHash` guard.
- **`ADMIN` requests a code at `/login`** — sees the same "код отправлен" screen, no mail arrives, no row created; must use `/login/password`.
- **Admin redirected by middleware** lands on `/login` (`pages.signIn`), not the password form — one extra click. Accepted, not fixed here.
- **Session exactly at the 14-day boundary with no activity** — expires; the user re-requests a code.
- **Session used on day 13** — `updateAge` has elapsed, cookie is re-issued with a fresh 14 days.
- **Session used twice within one hour** — `updateAge` has not elapsed, no re-issue, no extra work.
- **User has two tabs open on step 2** — both hold the same code; the first submit wins, the second gets `AUTH_ERRORS.invalidCode`.
- **`LoginCode` rows accumulate** — expired rows are never read (`expiresAt > now` in every query); no cleanup job in this iteration.

## Error cases

- **Wrong / expired / used / attempts-exhausted code** → `signIn` error → `AUTH_ERRORS.invalidCode`. One message for all four: distinguishing them tells an attacker whether an email has a live code.
- **Unknown email at step 1** → indistinguishable success screen. No mail, no row, no timing branch that touches the mailer.
- **`sendMail` throws** → already swallowed and logged by `lib/mail.ts`; the endpoint still returns the safe `200`. The user sees the code screen and no code arrives — mitigated by "send again". Not changed here.
- **Malformed JSON / missing field** → `400` from `validateRequest`, matching every other route.
- **`blockedAt != null` with a valid code** → `AUTH_ERRORS.accountBlocked`, not the generic message (matches today's password behaviour).
- **Django admin login with a passwordless `USER` email** → clean "invalid credentials", never a `TypeError`/500.

## Out of scope

- Magic links — the request specifies manual code entry.
- OAuth / social login; TOTP authenticator apps; SMS delivery.
- Email verification at registration (already out of scope in `auth-spec.md`).
- **Rate limiting** of code *requests* per email/IP (email-bombing an address). `LOGIN_CODE_MAX_ATTEMPTS`
  covers guessing a code, not flooding requests. Needed before production; separate feature.
- Cleanup job for expired `LoginCode` rows.
- Visual design of the login pages — markup and behaviour only, per `auth-spec.md`.
- Further UI design for the forced-rotation flow — the error message and redirect to `/reset-password` are sufficient.
- Migrating away from JWT to database sessions (see **Constraints**).

---

## Technical notes

**Files likely affected**

| Path | Change |
|---|---|
| `prisma/schema.prisma` + new migration | `passwordHash` nullable, `LoginCode` model |
| `lib/constants.ts` | new constants, `PASSWORD_MIN_LENGTH` 8 → 16 |
| `lib/login-code.ts` | new — generate / normalize / hash |
| `lib/auth.ts` | `login-code` provider, `session` block, `!passwordHash` guard, `passwordResetRequired` check |
| `middleware.ts` | new — required for sliding renewal |
| `lib/validation/auth.ts` | `registerSchema` loses `password`; two new schemas |
| `lib/mail.ts` | `'login-code'` kind + template |
| `lib/auth-labels.ts`, `lib/auth-errors.ts` | new strings |
| `app/api/auth/request-login-code/route.ts` | new |
| `app/api/auth/register/route.ts` | no bcrypt, no `passwordHash` |
| `app/api/auth/request-password-reset/route.ts` | skip `USER` |
| `app/(auth)/login/page.tsx` | two-step OTP form |
| `app/(auth)/login/password/page.tsx` | new — moved password form, handles `password_reset_required` error |
| `app/(auth)/register/page.tsx` | drop password field |
| `django_admin/birdwatch/models.py`, `backends.py` | nullable hash, reorder role check |
| `prisma/seed.ts` | placeholder hash still fine for the seeded admin; verify it is `ADMIN`, not `USER` |
| `__tests__/app/auth/login.test.tsx` | repoint to `/login/password`; new OTP tests alongside |

**Constraints**

- Auth.js v5 forces `strategy: 'jwt'` with Credentials providers — database sessions are impossible
  here. This contradicts the "database sessions … `strategy: 'database'`" line in `CLAUDE.md`; the
  code has always used JWT. **A 2-week sliding JWT cannot be revoked server-side** — blocking a user
  does not kill an existing session until the next `authorize`. Flagged, not solved here.
- Sliding renewal depends entirely on `middleware.ts` existing (see §6). Without it the feature looks
  configured and silently does not work — this is the highest-risk item.
- Every user lookup keeps `deletedAt: null`, per `auth-spec.md`.
- Mail delivery latency directly eats the 5-minute window. Yandex Postbox is typically seconds, but if
  delivery routinely exceeds ~60s the TTL needs revisiting.
- `django_admin` reads the same physical `User` table with `managed = False`; the Prisma migration and
  the Django model must ship together or the Django admin breaks.

**Dependencies** — none new. `crypto` is built in; `bcryptjs`, `zod`, `nodemailer`, `next-auth@beta`
are already installed.

---

## Resolved decisions

All questions settled before implementation:

| # | Question | Decision |
|---|---|---|
| Q1 | "16 symbols minimum" refers to… | **Admin/Superadmin password** (`PASSWORD_MIN_LENGTH = 16`). OTP code stays 6 chars. |
| Q2 | NULL out existing USER passwords in migration? | **Yes** — irreversible, nulled by migration. |
| Q3 | Existing admin passwords shorter than 16? | **Force rotation** — `passwordResetRequired = true` for all current ADMIN/SUPERADMIN rows. |
| Q4 | Include `LOGIN_CODE_MAX_ATTEMPTS`? | **Yes** — include the column. |
| Q5 | Protected prefixes for middleware? | **`/profile/*`** (matches `app/profile/`) replaces the old `/account/*`. `/admin/*` is excluded from Next.js middleware (Django's path). Final list: `/profile/:path*`. Extend as new protected pages land. |
