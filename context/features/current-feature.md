# Current Feature: Admin Panel CRUD

## Status
In Progress

## Goals

- `SUPERADMIN` role added to `Role` enum with migration; existing data preserved
- Middleware updated: `ADMIN`/`SUPERADMIN` pass `/admin/*`; `/admin/users` is `SUPERADMIN`-only; ADMIN redirect uses `?error=superadmin_required` query param (no edge-toast)
- shadcn/ui installed; components: `Button`, `Input`, `Label`, `Select`, `Table`, `Dialog`, `Tabs`, `Tooltip`, `Form`, `Toast`, `Textarea`, `Badge`, `DropdownMenu`
- `lib/auth/permissions.ts` with `isAdmin`, `isSuperAdmin`, `canManageRoles` helpers
- Admin shell `app/admin/layout.tsx`: top bar (user name + role badge + logout), sidebar (Events / Team / Requests / Users — Users visible to SUPERADMIN only)
- Events list `/admin/events`: type tabs (All/Walks/Expeditions), status filter (Draft/Active/Cancelled; Deleted never shown), title search, pagination 20/page, `createdAt` DESC; base query always excludes `DELETED`
- Events create `/admin/events/new`: full form with walk/expedition type switching, slug auto-fill + server-side collision suffix, two save buttons (draft / publish)
- Events edit `/admin/events/[id]`: slug read-only, status-driven action buttons; CANCELLED → Restore (asks new date if `startsAt < now()`); expedition edit shows "Заявки на это событие (N)" link; ExpeditionDay delete-and-recreate with `clientId` in form state
- Event server actions: `createEvent`, `updateEvent`, `publishEvent` (concurrent-publish error message), `cancelEvent`, `restoreEvent(id, newStartsAt?)`, `deleteEvent` (checks tickets + CartItems, returns expiry time in error)
- Team list `/admin/team`: sortOrder ASC, `_count.events` in query for tooltip N
- Team create/edit `/admin/team/[id]` and `/admin/team/new`: full form; deletion blocked if linked to events as guide
- Requests list `/admin/requests`: type + status filters, `eventId` query param pre-filter from expedition edit link, row-click detail modal, mailto link
- Request server action: `updateRequestStatus(id, newStatus)` (NEW ↔ WAITLIST)
- Users list `/admin/users` (SUPERADMIN only): role badge, Deleted + Blocked indicators, show-deleted/show-blocked toggles, email/name search
- User actions: `changeUserRole` (transactional + RoleChangeLog), `blockUser` / `unblockUser` (last-SUPERADMIN guard), View history modal
- Schema migrations: `role-superadmin`, `role-change-log`, `request-status`, `user-blocked-at`
- New constants in `lib/constants.ts`: `MAX_GALLERY_IMAGES`, `MAX_PROFILE_LINKS`, `MAX_EXPEDITION_DAYS`, `MAX_GUIDES_PER_EVENT`, `MAX_REQUEST_NAME`
- Zod validation on all forms, inline field errors; success toasts per action

## Notes

**Stack:** Next.js App Router, Server Actions (not API routes), `react-hook-form` + `@hookform/resolvers/zod`, shadcn/ui defaults (no theming). Auth via `auth()` from Auth.js v5.

**UI language:** Russian for all visible text; English for identifiers, code, logs.

**Key invariants:**
- Slug frozen on edit (`VarChar(200)`, read-only field, hint "URL зафиксирован")
- `publishedAt`/`publishedBy` set on first DRAFT→ACTIVE only, never overwritten
- Delete only available on DRAFT and CANCELLED (not ACTIVE); blocked if `Ticket` count > 0 (button disabled with tooltip); if active `CartItem` rows exist, server rejects with expiry time in message
- Deleted events invisible in admin UI — no restore flow
- At least one SUPERADMIN must always exist (checked before demote and before block)
- SUPERADMIN cannot change their own role or block themselves

**Field length ground truth** (from `schema.prisma` + `lib/constants.ts`):
- `Event.title` → `VarChar(150)` / `MAX_EVENT_TITLE`
- `Event.location` → `VarChar(100)` / `MAX_EVENT_LOCATION`
- `Event.description`, `ExpeditionDay.description`, `TeamMember.education/achievements` → `@db.Text` (unbounded); Zod cap via `MAX_DESCRIPTION = 1000`
- `ExpeditionDay.title` → `VarChar(150)` / `MAX_EXPEDITION_DAY_TITLE`
- `TeamMember.name` → `VarChar(50)` / `MAX_NAME`
- `User.name` → `VarChar(50)` / `MAX_NAME` (auth spec says 100 — schema wins)
- `Request.name` → `VarChar(100)` / `MAX_REQUEST_NAME = 100` (new constant)
- URLs → `VarChar(2048)` / `MAX_URL`

**ExpeditionDay form:** each row carries a `clientId` (`crypto.randomUUID()`) in React state and payload. Server ignores it now (delete-and-recreate). Future migration adds DB column → switch to upsert with no form changes.

**restoreEvent:** single-click when `startsAt >= now()`; opens date-picker modal when `startsAt < now()` and requires a new date before submitting.

**Requests ↔ Events link:** expedition edit page shows "Заявки на это событие (N)" link → `/admin/requests?eventId=[id]`; requests list pre-filters and hides type dropdown when `eventId` param present.

**Bootstrap:** first SUPERADMIN created via SQL (`UPDATE "User" SET role = 'SUPERADMIN' WHERE email = '...'`), not via UI.

**No tests required.** Manual verification per "definition of done" is the bar.