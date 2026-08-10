# Spec: admin-first-login-password

## Context

Admins and SuperAdmins are created as regular users (no `passwordHash`). Admin rights are later
granted by changing the `role` column in the DB. On their **first login** (identified by
`passwordHash === null`), they must be forced to create a password before getting a session.

Builds on `admin-2fa-login`: uses the same `AdminLoginChallenge` mechanism.

---

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | `verify-login-code` returns `{ next: 'set-password', challengeToken }` when ADMIN/SUPERADMIN has `passwordHash === null` | Distinguishes first-login from subsequent logins; keeps all branching in one place |
| D2 | New endpoint `POST /api/auth/set-initial-password` sets the password and issues a **new** challenge token | Keeps the existing `admin-2fa` provider unchanged; the fresh challenge lets `signIn('admin-2fa')` complete immediately after password setup |
| D3 | `set-initial-password` rejects if the user already has a `passwordHash` | Prevents using this endpoint to change an existing password; that's reset-password's job |
| D4 | `set-initial-password` uses the same `AdminLoginChallenge` table as login | Single source of truth; no extra model |
| D5 | Password must meet `PASSWORD_MIN_LENGTH` (16 chars); confirm field is client-side only | Matches the existing `confirmResetSchema` rule |

---

## What to Build

### 1. `app/api/auth/verify-login-code/route.ts` — tiny branch addition

After confirming the user is ADMIN/SUPERADMIN and the code is valid, check `user.passwordHash`:
- `null` → return `{ next: 'set-password', challengeToken }`
- set → return `{ next: 'password', challengeToken }` (existing behaviour)

### 2. `POST /api/auth/set-initial-password` — new route

**Request body** (validated with Zod):
```ts
{ email: string, challengeToken: string, password: string }  // password >= PASSWORD_MIN_LENGTH
```

**Logic:**
1. Rate-limit by IP (reuse `checkRateLimit`)
2. Validate schema → 400 on failure
3. Look up `AdminLoginChallenge`: valid, unused, not expired, email matches → 401 if not found
4. Look up user: must exist, must be ADMIN or SUPERADMIN, must have `passwordHash === null` → 400 if already has a password
5. Hash password with `bcrypt` (same salt rounds as the rest of the app)
6. Save `passwordHash` on the user
7. Mark challenge as used (`usedAt = now`)
8. Create a **new** `AdminLoginChallenge` (10-minute TTL) with a fresh token
9. Return `{ challengeToken: newRawToken }`

**After this, the frontend calls `signIn('admin-2fa', { email, challengeToken: newToken, password })`
and gets a session normally — no changes to `authorizeAdminTwoFactor` needed.**

### 3. `app/(auth)/login/page.tsx` — new `set-password` step

Add `Step = 'email' | 'code' | 'password' | 'set-password'`.

On step 2, if `verify-login-code` returns `{ next: 'set-password' }`:
- Store `challengeToken` (same as admin path)
- Transition to `set-password` step

`set-password` form:
- `password` field (min 16 chars)
- `confirmPassword` field (client-side match check; not sent to server)
- Submit → `POST /api/auth/set-initial-password` → on success call `signIn('admin-2fa', { email, challengeToken: res.challengeToken, password })`
- Same error → label mapping as the `password` step (account_blocked, password_reset_required, wrong creds → appropriate AUTH_ERRORS)

### 4. `lib/auth-labels.ts` — new label group

```ts
adminSetPassword: {
  title:        'Создайте пароль',
  passwordField: 'Новый пароль',
  confirmField:  'Подтвердите пароль',
  submit:        'Сохранить и войти',
  submitting:    'Сохраняем…',
  mismatch:      'Пароли не совпадают',
}
```

### 5. `lib/validation/auth.ts` — new schema

```ts
export const setInitialPasswordSchema = z.object({
  email:         z.string().email().max(MAX_EMAIL),
  challengeToken: z.string().min(1),
  password:      z.string().min(PASSWORD_MIN_LENGTH),
})
```

---

## Success Criteria

All must be verified by passing `pnpm test:run`.

| # | Criterion | Test location |
|---|-----------|---------------|
| SC1 | `verify-login-code` returns `{ next: 'set-password', challengeToken }` when ADMIN has no passwordHash | `__tests__/api/auth/verify-login-code.test.ts` |
| SC2 | `verify-login-code` still returns `{ next: 'password', challengeToken }` when ADMIN has passwordHash | existing test, unchanged |
| SC3 | `POST /api/auth/set-initial-password` with valid challenge + valid password → 200, user gets passwordHash, old challenge marked used, new challengeToken returned | `__tests__/api/auth/set-initial-password.test.ts` |
| SC4 | `set-initial-password` with invalid/expired/used challenge → 401 | same file |
| SC5 | `set-initial-password` when user already has a passwordHash → 400 | same file |
| SC6 | `set-initial-password` with password shorter than `PASSWORD_MIN_LENGTH` → 400 | same file |
| SC7 | Login page transitions to `set-password` step when verify returns `{ next: 'set-password' }` | `__tests__/app/auth/login.test.tsx` |
| SC8 | Login page `set-password` form validates that passwords match before submitting | same file |
| SC9 | On successful `set-initial-password`, `signIn('admin-2fa')` is called with the returned challengeToken and the chosen password | same file |
| SC10 | Regular users (USER role) never see the `set-password` step | verify-login-code tests — USER always gets `{ next: 'session' }` |
| SC11 | `pnpm lint`, `pnpm test:run`, `pnpm build` all pass | CI gate |

---

## Edge Cases

| Scenario | Expected behaviour |
|----------|--------------------|
| Admin with no password, expired code | `verify-login-code` returns 401 — no challenge issued |
| `set-initial-password` called twice with same challenge | Second call → 401 (challenge already used) |
| Admin already has password, tries `set-initial-password` URL | 400 (user.passwordHash already set) |
| `confirmPassword` mismatch client-side | Form blocks submit, shows `mismatch` label |
| Rate limit exceeded on `set-initial-password` | 429 with `Retry-After` header |

---

## Out of Scope

- Forcing password change for admins who *already have* a password (`passwordResetRequired` flag handles that)
- Password strength beyond minimum length
- Email confirmation after setting password