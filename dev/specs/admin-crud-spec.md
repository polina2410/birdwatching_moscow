# Implementation Task: Admin Panel CRUD

## What to build

A functional admin panel at `/admin/*` for managing events (walks + expeditions), team members, signup requests (заявки), and users. Built on shadcn/ui — functional, not designed. The brief explicitly states no design is needed for the admin panel.

This document is a specification: build what it describes. Do not summarize it back — produce the actual code, routes, pages, and components.

This spec assumes the **schema spec** and **auth spec** are already implemented. It adds one schema change (the `SUPERADMIN` role) and extends the existing auth middleware.

## Deliverables (definition of done)

1. **`SUPERADMIN` role added** to the `Role` enum, with a migration. Existing data preserved.
2. **Middleware updated** so `ADMIN` and `SUPERADMIN` may enter `/admin/*`; `/admin/users` is `SUPERADMIN`-only.
3. **shadcn/ui installed and configured** if not already. Components used: `Button`, `Input`, `Label`, `Select`, `Table`, `Dialog`, `Tabs`, `Tooltip`, `Form` (with react-hook-form + zod resolver), `Toast`, `Textarea`, `Badge`, `DropdownMenu`. Use shadcn defaults; no theming.
4. **Admin shell layout** — `app/admin/layout.tsx` with a sidebar listing sections: Events, Team, Requests, Users (Users visible only to SUPERADMIN). Current user + logout in the header.
5. **Events section** (`/admin/events`) — list with type tabs (Walks / Expeditions), status filter, title search, pagination. Create, edit, soft-delete, cancel. Includes nested `ExpeditionDay` management on the expedition edit page and guide-linking (many-to-many to `TeamMember`).
6. **Team section** (`/admin/team`) — list of team members ordered by `sortOrder`. Create, edit, delete. Reordering by editing the `sortOrder` field (no drag-and-drop in this scope).
7. **Requests section** (`/admin/requests`) — list of `Request` rows with status and type filters. Status can be updated (NEW → WAITLIST or back, per admin judgment). Read-only otherwise — заявки are not created from the admin.
8. **Users section** (`/admin/users`) — SUPERADMIN only. List users, change roles, see who is soft-deleted.
9. **Validation throughout via Zod**, using the shared constants from the schema spec.
10. **Audit trail for role changes**: when a SUPERADMIN promotes/demotes someone, who/when/what is logged. See `RoleChangeLog` model below.

The task is complete when an admin can: log in, see the admin shell, create a walk and an expedition with days and guides, publish them, edit them, see them appear in lists with the right filters, soft-delete a draft event, attempt to delete an event with tickets and see the disabled button, cancel a published event, manage team members, view/update request statuses, and (as SUPERADMIN) promote a regular user to ADMIN with the change appearing in the audit log.

## Rules that must hold (read before implementing)

- **Existing schema invariants are NOT relaxed.** Money in kopecks; soft-delete via `User.deletedAt`; slug frozen on edit; `LedgerEntry` doesn't exist anymore (already removed); ledger-style ticket creation handled by separate features. This feature only *manages* data per the existing schema; it doesn't redesign it.
- **`Event` deletion is blocked when purchased tickets exist.** Tickets count = `Ticket` rows referencing the event. If count > 0, the delete button is **disabled with a tooltip**: "Нельзя удалить событие с проданными билетами. Используйте отмену." The cancel action remains available. Delete is only available on DRAFT and CANCELLED events (ACTIVE must be cancelled first). Deleted events are invisible in the admin UI — there is no restore flow via the UI.
- **Slug is frozen on edit.** The slug field on the edit form is read-only, with a hint: "URL зафиксирован." A separate "change slug" admin action is OUT OF SCOPE; left for a future deliberate admin tool.
- **Per-type conditional requiredness** (from schema): on walks, `priceKopecks` and `capacity` are required; on expeditions, `totalSpots` and `spotsLeft` are required. The form enforces this dynamically — switching the `type` field changes which fields are required and visible.
- **Status changes are explicit user actions, not side effects.** The admin clicks "publish," "cancel," or "delete." A draft does not become `ACTIVE` because someone "saved" it. Saving updates content; status changes are separate buttons.
- **`publishedAt` / `publishedBy` are set on first transition to `ACTIVE` only**, and never overwritten after.
- **Public visibility filter (`status = ACTIVE AND startsAt >= now`) is the listing pages' problem**, not this one. The admin can see and edit drafts, cancelled, deleted, past — all of it.
- **Role changes only by SUPERADMIN.** ADMIN cannot promote anyone, cannot demote a SUPERADMIN, cannot change their own role.
- **At least one SUPERADMIN must exist at all times.** Demoting the last SUPERADMIN is rejected with an error.
- **Soft-deleted users keep their `Event.publishedBy` references intact.** Demoting or even soft-deleting a user does not rewrite history.

