# Features History

<!-- Completed features are appended here by /feature complete -->

## Globe Interactivity

**Branch:** 
**Completed:** 

### Goals


### Summary

---

## Add Database Schema

**Branch:** add-database-schema
**Completed:** 2026-05-31

### Goals

- `prisma/schema.prisma` — all entities, enums, relations, and indexes
- `prisma/migrations/` — initial migration via `prisma migrate dev --name init`, including raw SQL for partial email index and CHECK constraints
- `prisma/seed.ts` — sample walks, expeditions (with days + guides), and team members
- `lib/constants.ts` — shared field-length and range constants (used by both Zod and Prisma)

### Summary

Implemented the full Prisma data layer. Schema covers all entities with proper relations and enums. Eight CHECK constraints and a partial unique index on `User.email` are applied via raw SQL in the migration (Prisma can't express them in schema). Money stored as integer kopecks. Seed populates walks, expeditions with days and guides, and team members.

---

## Authentication

**Branch:** add-authentication
**Completed:** 2026-06-01

### Goals

- Auth.js v5 Credentials provider with JWT session strategy
- Registration, login, logout, and password reset flows
- `PasswordResetToken` model + migration (SHA-256 hashed tokens, 1h TTL)
- Route protection in `proxy.ts` for `/account/*` and `/admin/*`
- Auth pages: login, register, reset-password (request + confirm)
- Stub mail sender in `lib/mail.ts` (console.log in dev, ready for SMTP)
- Zod validation schemas for all auth flows in `lib/validation/auth.ts`
- `Request` model simplified: single `name` field, `status` removed
- `docker-compose.yml` for local PostgreSQL
- CI fixed to use pnpm; `typecheck` script added

### Summary

Implemented full email + password auth on Auth.js v5. Split config pattern used: edge-compatible `auth.config.ts` for `proxy.ts`, full Node.js config in `lib/auth.ts` with Prisma + bcrypt. Password reset uses SHA-256 hashed tokens stored in a separate `PasswordResetToken` table — raw token goes only in the email link. All email lookups filter `deletedAt: null` to handle soft-deleted accounts correctly. UI is minimal forms only; design comes later.

---

## Admin Panel CRUD

**Branch:** admin-panel-crud
**Completed:** 2026-06-11

### Goals

- `SUPERADMIN` role, middleware updates, `lib/auth/permissions.ts` helpers
- Admin shell layout: sidebar, role badge, logout
- Events CRUD: list with filters/search/pagination, create, edit, publish/cancel/restore/delete
- Team CRUD: list, create, edit (deletion blocked if linked to events)
- Requests list: filters, row-click detail modal, status toggle (NEW ↔ WAITLIST)
- Users list (SUPERADMIN only): role change, block/unblock, role history modal
- shadcn/ui installed; all Zod validation with inline errors; success toasts
- Schema migrations: SUPERADMIN role, RoleChangeLog, RequestStatus, blockedAt

### Summary

Full admin panel built with Next.js App Router Server Actions. Four sections covering events, team, requests, and users. Events support full lifecycle management including slug auto-generation, expedition days, guide assignment, and ticket-aware delete guard. Users section is SUPERADMIN-gated with transactional role changes logged to RoleChangeLog. Auth guards added per-page (defense-in-depth on top of layout). `useAdminAction` hook extracts shared server-action pattern. `ensureUniqueSlug` uses crypto.randomUUID with retry loop. Cross-field `spotsLeft <= totalSpots` validation on both client and server.

---

## Walk / Expedition Schema Split

**Branch:** walk-expedition-split
**Completed:** 2026-06-29

### Goals

- Replace the single `Event` Prisma model with two dedicated models — `Walk` and `Expedition`
- Eliminate nullable-by-convention fields; make type-specific constraints explicit in the schema
- Zero TypeScript errors with no remaining references to `Event` model or `EventType` enum

### Summary

Replaced the polymorphic `Event` model with `Walk` (ticketed, single guide FK) and `Expedition` (spot-based, M2M guides, multi-day). Migration drops the `Event` table and all `EventType` references, creates the two new tables with proper constraints, renames the `Ticket.eventId` FK to `walkId`, and adds `expeditionId` to `Request`. Seed updated to populate both models. All admin CRUD updated to use the new models.

---

## Django Admin Setup

**Branch:** django-setup
**Completed:** 2026-06-29

### Goals

- Bootstrap Django project in `django_admin/` connected to the same PostgreSQL DB as the Next.js app
- Read-only `managed=False` models mirroring all Prisma tables
- `AppUserAuthBackend` authenticates Django admin logins via the app's `User` table — no separate credential management

### Summary

Created the full `django_admin/` project: Django 5, jazzmin, psycopg2-binary, bcrypt. Settings parse `DATABASE_URL` manually; `MIGRATION_MODULES = {'birdwatch': None}` prevents Django from touching Prisma-managed tables. Seven `managed=False` models mirror Walk, Expedition (M2M guides via `_ExpeditionToTeamMember`), ExpeditionDay, AppUser, TeamMember, Request, and RoleChangeLog. `AppUserAuthBackend` looks up by email with deleted/blocked filters, verifies bcrypt hash, gates on ADMIN/SUPERADMIN role, and syncs `is_superuser` on every login. 11 unit tests using `SimpleTestCase` (no live DB required).

---

## Django Admin Registration

**Branch:** django-admin-registration
**Completed:** 2026-06-30

### Goals

- Register admin classes for Walk, Expedition, Request, AppUser, and TeamMember
- Russian verbose names and sidebar ordering via Jazzmin
- `block_users` / `unblock_users` actions available to all staff (ADMIN + SUPERADMIN)
- `change_role` action (SUPERADMIN only) with intermediate form, own-account skip, last-SUPERADMIN guard, and `RoleChangeLog` insert

### Summary

Implemented five `ModelAdmin` classes in `django_admin/birdwatch/admin.py`. `WalkAdmin` includes a `price_roubles` computed column (kopecks ÷ 100). `RequestAdmin` and `AppUserAdmin` disable add/delete. `AppUserAdmin` exposes three bulk actions: `block_users` (all-or-nothing last-SUPERADMIN guard), `unblock_users`, and `change_role` (SUPERADMIN-only, intermediate `TemplateResponse` form, per-row skip for own account and last-SUPERADMIN, UUID-keyed `RoleChangeLog` inserts). `get_actions` override strips `change_role` from the dropdown for non-superuser staff. 26 unit tests using `SimpleTestCase` with full mocking — no live DB required.

---

## Admin Navigation Button

**Branch:** admin-navigation-button
**Completed:** 2026-06-30

### Goals

- ADMIN and SUPERADMIN see `<a href="/admin/">Админка</a>` on the homepage; USER and unauthenticated users see nothing
- Dev-only `next.config.ts` rewrite proxies `/admin/:path*` to `http://localhost:8000/admin/:path*`

### Summary

Converted `app/page.tsx` to an async Server Component that calls `auth()` and conditionally renders the Django admin link for privileged roles. Added a dev-only `rewrites()` entry to `next.config.ts` (returns empty array in production/test). Added `__tests__/setup.ts` with global `afterEach(cleanup)` to fix Testing Library DOM accumulation across tests (needed because `vi.globals` is not enabled). Auth mock uses `auth as unknown as Mock<() => Promise<Session | null>>` to resolve Auth.js v5 overload ambiguity in `tsc --noEmit`.

---

## Django Production Deploy

**Branch:** django-production-deploy
**Completed:** 2026-06-30

### Goals

- Env-driven `DEBUG`, `SECRET_KEY`, and `ALLOWED_HOSTS` with startup guards when `DEBUG=false`
- `STATIC_ROOT = BASE_DIR / 'staticfiles'` and absolute `STATIC_URL = '/static/'` for collectstatic
- `USE_X_FORWARDED_HOST` and `SECURE_PROXY_SSL_HEADER` for nginx reverse-proxy
- `gunicorn>=22.0` in `requirements.txt`

### Summary

Made Django admin production-ready on the Selectel VPS. Settings now read `DEBUG`, `SECRET_KEY`, and `ALLOWED_HOSTS` from environment variables. Two `ImproperlyConfigured` guards prevent startup when `DJANGO_DEBUG=false` and either `DJANGO_ALLOWED_HOSTS` or `DJANGO_SECRET_KEY` is missing. `STATIC_URL` changed from relative `'static/'` to absolute `'/static/'`; `STATIC_ROOT` added at `BASE_DIR / 'staticfiles'`. `USE_X_FORWARDED_HOST = True` and `SECURE_PROXY_SSL_HEADER` configured so nginx proxy headers are trusted. `gunicorn>=22.0` added to `requirements.txt`. 13 unit tests using `SimpleTestCase` (no live DB required); run with `DJANGO_DEBUG=true DATABASE_URL=<url> python manage.py test birdwatch`.

---

## Django Admin CRUD

**Branch:** django-admin-crud
**Completed:** 2026-06-30

### Goals

- Walk CRUD: create/edit/delete with auto UUID, auto slug from title, auto `createdAt`; publish/cancel/restore bulk actions
- Expedition CRUD: create/edit/delete with auto UUID, auto slug, auto `createdAt`, `spotsLeft` initialised to `totalSpots`; `ExpeditionDay` managed as inline; publish/cancel/restore bulk actions
- TeamMember CRUD: create/edit/delete with `profileLinks` array handled via newline-separated textarea
- Request: `toggle_status` bulk action (NEW ↔ WAITLIST); add/delete remain disabled

### Summary

Expanded Django admin to replace the previously removed Next.js admin panel. `WalkAdmin` and `ExpeditionAdmin` both override `save_model` to auto-generate UUID primary keys, slugs (from title via `slugify` with uniqueness retry), and `createdAt` timestamps on creation. `ExpeditionAdmin` also initialises `spotsLeft = totalSpots` on create and manages `ExpeditionDay` rows via `ExpeditionDayInline` (UUID-generated in `save_formset`). Both models get publish/cancel/restore bulk actions that update `status`, `publishedAt`, and `publishedBy`. `TeamMemberAdmin` uses a custom `TeamMemberForm` that exposes `profileLinks` as a newline-separated textarea, converting to/from the PostgreSQL array on save. `RequestAdmin` gains a `toggle_status` action (NEW ↔ WAITLIST) while keeping add/delete disabled. 24 `SimpleTestCase` tests, no live DB required.

---

## Next.js Admin Panel

**Branch:** nextjs-admin
**Completed:** 2026-08-03

### Goals

- Replace Django admin with a custom Next.js admin panel (Walks, Expeditions, Team, Requests, Users)
- Remove all Django infrastructure from the repository
- Middleware role-gates for `/admin/*`: unauthenticated → login, USER → home, ADMIN blocked from `/admin/users`
- Server Actions with full CRUD lifecycle, slug auto-generation (Cyrillic transliteration), gallery fields
- `galleryUrl` on Walk, `galleryUrls[]` on Expedition + migration

### Summary

Replaced the Django admin process with a Next.js App Router admin panel. All five sections (Walks, Expeditions, Team, Requests, Users) implemented as Server Components with Server Actions. Role-gated middleware handles three redirect scenarios. Slug utility transliterates Cyrillic and retries up to 5 times on collision. Walk gallery is a single optional URL; Expedition gallery is an array of up to 5 URLs. Users section is SUPERADMIN-only with transactional role changes logged to RoleChangeLog. 348 tests across 42 files; zero TypeScript build errors.

---

## Passwordless OTP

**Branch:** passwordless-otp
**Completed:** 2026-08-03

### Goals

- `USER` accounts log in with a 6-char email OTP (valid 5 min, 5-attempt cap) — no password required
- `ADMIN`/`SUPERADMIN` keep password login at `/login/password`; `PASSWORD_MIN_LENGTH` raised to 16
- All existing ADMIN/SUPERADMIN accounts flagged `passwordResetRequired = true` by migration — must reset before next login
- Sessions live 2 weeks with sliding renewal
- `middleware.ts` written so sliding renewal actually fires
- `User.passwordHash` made nullable; USER rows nulled by migration; `LoginCode` model added
- Registration drops the password field; password-reset flow silently skips USER accounts
- Django admin immune to `TypeError` 500 when a USER email is entered

### Summary

Implemented passwordless OTP login for USER accounts alongside retained password login for ADMIN/SUPERADMIN at `/login/password`. `LoginCode` model stores SHA-256 hashed 6-char codes with 5-minute TTL and 5-attempt cap. `User.passwordHash` made nullable; existing USER hashes nulled by migration. All ADMIN/SUPERADMIN accounts flagged `passwordResetRequired = true`. Session sliding renewal wired correctly in middleware. Registration and password-reset flows updated to skip USER accounts.

---

## Admin First-Login Password

**Branch:** verify_login
**Completed:** 2026-08-10

### Goals

- `POST /api/auth/verify-login-code` returns `{ next:'set-password', challengeToken }` when ADMIN/SUPERADMIN has `passwordHash === null`; returns `{ next:'password', challengeToken }` when passwordHash is set
- `POST /api/auth/set-initial-password`: valid challenge + password → saves hash, marks challenge used, issues new challenge, returns `{ challengeToken }`; invalid challenge → 401; user already has password → 400; short password → 400; rate limit → 429
- Login page `set-password` step: shows after `{ next:'set-password' }`, has password + confirm fields, validates match client-side, calls `set-initial-password` then `signIn('admin-2fa')` with returned token
- `pnpm test:run`, `pnpm lint`, `pnpm build` all pass

### Summary

Added forced password setup for ADMIN/SUPERADMIN accounts with no passwordHash. `verify-login-code` now returns `next:'set-password'` for such accounts; the new `set-initial-password` endpoint validates the challenge token, hashes and saves the password, issues a fresh challenge, and returns a new token so the login page can proceed directly to `signIn('admin-2fa')`. `AdminLoginChallenge` table added via migration. Login page gains a `set-password` step with password + confirm fields and client-side match validation.

---

## YooKassa Payment Integration

**Branch:** yookassa-payment
**Completed:** 2026-07-30

### Goals

- `POST /api/checkout` — authenticated, rate-limited; creates `Order` + `OrderItem` rows in one locked transaction; calls ЮKassa Smart Payment and returns `{ orderId, confirmationUrl }`
- `POST /api/payments/yookassa/webhook` — IP-allowlist check, Zod parse, dispatches to `applyPaymentResult`
- `lib/payments/applyPaymentResult.ts` — idempotent state machine for `succeeded`/`canceled`/`pending`; creates tickets and sends mail on success
- `GET /api/orders/[id]` — owner-only status polling endpoint
- `YOOKASSA_MODE=stub` runs the full state machine with zero outbound HTTP; switching to live is env-only
- 54-ФЗ receipt support via `lib/payments/receipt.ts`; all money as integer kopecks, never floats
- `OrderItem`, `Order.expiresAt`, `Order.paidAt`, `Order.paymentIssue` schema additions

### Summary

Implemented the full YooKassa Smart Payment flow. Checkout transaction uses authoritative server-side pricing (no client-supplied amounts), holds seats for 20 minutes via `expiresAt`, and clears cart atomically. `applyPaymentResult` is the single reconciliation point for both webhooks and return-page polling — idempotent on duplicate delivery. `YOOKASSA_MODE=stub` (default) requires no API key: a dev confirmation page at `/dev/yookassa/[paymentId]` fires real-shaped webhook notifications to exercise the full state machine locally. Hand-wrote and registered the migration via `prisma migrate resolve --applied` due to pre-existing DB drift.
