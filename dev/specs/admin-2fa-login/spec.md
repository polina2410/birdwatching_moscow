# Spec: Unified login with admin 2FA

**Goal:** A single `/login` page handles all roles — `USER` accounts get a session after email + OTP; `ADMIN`/`SUPERADMIN` get a mandatory second factor (password) after the same OTP step — no separate route, admins are not identified until they prove inbox access.

**Depends on:** passwordless-otp spec (all its invariants still hold unless contradicted below). Replaces the now-deleted `/login/password` route.

---

## Terminology

| Term | What it is | Lifetime | Where it lives |
|---|---|---|---|
| **OTP code** | 6-character one-time code emailed at step 1 | 5 min | SHA-256 hash in `LoginCode.codeHash` |
| **challenge token** | random 32-byte hex token exchanged after OTP verification for ADMIN | 10 min | SHA-256 hash in `AdminLoginChallenge.tokenHash`; raw value only in the HTTP response and client memory |
| **session** | Auth.js JWT in an http-only cookie | 14 days, sliding | signed cookie |

---

## Decisions that resolve ambiguity

### D1 — One page, role revealed only after inbox access is proven

The unified `/login` page has three steps:

1. **Email** — user enters address; `POST /api/auth/request-login-code` sends a code. Response is identical regardless of role (anti-enumeration).
2. **Code** — user enters OTP; `POST /api/auth/verify-login-code` verifies it:
   - `USER` or unknown email → `{ next: 'session' }` — client then calls `signIn('login-code', { email, code })` as before; no role is disclosed.
   - `ADMIN`/`SUPERADMIN` with **correct** code → `{ next: 'password', challengeToken }` — the password field appears.
   - `ADMIN`/`SUPERADMIN` with **wrong** code → 401 with generic error.
3. **Password** (admin only) — user enters password; client calls `signIn('admin-2fa', { email, challengeToken, password })`.

Justification: the OTP step proves inbox access before any role is disclosed. This removes the enumeration oracle that a role-branching email-submission step would create.

### D2 — `verify-login-code` is the sole OTP verifier for ADMIN

`authorizeLoginCode` (the `login-code` NextAuth provider) is **unchanged** — it remains USER-only. ADMIN OTP verification happens in `POST /api/auth/verify-login-code`, which consumes the `LoginCode` row and creates an `AdminLoginChallenge`. There is no second OTP check for ADMIN.

### D3 — Blocked/deleted ADMIN leaks no role

If an ADMIN email is blocked or soft-deleted, `POST /api/auth/verify-login-code` returns `{ next: 'session' }` rather than an error. The subsequent `signIn('login-code')` returns `null`, and the client shows the generic "invalid code" message. Role and account status are not disclosed at step 2.

### D4 — Challenge token is a 32-byte random hex, SHA-256 hashed in the DB

Same pattern as `PasswordResetToken`. Raw token is returned in the JSON response (HTTPS only); only its SHA-256 hash is stored. Token is single-use and has a 10-minute TTL (`ADMIN_CHALLENGE_TTL_MS`).

### D5 — `request-login-code` now sends codes to all non-blocked, non-deleted accounts

Previously the route guarded on `role === 'USER'`. That guard is removed so ADMIN/SUPERADMIN receive their OTP. The safe/anti-enumeration response shape is unchanged.

---

## What to build

### 1. New Prisma model — `AdminLoginChallenge`

```prisma
model AdminLoginChallenge {
  id        String    @id @default(uuid())
  email     String    @db.VarChar(254)
  tokenHash String    @unique @db.VarChar(64)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([email])
}
```

Migration: `prisma/migrations/20260810000001_add_admin_login_challenge/migration.sql`

### 2. Constants — `lib/constants.ts`

```ts
export const ADMIN_CHALLENGE_TTL_MS = 10 * 60 * 1000  // 10 minutes
```

### 3. Challenge token utilities — `lib/auth/challenge.ts` (new file)

```ts
export function generateChallengeToken(): string  // crypto.randomBytes(32).toString('hex')
export function hashChallengeToken(token: string): string  // SHA-256 hex
```