When a detail is unspecified, pick a sensible default and leave a `// NOTE:` comment. Not blocking.

---

## Schema changes

### `Role` enum extension

Add `SUPERADMIN`. Existing `USER` and `ADMIN` values unchanged. Migration: alter enum, no data migration needed (no rows are SUPERADMIN until manually promoted).

### New model: `RoleChangeLog`

Audit trail for role changes — required because role transitions are sensitive operations and you'll want to see who did what.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| targetUserId | uuid (fk → User) | R | whose role was changed |
| changedByUserId | uuid (fk → User) | R | which SUPERADMIN made the change |
| fromRole | enum `Role` | R | role before |
| toRole | enum `Role` | R | role after |
| createdAt | timestamp | D | `@default(now())` |

**Indexes:**
- `targetUserId` — for "history of changes to this user."
- `createdAt` — for the chronological audit view.

**Invariants:**
- Append-only. Never updated or deleted. Same pattern as the (now-removed) ledger.
- Every role change in `/admin/users` writes one row here, in the same DB transaction as the `User.role` update.

### `RequestStatus` enum and `Request.status`

The current `Request` model in `schema.prisma` has no `status` field and there is no `RequestStatus` enum. This must be added before the Requests section of the admin panel can be built. Migration: `pnpm prisma migrate dev --name request-status`.

Add to `schema.prisma`:

```prisma
enum RequestStatus {
  NEW
  WAITLIST
}
```

Add to the `Request` model:

```prisma
status RequestStatus @default(NEW)
```

No data migration needed — all existing rows default to `NEW`.

**Index:** `status` on `Request` — for the status filter query.

### `User.blockedAt`

Add a nullable `blockedAt` timestamp column to `User`. Migration: `pnpm prisma migrate dev --name user-blocked-at`.

| Field | Type | Req? | Notes |
|---|---|---|---|
| blockedAt | timestamp | — | `null` = active; set to block timestamp when blocked |

**Invariants:**
- `null` means the account is active. A non-null value means the account is blocked.
- Blocking does **not** soft-delete the user. Both `blockedAt` and `deletedAt` can coexist independently.
- Only SUPERADMIN can set or clear this field.
- A SUPERADMIN cannot block themselves.
- Blocked users retain all their data and history.

### `Event.coverPhotoUrl` and `galleryUrls`

No schema change — these are URL fields per the existing spec. **For this feature: image upload is OUT OF SCOPE. The admin pastes URLs into text inputs.** A separate "upload images" feature wires in S3 later. The forms here render `Input type="url"` for the cover and a list editor for the gallery (add URL, remove URL). The Zod URL validation from the constraints section enforces validity.

---

## Auth & middleware changes

### Login block check

In the Auth.js sign-in callback (or `authorize` function), after credentials are verified and before the session is issued, check `User.blockedAt`. If it is not `null`, reject the login with the error message **"Ваш аккаунт заблокирован. Обратитесь к администратору."** The session is never created for a blocked user — they cannot log in even if their password is correct.

If a user is already logged in when their account is blocked, their existing session remains valid until it expires naturally. Active session invalidation is OUT OF SCOPE.

### Middleware update

Extend the existing middleware (from the auth spec) to handle the three-role hierarchy:

- Unauthenticated → `/account/*` and `/admin/*` redirect to `/login?callbackUrl=...`.
- Authenticated USER hits `/admin/*` → redirect to `/` (or a 403 page; redirect is acceptable).
- Authenticated ADMIN or SUPERADMIN hits `/admin/*` → pass through.
- Authenticated ADMIN hits `/admin/users` → redirect to `/admin?error=superadmin_required`. The `/admin` page reads this query param on load and shows a toast: "Раздел доступен только для SUPERADMIN." (Middleware runs on the Edge before any React tree, so it cannot trigger a toast directly — the query param is the handoff mechanism.)
- SUPERADMIN sees everything.

### Helper

Add `lib/auth/permissions.ts`:

```ts
export function isAdmin(role: Role): boolean;          // ADMIN or SUPERADMIN
export function isSuperAdmin(role: Role): boolean;     // SUPERADMIN only
export function canManageRoles(role: Role): boolean;   // SUPERADMIN only
```

Used by middleware, server components, and Server Actions. Don't sprinkle role string comparisons throughout the codebase.

---

## Admin shell

`app/admin/layout.tsx`:

- Top bar: project name, current user's name and role badge, logout button.
- Sidebar with nav items:
  - События (`/admin/events`)
  - Команда (`/admin/team`)
  - Заявки (`/admin/requests`)
  - Пользователи (`/admin/users`) — visible **only** if current user is SUPERADMIN
- Main content area renders the page.
- Use shadcn primitives. No custom theme.

Page titles and section headers in Russian (UI language); identifiers and code in English.

---

## Events section

`/admin/events` (list) and `/admin/events/[id]` (edit), `/admin/events/new` (create).

### List page

A table with these columns:
- Title (clickable → edit page)
- Type badge (Walk / Expedition)
- Status badge (Draft / Active / Cancelled)
- Starts at
- Published at (or "—")
- Tickets sold (only for walks; "—" for expeditions)
- Actions dropdown: Edit, Publish (if Draft), Cancel (if Active), Restore (if Cancelled), Delete (if Draft or Cancelled)

**Tabs at the top:** All / Walks / Expeditions. Default: All.

**Filters above the table:**
- Status dropdown: All / Draft / Active / Cancelled. Default: All. Deleted events are never shown in the admin list — once deleted they are invisible in the UI. The server-side list query always appends `status != DELETED` regardless of which filter value is selected.
- Title search input (debounced).

**Pagination:** 20 rows per page, page numbers at the bottom.

**Sort order:** `createdAt` descending by default.

### Create form (`/admin/events/new`)

Fields visible from the start:
- Type radio: Walk / Expedition (controls which fields show below)
- Title (required, max 150) — matches `MAX_EVENT_TITLE`
- Description (textarea, max 1000) — app-level Zod cap via `MAX_DESCRIPTION`; schema is unbounded `@db.Text`
- Starts at (datetime picker, required)
- Location (required, max 100) — matches `MAX_EVENT_LOCATION`
- Cover photo URL (required)
- Gallery URLs (list of inputs; add and remove rows) — each URL validated for format (`.url()`) and length (max `MAX_URL = 2048`)
- Bird species (text or list — pick a UX; text input where the admin types comma-separated is acceptable for now)
- Slug — **auto-fills from title as the admin types**, but stays editable. Preview shown next to the field: `/events/<slug>` or `/expeditions/<slug>`.

**Walk-only fields** (appear when type = Walk):
- Price in rubles (required, ≥ 0) — stored as kopecks; the form converts. Show "руб" suffix.
- Capacity (required, ≥ 1)

**Expedition-only fields** (appear when type = Expedition):
- Total spots (required, ≥ 1)
- Spots left (required, ≥ 0; ≤ total spots — soft warning if violated, not a hard block since admin maintains these by hand)
- **Expedition days** — repeatable group: Day number (integer), Title (max 150 — matches `MAX_EXPEDITION_DAY_TITLE`), Description (max 1000 — app-level Zod cap via `MAX_DESCRIPTION`; schema is unbounded `@db.Text`). Add/remove day rows. Required: at least one day.
- **Guides** — multi-select linking to `TeamMember` rows. Required: at least one. The selector is populated from all `TeamMember` rows (the team is small; no search needed). `TeamMember` has no soft-delete, so no filtering is required. On load of the edit form, currently linked guides are pre-selected.

