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