### 4. Validation schema — `lib/validation/auth.ts`

Add:
```ts
export const adminTwoFactorSchema = z.object({
  email: z.string().email().max(MAX_EMAIL),
  challengeToken: z.string().min(1),
  password: z.string().min(1),
})
```

`verifyLoginCodeSchema` (`{ email, code }`) is reused for the new endpoint body unchanged.

### 5. New endpoint — `app/api/auth/verify-login-code/route.ts`

`POST` accepts `{ email, code }` (validated by `verifyLoginCodeSchema`). Has same IP rate-limiting as `request-login-code`.

Logic:
```
user = findFirst({ email, deletedAt: null })
if !user OR user.role === 'USER' → return { next: 'session' }
if user.blockedAt → return { next: 'session' }  // no role disclosure
// ADMIN/SUPERADMIN path:
match = loginCode.findFirst({ email, codeHash, usedAt:null, expiresAt:>now, attempts:<max })
if !match:
  increment attempts on active code (same guard as authorizeLoginCode)
  return 401 { error: 'invalid_code' }
loginCode.update({ usedAt: now })
rawToken = generateChallengeToken()
adminLoginChallenge.create({ email, tokenHash: hash(rawToken), expiresAt: now + TTL })
return 200 { next: 'password', challengeToken: rawToken }
```

### 6. `authorizeAdminTwoFactor` — `lib/auth/authorize.ts`

New function (alongside unchanged `authorizeLoginCode` and `authorizeCredentials`):

```
parse adminTwoFactorSchema
challenge = adminLoginChallenge.findFirst({ email, tokenHash, usedAt:null, expiresAt:>now })
if !challenge → return null
user = user.findFirst({ email, deletedAt:null })
if !user OR !user.passwordHash → return null
if user.blockedAt → throw AccountBlockedError
if user.passwordResetRequired → throw PasswordResetRequiredError
if !bcrypt.compare(password, passwordHash) → return null
adminLoginChallenge.update({ usedAt: now })
return { id, email, name, role }
```

Status checks run **before** `bcrypt.compare` (oracle guard — same as `authorizeCredentials`).

### 7. New `admin-2fa` NextAuth provider — `lib/auth.ts`

```ts
Credentials({
  id: 'admin-2fa',
  credentials: { email: {}, challengeToken: {}, password: {} },
  authorize: (credentials) => withSigninErrors(() => authorizeAdminTwoFactor(credentials)),
}),
```

### 8. Updated `request-login-code` route

Remove `user.role === 'USER'` guard. New condition: `if (user && !user.blockedAt)`.

### 9. Updated labels and errors

`lib/auth-labels.ts` — add:
```ts
adminPassword: {
  title:      'Введите пароль',
  submit:     'Войти',
  submitting: 'Входим…',
}
```

`lib/auth-errors.ts` — add:
```ts
invalidChallenge: 'Сессия истекла. Начните вход заново.',
```

### 10. Updated login page — `app/(auth)/login/page.tsx`

Step type expands to `'email' | 'code' | 'password'`. New state: `challengeToken: string`.

Step 2 submit (`handleCodeSubmit`) calls `POST /api/auth/verify-login-code`:
- `{ next: 'session' }` → `signIn('login-code', { email, code, redirect: false })` (existing USER path, unchanged)
- `{ next: 'password', challengeToken }` → `setChallengeToken(token); setStep('password')`
- non-ok response → `setError(AUTH_ERRORS.invalidCode)`

Step 3 (`handlePasswordSubmit`) calls `signIn('admin-2fa', { email, challengeToken, password, redirect: false })`:
- `account_blocked` → `AUTH_ERRORS.accountBlocked`
- `password_reset_required` → `AUTH_ERRORS.passwordResetRequired`
- any other error → `AUTH_ERRORS.wrongCredentials`

Step 3 UI: password field + submit + "Забыли пароль?" link (reuses `L.resetLink`, `L.submit`, `C.passwordField`).
Regular users **never** see the password field.

---

## Success criteria

