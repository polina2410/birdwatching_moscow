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