**Buttons:** "Сохранить как черновик" (saves with `status = DRAFT`) and "Сохранить и опубликовать" (saves and immediately sets `status = ACTIVE`, sets `publishedAt = now`, `publishedBy = currentUser`).

**Validation:** Zod, per-field errors inline. Slug uniqueness is checked server-side on submit: if a collision is detected, a random 4-char hex suffix is appended automatically (`my-walk` → `my-walk-3f9a`). The final assigned slug is shown in the success toast so the admin knows what URL was used.

### Edit form (`/admin/events/[id]`)

Same as create form **plus**:
- The slug field is **read-only**, with hint "URL зафиксирован."
- Action buttons depend on current status:
  - DRAFT → "Сохранить" (stays DRAFT) and "Опубликовать" (sets ACTIVE, sets publishedAt/publishedBy on first publish only).
  - ACTIVE → "Сохранить" and "Отменить событие" (sets CANCELLED). Confirmation modal.
  - CANCELLED → "Восстановить" (back to DRAFT) and "Удалить" (see below). If `startsAt` is in the past, clicking "Восстановить" opens a modal with a required datetime picker — the admin must set a new date before the action is submitted.
- "Удалить" button is shown for DRAFT and CANCELLED statuses only (ACTIVE events must be cancelled first), but:
  - If the event has ≥ 1 `Ticket` rows: button is **disabled** with a tooltip "Нельзя удалить событие с проданными билетами. Используйте отмену."
  - If no tickets: button is enabled. Click opens a confirmation modal; confirming sets `status = DELETED`. The event immediately disappears from the admin list — DELETED events are not accessible via the UI.

**Expedition-only addition on edit:** for EXPEDITION events, the edit page shows a "Заявки на это событие (N)" link above the action buttons. N is the count of `Request` rows with `eventId = this event`. Clicking navigates to `/admin/requests?eventId=[id]`, which pre-filters the requests list to this event.

**Per-type field switching on edit:** the type radio is **disabled** on edit. Changing an event from walk to expedition mid-life is a data model nightmare (different required fields, different child rows); not allowed. To "convert," delete and recreate.

**ExpeditionDay update strategy:** each day row in the form is initialized with a `clientId` (`crypto.randomUUID()`, generated on row creation and persisted in React form state). The `clientId` is included in every submission payload. The server currently uses delete-and-recreate (ignores `clientId`). When `ExpeditionDay` gains a DB `clientId` column in a future migration, the server action switches to upsert-by-`clientId` with no form changes needed — this is why the field is introduced in the form now.

### Server actions for events

In `app/admin/events/_actions.ts` (or distributed across files, your call):

- `createEvent(input)` — validates, generates slug (with collision suffix), creates `Event` + `ExpeditionDay[]` + guide links, returns id. Optional `publish: boolean` flag.
- `updateEvent(id, input)` — validates, updates content, never touches slug.
- `publishEvent(id)` — DRAFT → ACTIVE. Sets `publishedAt = now()` and `publishedBy = currentUserId` on first publish. Throws "Событие уже опубликовано" if current status is not DRAFT — this message surfaces correctly when two admins publish the same event simultaneously.
- `cancelEvent(id)` — ACTIVE → CANCELLED.
- `restoreEvent(id, newStartsAt?: DateTime)` — CANCELLED → DRAFT. If the event's `startsAt >= now()`, the action is called with no `newStartsAt` and is single-click. If `startsAt < now()`, the UI collects a new date via modal before calling the action; `newStartsAt` is required in this case and the action updates `Event.startsAt`. Does not touch `publishedAt`/`publishedBy`. Success toast: "Восстановлено".
- `deleteEvent(id)` — checks ticket count AND active cart items (`CartItem` rows where `reservedUntil > now()`). If ticket count > 0, throws "Нельзя удалить событие с проданными билетами." If active cart items exist, queries `MAX(reservedUntil)` and throws "Нельзя удалить событие: есть активные бронирования до [HH:MM]. Попробуйте позже." If both are 0, sets `status = DELETED`. The UI delete button is disabled (with tooltip) when ticket count > 0; the cart item check is server-side only and surfaces as an error toast.