- [ ] `pnpm test:run` passes — all existing tests green, new tests cover the cases below
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes

### Endpoint: `POST /api/auth/request-login-code`

- [ ] ADMIN email → 200, `sendMail` called once, one `LoginCode` row created
- [ ] SUPERADMIN email → same
- [ ] Blocked ADMIN → 200, no mail, no row (unchanged from blocked USER behaviour)

### Endpoint: `POST /api/auth/verify-login-code`

- [ ] Unknown email → 200 `{ next: 'session' }`
- [ ] USER email (any code) → 200 `{ next: 'session' }` (no code verification in this endpoint)
- [ ] ADMIN + valid code → 200 `{ next: 'password', challengeToken: <non-empty string> }`; `LoginCode.usedAt` set; one `AdminLoginChallenge` row created with hashed token
- [ ] ADMIN + wrong code → 401; attempt counter incremented on the active code
- [ ] ADMIN + expired code → 401
- [ ] ADMIN + code at attempt limit → 401
- [ ] Blocked ADMIN + valid code → 200 `{ next: 'session' }` (no role disclosure)
- [ ] Rate limit exceeded → 429 with `Retry-After` header
- [ ] Invalid body → 400

### `authorizeAdminTwoFactor`

- [ ] Valid challenge + correct password → returns `{ id, email, name, role }`; `AdminLoginChallenge.usedAt` set
- [ ] Valid challenge + wrong password → returns `null`; challenge row NOT consumed
- [ ] Expired challenge → returns `null`
- [ ] Already-used challenge → returns `null`
- [ ] Blocked account → throws `AccountBlockedError` even when password is correct
- [ ] `passwordResetRequired` → throws `PasswordResetRequiredError` even when password is correct
- [ ] Blocked check runs before `bcrypt.compare` (assert `bcrypt.compare` not called)
- [ ] `passwordResetRequired` check runs before `bcrypt.compare` (same assertion)

### Login page (`app/(auth)/login/page.tsx`)

- [ ] Step 1 renders email field; no password field visible
- [ ] Step 2 renders OTP code field; no password field visible
- [ ] When `verify-login-code` returns `{ next: 'session' }`, `signIn('login-code', { email, code, redirect: false })` is called
- [ ] When `verify-login-code` returns `{ next: 'password' }`, password field appears and `signIn('login-code')` is NOT called
- [ ] Step 3 calls `signIn('admin-2fa', { email, challengeToken, password, redirect: false })`
- [ ] Step 3 `password_reset_required` → `AUTH_ERRORS.passwordResetRequired` shown
- [ ] Step 3 `account_blocked` → `AUTH_ERRORS.accountBlocked` shown
- [ ] Step 3 wrong password → `AUTH_ERRORS.wrongCredentials` shown
- [ ] Successful step 3 → redirect to callbackUrl

---

## Edge cases

| Scenario | Expected behaviour |
|---|---|
| ADMIN requests code, then code expires before step 2 | `verify-login-code` returns 401; client shows "invalid code" |
| ADMIN submits valid code twice | second call finds `usedAt` set → 401 |
| ADMIN gets `{ next:'password' }`, challenge expires before step 3 | `authorizeAdminTwoFactor` returns `null` → `signIn` returns error → client shows `wrongCredentials` |
| ADMIN challenge consumed, retries step 3 | challenge has `usedAt` set → `null` → same error |
| Attacker tries `signIn('admin-2fa')` without a valid challenge | no matching row → `null` → auth fails |
| USER somehow posts to `signIn('admin-2fa')` | no `AdminLoginChallenge` for that email → `null` → auth fails |
| Soft-deleted ADMIN | `findFirst` with `deletedAt:null` returns nothing → `{ next:'session' }` at step 2; `null` at step 3 |

---

## Out of scope

- Brute-force limiting on the password step (challenge TTL + single-use are sufficient)
- "Forgot password?" link on step 3 — the reset-password route already exists at `/reset-password`; a Link can reuse `L.resetLink` without new logic
- Any UI styling — forms are functional only; design is a separate concern