All actions check `isAdmin(currentUser.role)` and throw if not. Use Auth.js `auth()` to get the current user.

### Counting tickets

`Ticket.count({ where: { eventId } })`. Use this for both the list column and the delete-button check. The list page does this in a single grouped query to avoid N+1.

---

## Team section

`/admin/team` and `/admin/team/[id]`, `/admin/team/new`.

### List page

Simple table:
- Photo (small thumbnail rendered from `photoUrl`)
- Name
- Sort order
- Actions: Edit, Delete

Ordered by `sortOrder` ASC. No pagination — team is small. No search. The list query includes `_count: { select: { events: true } }` for each member so the Delete button tooltip can show the correct N without an extra round-trip.

### Create / edit form

Fields:
- Name (required, max 50) — matches `MAX_NAME` and `TeamMember.name VarChar(50)`
- Photo URL (required)
- Education (optional, max 1000) — app-level Zod cap via `MAX_DESCRIPTION`; schema is unbounded `@db.Text`
- Achievements (optional, max 1000) — app-level Zod cap via `MAX_DESCRIPTION`; schema is unbounded `@db.Text`
- Profile links — list of URL inputs (add/remove rows); validated as URLs.
- Sort order (required integer ≥ 0)

**Sort order conflict handling:** if the admin assigns a number already in use, allow it — duplicates are fine, just order ties resolve by `id`. Do NOT auto-renumber. The team page just sorts and shows.

### Delete

Hard delete is allowed for `TeamMember` (they're content, not financial records). But: **block deletion if the member is linked to any Event as a guide.** Disabled button with tooltip: "Этот участник назначен гидом на N событий. Сначала снимите его с событий."

### Server actions

`createTeamMember`, `updateTeamMember`, `deleteTeamMember`. Standard validation + role check.

---

## Requests section

`/admin/requests`.

### List page

Table:
- Type badge (Private Walk / Expedition)
- Linked event (for EXPEDITION type) — clickable to event edit. If the event is CANCELLED, show the title with a "Отменено" badge and keep the link active. 
- Name (`Request.name`, single field, max 100)
- Email (clickable mailto link)
- Message (truncated to ~100 chars in the cell; clicking anywhere on the row opens a read-only detail modal showing: submitter name, email, full message text, request type, linked event if any, status, and created-at timestamp)
- Status badge (New / Waitlist)
- Created at
- Actions: Change status, Mark contacted (see below)

**Filters:** Type (all/private/expedition), Status (all/new/waitlist), date range optional. The `eventId` query param pre-selects the expedition filter and hides the type dropdown — used when navigating from the event edit page's "Заявки на это событие" link.

**Pagination:** 20/page, ordered by `createdAt` DESC.

**No create page.** Requests are submitted only by the public form (separate feature). Admin only views and updates status.

### Status changes

Allowed transitions, both directions:
- NEW ↔ WAITLIST

These are admin judgment calls (e.g., spots freed up → move a waitlist entry to NEW for follow-up). The status enum could grow later (CONTACTED, etc.) but is out of scope.

Status change is a single-click action in the row's dropdown, with a confirmation toast.

### Server actions

`updateRequestStatus(id, newStatus)`. Role check.

### Optional but recommended: "open in mailto"

The email column renders as `<a href="mailto:...">`. Saves the admin one click for replies. No further integration.

---

## Users section (SUPERADMIN only)

`/admin/users`.

### List page

Table:
- Name
- Email
- Role badge (User / Admin / Superadmin)
- Created at
- Soft-deleted indicator (small "Deleted" badge if `deletedAt` is set)
- Blocked indicator (small "Заблокирован" badge if `blockedAt` is set)
- Actions dropdown: Change role, Block / Unblock, View history

**Filters:** Role (all/user/admin/superadmin), show-deleted toggle (default off), show-blocked toggle (default off — blocked users are hidden by default).

**Title search** by email or name. Note: `User.name` is `VarChar(50)` in the schema (`MAX_NAME = 50`). The auth spec incorrectly states max 100 — the schema wins. Names longer than 50 chars cannot exist in the DB, so this does not affect the admin list display, but the auth spec should be corrected separately.

**Pagination:** 20/page.

### Change role action

Click "Change role" → modal with the new role selector + a confirm button. On confirm:
- Validate: the change is permitted (rules below).
- Write the new `User.role` AND a `RoleChangeLog` row in a single transaction.
- Toast confirmation.

**Validation rules** (enforced server-side, surfaced in the UI):

- The current user cannot change their own role. (Self-demotion edge case → button disabled on the row that is themselves.)
- Cannot demote the **last remaining SUPERADMIN**. Check the count before the update: if changing this user from SUPERADMIN to anything else would leave 0 SUPERADMINs, reject.
- Soft-deleted users (`deletedAt` set) cannot have their role changed — they're archived. Button disabled for those rows.

### Block / Unblock action

Click "Block" → confirmation modal: "Заблокировать пользователя [name]? Он не сможет войти в систему." On confirm, sets `User.blockedAt = now()`.

Click "Unblock" → no confirmation needed (it's a restore action); clears `User.blockedAt = null`. Toast: "Блокировка снята."

**Validation rules:**
- SUPERADMIN cannot block themselves — "Block" button is disabled on their own row.
- Blocking a SUPERADMIN is allowed (e.g., a compromised account). However, blocking the **last remaining SUPERADMIN** is rejected with an error, same invariant as role demotion.
- Soft-deleted users (`deletedAt` set) can also be blocked, but it rarely matters since they can't log in via soft-delete already — allow it without restriction.
- No role-change log entry is written for block/unblock. It is a separate operation from role management.

### View history action

Opens a modal showing the `RoleChangeLog` rows for that target user, newest first. Just a read-only list: "On [date], [changedBy] changed role from X to Y." Empty state: "Изменений роли пока не было."

### Server actions

- `changeUserRole(targetUserId, newRole)` — superadmin check, validation rules above, transactional write of `User` + `RoleChangeLog`.
- `blockUser(targetUserId)` — superadmin check, not-self check, last-superadmin check, sets `blockedAt = now()`.
- `unblockUser(targetUserId)` — superadmin check, clears `blockedAt = null`.

---

## Toasts and feedback

Use shadcn `Toast`. Every Server Action either succeeds with a short success toast or surfaces a clear error toast. Success messages by action: "Сохранено" (save), "Опубликовано" (publish), "Отменено" (cancel), "Восстановлено" (restore — single-click, no modal), "Удалено" (delete), "Роль изменена" (role change), "Заблокировано" / "Блокировка снята" (block/unblock). Validation errors render inline on the form fields, not in toasts.

Confirmation modals (shadcn `Dialog`) on these destructive or significant actions:
- Delete event (when allowed)
- Cancel event
- Delete team member (when allowed)
- Change user role
- Block user
- Restore event when `startsAt` is in the past (modal collects the new date — not a confirmation, but a required input before action)

No confirmation needed for: save, publish, restore (when `startsAt >= now()`), edit.

---

## Validation and constants

All Zod schemas live in `lib/validation/admin.ts` (or split by entity if it grows: `events.ts`, `team.ts`, etc.). They reuse the constants from `lib/constants.ts` (string lengths, etc.) as defined in the schema spec's **Field constraints** section.

Add the following to the **existing** `lib/constants.ts` — do not create a separate file:
- `MAX_GALLERY_IMAGES = 30` (a sanity cap on `galleryUrls` length)
- `MAX_PROFILE_LINKS = 10`
- `MAX_EXPEDITION_DAYS = 30`
- `MAX_GUIDES_PER_EVENT = 10`
- `MAX_REQUEST_NAME = 100` — matches `Request.name VarChar(100)`

These prevent runaway input without being restrictive. Tweak if needed.

---

## What is OUT OF SCOPE (explicitly)

- **Image upload.** URL fields only. S3 wiring is a separate later feature.
- **Drag-and-drop reordering** of team members or expedition days. Edit `sortOrder` / `dayNumber` manually.
- **Bulk actions** (multi-select, delete-many). Single-row actions only.
- **Event preview for drafts.** Draft is editable data only until public pages exist.
- **Changing an event's type** (walk ↔ expedition). Delete and recreate.
- **Slug editing on existing events.** Frozen per schema spec; a separate "rename slug" tool is for later.
- **Public-facing pages** (homepage, walks list, event detail, team page, etc.). Those are design-dependent.
- **Activity log for non-role changes.** Only role changes are audited in this scope. A general "who edited what" log is a separate, larger feature.
- **Email notifications to admins** when new requests arrive. Manual checking of `/admin/requests` for now; notifications are a separate feature with SMTP.
- **Password change for users by superadmin.** Out of scope; users reset their own password via the auth flow.
- **Account deletion by admin.** Users delete their own accounts (when that feature exists).
- **Bootstrap UI for the very first SUPERADMIN.** Created by manual DB edit or a seed step; no chicken-and-egg UI.

---

## Build steps

1. Add `SUPERADMIN` to the `Role` enum; generate migration `pnpm prisma migrate dev --name role-superadmin`.
2. Add `RoleChangeLog` model; migration `pnpm prisma migrate dev --name role-change-log`.
3. Add `RequestStatus` enum and `Request.status` field; migration `pnpm prisma migrate dev --name request-status`.
4. Add `blockedAt` to `User`; migration `pnpm prisma migrate dev --name user-blocked-at`.
5. Install shadcn/ui if not yet installed: `pnpm dlx shadcn@latest init`, then add components used (see deliverables).
6. Write `lib/auth/permissions.ts` and update `middleware.ts` per the rules above.
7. Build the admin shell (`app/admin/layout.tsx`) with the sidebar.
8. Build the Events section: list, create, edit, and the Server Actions. This is the largest chunk; do it first because it exercises the most patterns (per-type fields, status transitions, ticket check, nested days, multi-select guides).
9. Build the Team section. Patterns established in step 8 carry over.
10. Build the Requests section. Mostly list + status toggle.
11. Build the Users section (SUPERADMIN only), including the role-change modal, block/unblock actions, and history view.
12. Manually promote yourself to SUPERADMIN via SQL: `UPDATE "User" SET role = 'SUPERADMIN' WHERE email = '...';`. This is the bootstrap step.
13. Verify the full flow (see "definition of done").

## Notes for the implementer

- **Server Actions over API routes** for admin mutations — they're naturally form-submitting actions, and Server Actions give simpler code with built-in CSRF protection and form integration. Use Auth.js's server-side `auth()` to get the current user; throw on auth failure.
- **`auth()` in Server Components and Server Actions** is the canonical session check. Don't re-implement role checks against cookies directly.
- **Form library:** use `react-hook-form` with the shadcn `Form` wrapper and `@hookform/resolvers/zod`. This is shadcn's standard form pattern.
- **The events list query is the most likely place for N+1.** Use `Prisma.include` for the joined data you display in the table (e.g. ticket count via a `_count` aggregate; status is already on the row). Run `EXPLAIN ANALYZE` on the query once if you're nervous; for 20 rows per page with reasonable totals, it'll be fine.
- **Translations:** UI text is in Russian. Code, identifiers, log messages — English. Don't introduce an i18n library for the admin — there's only one language.
- **No tests required in this spec.** If you write any, they're a bonus. Manual verification per "definition of done" is the bar.
- **If a detail is unspecified** — pick a reasonable default and leave a `// NOTE:` comment. Not blocking.
