---
feature: nextjs-admin
---

## Goal

Replace the separate Django admin process with a custom admin interface built entirely inside the existing Next.js app, covering the same management functionality for Walks, Expeditions, Team Members, Requests, and Users — and remove all Django infrastructure from the repository and deployment.

---

## Background

The Django admin was bootstrapped in four incremental branches (`django-setup`, `django-admin-registration`, `django-production-deploy`, `django-admin-crud`) as a temporary admin solution after the original Next.js admin panel was broken by the Walk/Expedition schema split. The Django process runs on the same VPS, connected to the same PostgreSQL database. The Next.js dev proxy in `next.config.ts` forwards `/admin/:path*` to `http://localhost:8000`. The middleware matcher explicitly excludes `/admin` so Next.js never processes those routes.

The result to replace is documented in `context/features/features-history.md` (branches `django-admin-registration` and `django-admin-crud`). The data model and validation schemas required for this feature already exist: `prisma/schema.prisma` (Walk, Expedition, TeamMember, Request, User, RoleChangeLog), `lib/validation/admin.ts` (all Zod schemas), `lib/auth/permissions.ts` (`isAdmin`, `isSuperAdmin`), and `hooks/useAdminAction.ts`.

---

## Scope

### What to remove

| Artefact | Action |
|---|---|
| `django_admin/` directory (on VPS / in repo) | Delete entirely |
| `next.config.ts` `rewrites()` function | Remove — no proxy needed |
| Middleware `matcher` pattern exclusion for `/admin` | Change so Next.js processes `/admin/*` |
| `README.md` Django admin start instructions | Remove |
| `__tests__/next-config.test.ts` — test asserting the Django proxy rewrite | Rewrite to assert no rewrites exist |
| `__tests__/middleware.test.ts` — test asserting `/admin` is excluded | Rewrite to assert `/admin` is protected, not excluded |

### What to build

**Admin shell**
- `app/admin/layout.tsx` + `app/admin/layout.module.css` — persistent sidebar (Прогулки, Экспедиции, Команда, Заявки, Пользователи) with current user name/role badge and logout button. "Пользователи" item renders only for SUPERADMIN.
- `app/admin/page.tsx` — 307 redirect to `/admin/walks`.

**Walks section** — `app/admin/walks/`
- `page.tsx` (list), `new/page.tsx` (create form), `[id]/page.tsx` (edit form), `_actions.ts` (Server Actions).

**Expeditions section** — `app/admin/expeditions/`
- `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `_actions.ts`.

**Team section** — `app/admin/team/`
- `page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `_actions.ts`.

**Requests section** — `app/admin/requests/`
- `page.tsx`, `_actions.ts`.

**Users section** — `app/admin/users/`
- `page.tsx`, `_actions.ts` (SUPERADMIN only).

**Homepage change**
- `app/page.tsx` — update the "Админка" `<a>` `href` from `/admin/` to `/admin/walks`.

---

## Permissions model

| Role | Can access | Restricted from |
|---|---|---|
| Unauthenticated | — | All `/admin/*` (redirect to `/login?returnUrl=...`) |
| USER | — | All `/admin/*` (redirect to `/`) |
| ADMIN | All `/admin/*` except `/admin/users` | `/admin/users` (redirect to `/admin/walks?error=superadmin_required`) |
| SUPERADMIN | All `/admin/*` | — |

All Server Actions re-check the session role independently of middleware (defence-in-depth). Any action that requires ADMIN throws `"Недостаточно прав"` if the caller is USER. Any action that requires SUPERADMIN throws `"Недостаточно прав"` if the caller is ADMIN or USER.

Use the existing `isAdmin(role)` and `isSuperAdmin(role)` helpers from `lib/auth/permissions.ts`.

**Middleware change**: remove `admin` from the negative lookahead in `config.matcher`. Add role-gate logic inside the `auth()` callback for `/admin/*`:
- No session → redirect to `/login?returnUrl=<pathname>`.
- Session with `role = 'USER'` → redirect to `/`.
- Session with `role = 'ADMIN'` and `pathname.startsWith('/admin/users')` → redirect to `/admin/walks?error=superadmin_required`.
- Otherwise pass through.

---

## Data model / API

Two additive schema migrations required. All other models are already correct.

### Schema additions

**Walk** — add one field:
```prisma
galleryUrl String? @db.VarChar(2048)
```

**Expedition** — add one field:
```prisma
galleryUrls String[]
```

`birdSpecies` does not exist in the schema and will not be added. `Walk.duration` already exists (`String? @db.VarChar(100)`) — no change needed.

Run `prisma migrate dev --name add-gallery-urls` after updating `schema.prisma`.

### Server Actions pattern

All mutations are Next.js Server Actions (`'use server'`). Each action:
1. Calls `auth()` from `@/lib/auth` and checks role with `isAdmin` / `isSuperAdmin`.
2. Validates input with the relevant Zod schema from `lib/validation/admin.ts`.
3. Executes the Prisma operation.
4. Throws a descriptive Russian-language `Error` on any failure (caught by `useAdminAction` on the client).
5. Returns `void` on success.

### Walks actions (`app/admin/walks/_actions.ts`)

| Action | Input | Prisma operation | Notes |
|---|---|---|---|
| `createWalk(input)` | `CreateEventInput` (type=WALK) | `prisma.walk.create` | Auto-UUID id, auto-slug (title → slugify + 4-char hex suffix on collision), `createdAt = now()`. Returns created walk `id`. |
| `updateWalk(id, input)` | `UpdateEventInput` (type=WALK) | `prisma.walk.update` | Never touches `slug`. |
| `publishWalk(id)` | `string` id | Status DRAFT → ACTIVE | Sets `publishedAt = now()`, `publishedBy = currentUserId` on first publish. Throws `"Прогулка уже опубликована"` if status ≠ DRAFT. |
| `cancelWalk(id)` | `string` id | Status ACTIVE → CANCELLED | Throws if status ≠ ACTIVE. |
| `restoreWalk(id, newStartsAt?)` | id + optional datetime string | Status CANCELLED → DRAFT | If `startsAt < now()` and no `newStartsAt` provided, throws. Sets `startsAt` to `newStartsAt` when provided. |
| `deleteWalk(id)` | `string` id | Status → DELETED | Checks `Ticket` count and active `CartItem` count first (see rules below). |

**Delete guards**:
- If `Ticket` count > 0 → throw `"Нельзя удалить прогулку с проданными билетами."`.
- If active `CartItem` count > 0 (where `reservedUntil > now()`) → query `MAX(reservedUntil)`, throw `"Нельзя удалить прогулку: есть активные бронирования до [HH:MM]. Попробуйте позже."`.
- Both checks in the same action before the status update.

### Expeditions actions (`app/admin/expeditions/_actions.ts`)

| Action | Input | Notes |
|---|---|---|
| `createExpedition(input)` | `CreateEventInput` (type=EXPEDITION) | Auto-UUID, auto-slug, creates `ExpeditionDay[]` rows, links guides via M2M. `spotsLeft` initialised to `totalSpots` on create. Returns created expedition `id`. |
| `updateExpedition(id, input)` | `UpdateEventInput` (type=EXPEDITION) | Never touches `slug`. Updates expedition fields, replaces `ExpeditionDay` rows (delete-all, re-insert), updates M2M guides. |
| `publishExpedition(id)` | id | DRAFT → ACTIVE. Sets `publishedAt`/`publishedBy` on first publish. |
| `cancelExpedition(id)` | id | ACTIVE → CANCELLED. |
| `restoreExpedition(id, newStartsAt?)` | id + optional datetime | CANCELLED → DRAFT. Requires new date if `startsAt < now()`. |
| `deleteExpedition(id)` | id | Checks `Request` count (none required — expeditions have requests not tickets). Blocks if any linked `Request` rows exist: throw `"Нельзя удалить экспедицию с заявками."`. Otherwise DELETED. |

### Team actions (`app/admin/team/_actions.ts`)

| Action | Notes |
|---|---|
| `createTeamMember(input)` | `TeamMemberInput`. Auto-increment id (Prisma default). |
| `updateTeamMember(id, input)` | `TeamMemberInput`. |
| `deleteTeamMember(id)` | Hard delete. Check linked walks + expeditions count first. If > 0: throw `"Этот участник назначен гидом на N событий. Сначала снимите его с событий."`. |

### Requests actions (`app/admin/requests/_actions.ts`)

| Action | Notes |
|---|---|
| `updateRequestStatus(id, status)` | `UpdateRequestStatusInput`. Any ADMIN or SUPERADMIN. NEW ↔ WAITLIST. |

### Users actions (`app/admin/users/_actions.ts`)

| Action | Notes |
|---|---|
| `changeUserRole(targetUserId, newRole)` | SUPERADMIN only. Validates: not self, not demoting last SUPERADMIN (count check), not changing soft-deleted user. Transactionally writes `User.role` + `RoleChangeLog` row. |
| `blockUser(targetUserId)` | SUPERADMIN only. Not self. Not if blocking would leave 0 non-blocked SUPERADMINs. Sets `User.blockedAt = now()`. |
| `unblockUser(targetUserId)` | SUPERADMIN only. Clears `User.blockedAt = null`. |

---

## UI pages

### Admin shell layout (`app/admin/layout.tsx`)

- Top bar: site name, current user name, role badge (USER / ADMIN / SUPERADMIN), logout button.
- Left sidebar nav items in order: Прогулки → `/admin/walks`, Экспедиции → `/admin/expeditions`, Команда → `/admin/team`, Заявки → `/admin/requests`, Пользователи → `/admin/users` (visible only if `isSuperAdmin(session.user.role)`).
- Active nav item highlighted by current `pathname`.
- `app/admin/page.tsx` does `redirect('/admin/walks')`.
- Layout reads session via `auth()`. If no session or role = USER, middleware handles redirect before layout renders.

### Walks list (`/admin/walks`)

Table columns: Title (link → edit page), Guide name, Starts at, Status badge (DRAFT / ACTIVE / CANCELLED), Price (displayed in rubles — divide `priceKopecks` by 100), Tickets sold, Actions.

Actions per row (dropdown or inline buttons):
- Always: Edit (link to `/admin/walks/[id]`)
- If DRAFT: Опубликовать (confirm modal → `publishWalk`)
- If ACTIVE: Отменить (confirm modal → `cancelWalk`)
- If CANCELLED and `startsAt >= now()`: Восстановить (single click → `restoreWalk`)
- If CANCELLED and `startsAt < now()`: Восстановить (opens modal collecting new datetime → `restoreWalk(id, newStartsAt)`)
- If DRAFT or CANCELLED, and 0 tickets: Удалить (confirm modal → `deleteWalk`)
- If DRAFT or CANCELLED, and ≥ 1 ticket: Удалить button disabled, tooltip "Нельзя удалить прогулку с проданными билетами."

Filters: Status dropdown (All / DRAFT / ACTIVE / CANCELLED; DELETED never shown), title search input (URL query param, server-side filter). Default: All statuses, no search.

Pagination: 20 rows/page, ordered by `createdAt` DESC.

"Новая прогулка" button → `/admin/walks/new`.

Query: `prisma.walk.findMany({ include: { guide: { select: { name: true } }, _count: { select: { tickets: true } } }, where: { status: { not: 'DELETED' } }, ... })`.

### Walk create form (`/admin/walks/new`)

Fields (all using existing project conventions — `FormField`, `Button`, plain CSS Modules; no shadcn):
- Title (required, max 150, `MAX_EVENT_TITLE`)
- Slug (auto-filled from title as user types; editable on create; read-only on edit; preview shown as `/walks/<slug>`)
- Description (textarea, max 1000, `MAX_DESCRIPTION`)
- Starts at (datetime-local input, required)
- Duration (optional, max 100)
- Location (required, max 100, `MAX_EVENT_LOCATION`)
- Price in rubles (required, ≥ 0; form stores as float, action converts to kopecks: `Math.round(rubles * 100)`)
- Capacity (required, int ≥ 1)
- Guide (required; `<select>` populated from all `TeamMember` rows ordered by `sortOrder`)
- Cover photo URL (required, URL format, max 2048)
- Gallery URL (optional, URL format, max 2048; single input)

Buttons: "Сохранить как черновик" (calls `createWalk`, status = DRAFT, redirects to `/admin/walks/[id]`), "Сохранить и опубликовать" (calls `createWalk` then `publishWalk`, redirects to `/admin/walks/[id]`).

Client-side validation via `react-hook-form` + Zod resolver using `createWalkSchema` from `lib/validation/admin.ts`. Per-field inline errors. Success toast via `sonner`.

### Walk edit form (`/admin/walks/[id]`)

Same fields as create, except:
- Slug field is `readOnly`, with hint text "URL зафиксирован."
- Guide preselected.
- Action buttons depend on current status (same rules as list page actions).

### Expeditions list (`/admin/expeditions`)

Table columns: Title (link), Starts at, Ends at, Location, Status badge, Total spots, Spots left, Actions.

Actions: same lifecycle pattern as walks (Опубликовать / Отменить / Восстановить / Удалить). Delete blocked if any `Request` rows exist (tooltip "Нельзя удалить экспедицию с заявками.").

Pagination: 20 rows/page, ordered by `createdAt` DESC. Status filter and title search (same as walks).

"Новая экспедиция" → `/admin/expeditions/new`.

Each row has a "Заявки (N)" link showing `Request` count; clicking navigates to `/admin/requests?expeditionId=[id]`.

### Expedition create/edit form (`/admin/expeditions/new` and `/admin/expeditions/[id]`)

Fields:
- Title, slug (same rules as walks), description, starts at, ends at (optional), location, cover photo URL.
- Total spots (required, int ≥ 1), spots left (required, int ≥ 0; soft warning if > total spots).
- Guides (multi-select; `<select multiple>` or equivalent from all `TeamMember` rows; at least 1 required; max `MAX_GUIDES_PER_EVENT = 5`).
- Gallery URLs (repeatable URL inputs; add/remove rows; each URL validated; max 5 URLs; 0 is valid).
- Expedition days (repeatable rows; each row: day number int, title max 150, description max 1000; at least 1 required; add/remove row buttons). Each row tracked with a `clientId` (`crypto.randomUUID()` generated on row creation).

On edit: slug read-only, type not switchable.

### Team list (`/admin/team`)

Table columns: Photo (thumbnail from `photoUrl`), Name, Sort order, Linked events count (walks + expeditions combined), Actions.

Actions: Edit (link), Delete (disabled with tooltip "Назначен гидом на N событий" if count > 0).

Ordered by `sortOrder` ASC. No pagination (team is small). "Новый участник" → `/admin/team/new`.

### Team create/edit form

Fields: Name (required, max 50), Photo URL (required), Education (optional, max 1000), Achievements (optional, max 1000), Profile links (list of URL inputs; add/remove rows; each URL validated; max `MAX_PROFILE_LINKS = 1` per existing constant), Sort order (required, int ≥ 0).

### Requests list (`/admin/requests`)

Table columns: Type badge (PRIVATE_WALK / EXPEDITION), Linked expedition (name + link if EXPEDITION type), Name, Email (`<a href="mailto:...">` link), Message (truncated to 100 chars; click row → read-only detail modal), Status badge (NEW / WAITLIST), Created at, Actions.

Detail modal (triggered by row click): full message, type, expedition link, status, created at. Read-only.

Actions per row: Change status button — toggles NEW ↔ WAITLIST via `updateRequestStatus`.

Filters (URL query params, server-side): Type (all / PRIVATE_WALK / EXPEDITION), Status (all / NEW / WAITLIST), `expeditionId` (pre-filters to one expedition; when set, type dropdown is hidden). Default: all.

Pagination: 20 rows/page, ordered by `createdAt` DESC.

No create or delete in admin.

### Users list (`/admin/users`) — SUPERADMIN only

Guard: server component reads session; if not SUPERADMIN, redirect to `/admin/walks?error=superadmin_required`. The `/admin/walks` list page reads the `error` query param and shows a toast "Раздел доступен только для SUPERADMIN." on mount.

Table columns: Name, Email, Role badge, Created at, Soft-deleted badge (if `deletedAt` set), Blocked badge (if `blockedAt` set), Actions.

Actions per row (dropdown):
- Change role (opens modal with role selector + confirm; disabled for soft-deleted users and for the current user's own row)
- Block (opens confirm modal; disabled if user is self, or if blocking would leave 0 non-blocked SUPERADMINs)
- Unblock (single click, no confirm; only shown if `blockedAt` is set)
- View role history (opens read-only modal listing `RoleChangeLog` rows for this user, newest first)

Filters: Role (all / USER / ADMIN / SUPERADMIN), Show deleted (toggle, default off), Show blocked (toggle, default off).

Search: by name or email (server-side `contains`, case-insensitive).

Pagination: 20 rows/page.

---

## Success criteria

### Infrastructure removal

- [ ] `next.config.ts` exports a config with no `rewrites` function (or a `rewrites` function that always returns `[]`). `pnpm test:run` passes `__tests__/next-config.test.ts` with updated assertions.
- [ ] `middleware.ts` matcher pattern no longer excludes `/admin`. `pnpm test:run` passes `__tests__/middleware.test.ts` with updated assertions.
- [ ] `README.md` contains no reference to `django_admin`, `python manage.py`, or port 8000.

### Middleware access control

- [ ] A `GET /admin/walks` request with no session is redirected to `/login?returnUrl=/admin/walks` (tested in `__tests__/middleware.test.ts`).
- [ ] A `GET /admin/walks` request with `role = 'USER'` is redirected to `/` (tested in middleware tests).
- [ ] A `GET /admin/users` request with `role = 'ADMIN'` is redirected to `/admin/walks?error=superadmin_required` (tested in middleware tests).
- [ ] A `GET /admin/walks` request with `role = 'ADMIN'` passes through (status not a redirect, tested in middleware tests).
- [ ] A `GET /admin/users` request with `role = 'SUPERADMIN'` passes through (tested in middleware tests).

### Homepage link

- [ ] When `app/page.tsx` renders with `role = 'ADMIN'`, the rendered HTML contains `<a href="/admin/walks">Админка</a>` (not `/admin/`). Tested in `__tests__/app/page.test.tsx`.
- [ ] When rendered with `role = 'USER'` or `session = null`, no element with `href="/admin/walks"` is present.

### Server actions — permissions

- [ ] Calling `createWalk` or `updateWalk` as an unauthenticated user (mocked `auth()` returns null) throws an error with message containing "Недостаточно прав" (tested in `__tests__/admin/walks-actions.test.ts`).
- [ ] Calling `changeUserRole` as `role = 'ADMIN'` throws an error with message containing "Недостаточно прав" (tested in `__tests__/admin/users-actions.test.ts`).

### Server actions — Walk lifecycle

- [ ] `publishWalk` called on a WALK with `status = 'ACTIVE'` throws `"Прогулка уже опубликована"` (tested with mocked Prisma).
- [ ] `deleteWalk` called on a WALK where mocked `prisma.ticket.count` returns 1 throws an error containing "проданными билетами" (tested with mocked Prisma).
- [ ] `deleteWalk` called on a WALK where ticket count = 0 and active cart item count = 0 calls `prisma.walk.update` with `{ status: 'DELETED' }` (tested with mocked Prisma).
- [ ] `restoreWalk` called with `startsAt` in the past and no `newStartsAt` argument throws (tested with mocked Prisma).

### Server actions — Team

- [ ] `deleteTeamMember` called when combined walk + expedition guide count > 0 throws an error containing "гидом на" (tested with mocked Prisma).

### Server actions — Users

- [ ] `changeUserRole` called with `targetUserId = currentUserId` (self) throws (tested with mocked Prisma).
- [ ] `changeUserRole` that would demote the last SUPERADMIN throws (tested with mocked Prisma — mock count returns 1).
- [ ] A transactional write to `User` and `RoleChangeLog` is called in a single `prisma.$transaction` when role change is valid (verified by spying on `prisma.$transaction`).
- [ ] `blockUser` called when it would leave 0 non-blocked SUPERADMINs throws (tested with mocked Prisma).

### Admin layout — unit

- [ ] `AdminLayout` renders the "Пользователи" nav item when `session.user.role = 'SUPERADMIN'` and does not render it when `role = 'ADMIN'` (tested in `__tests__/admin/layout.test.tsx` with mocked `auth()`).

### Slug generation

- [ ] `ensureUniqueSlug` (or equivalent utility) returns the base slug if no collision exists; returns the slug with a 4-char hex suffix on collision; retries up to a reasonable limit (tested in `__tests__/admin/slug.test.ts` with mocked Prisma `findFirst`).

### Schema migrations

- [ ] `prisma/schema.prisma` contains `galleryUrl String? @db.VarChar(2048)` on `Walk`.
- [ ] `prisma/schema.prisma` contains `galleryUrls String[]` on `Expedition`.
- [ ] A migration file exists in `prisma/migrations/` for the above additions.
- [ ] `pnpm build` does not error on Prisma client usage of `galleryUrl` / `galleryUrls`.

### Gallery fields — server actions

- [ ] `createWalk` and `updateWalk` accept an optional `galleryUrl` string and persist it (tested with mocked Prisma).
- [ ] `createExpedition` and `updateExpedition` accept a `galleryUrls` array, reject arrays longer than 5 items with an error containing "не более 5" (tested with mocked Prisma).

### `pnpm test:run` passes with zero failures

- [ ] `pnpm test:run` exits 0 across all test files after implementation.

### `pnpm build` passes

- [ ] `pnpm build` exits 0 with zero TypeScript errors.

---

## Edge cases

- **Slug collision on create**: auto-append a random 4-char lowercase hex suffix (e.g., `my-walk-3f9a`). Retry up to 5 times; throw if all attempts collide (extremely unlikely in practice). Show the final slug in the success toast.
- **Expedition `spotsLeft > totalSpots`**: show a yellow inline warning on the form ("Доступных мест больше, чем всего мест") but do not block save. Admin manages these numbers by hand.
- **Restoring a cancelled walk/expedition with past `startsAt`**: require a new datetime via a modal before calling the action. The server action validates that `newStartsAt` is in the future (≥ now()); throw if not.
- **Deleting a team member with sortOrder ties**: not a problem — duplicate `sortOrder` values are allowed; queries just order by `id` as a tiebreaker.
- **Change role for a soft-deleted user**: disabled button in the UI; the server action also validates `deletedAt === null` and throws if the target is soft-deleted.
- **Blocking the last non-blocked SUPERADMIN**: blocked separately from role demotion. Count non-blocked SUPERADMINs (`role = 'SUPERADMIN' AND blockedAt IS NULL`) before setting `blockedAt`.
- **ADMIN hitting `/admin/users` directly**: middleware redirects before the page renders. The users page server component also checks `isSuperAdmin(session.user.role)` and redirects as a second layer.
- **Expedition delete with requests**: expedition delete is blocked by the server action if any linked `Request` rows exist, regardless of their status. The UI disables the Delete button and shows a tooltip.
- **Walk delete while active cart reservations exist**: the Delete button in the UI is only disabled for ticket count > 0. The cart-reservation check is server-side only, surfacing as an error toast.
- **`app/page.tsx` — `auth()` call**: the page is already an async Server Component per the `admin-navigation-button` feature. Only the `href` target changes (`/admin/` → `/admin/walks`).

---

## Error cases

- **Server Action throws unknown error**: `useAdminAction` catches and calls `toast.error('Ошибка')` as fallback.
- **`auth()` returns null in a Server Action** (session expired mid-action): action throws `"Недостаточно прав"` — same path as an unauthenticated call.
- **Prisma query fails** (DB down): error propagates; Next.js returns 500. No special handling required.
- **Slug taken after 5 retries**: extremely unlikely; action throws `"Не удалось сгенерировать уникальный slug. Попробуйте ещё раз."`.
- **Updating an expedition whose `guideIds` list contains an id that no longer exists**: Prisma FK constraint fails; action surfaces as error toast.

---

## Out of scope

- Image upload to S3. All `photoUrl` / `coverPhotoUrl` / `galleryUrl` / `galleryUrls` fields remain text URL inputs.
- Drag-and-drop reordering of expedition days or team members. `sortOrder` / `dayNumber` edited manually.
- Bulk actions (multi-select, batch delete/publish). Single-row actions only.
- Event type switching (walk ↔ expedition). Delete and recreate.
- Slug editing on existing events. Frozen per schema spec.
- General activity log (non-role changes). Only role changes are audited via `RoleChangeLog`.
- Email notifications to admins when new requests arrive.
- Password change or account deletion by admin.
- nginx or VPS configuration changes (handled by ops separately).
- `birdSpecies` — will not be added to the schema.
- Any public-facing pages.

---

## Technical notes

**Files to remove or gut**
- `next.config.ts` — remove `rewrites()` entirely (or return `[]` unconditionally; either is fine).
- `middleware.ts` — remove `admin` from the matcher negative lookahead; add admin route guards in the handler body.
- `README.md` — remove the "Start the Django admin" block.
- `__tests__/next-config.test.ts` — rewrite to assert no proxy rewrite.
- `__tests__/middleware.test.ts` — rewrite to assert admin route protection.

**Files to create**
```
app/admin/layout.tsx
app/admin/layout.module.css
app/admin/page.tsx
app/admin/walks/page.tsx
app/admin/walks/new/page.tsx
app/admin/walks/[id]/page.tsx
app/admin/walks/_actions.ts
app/admin/expeditions/page.tsx
app/admin/expeditions/new/page.tsx
app/admin/expeditions/[id]/page.tsx
app/admin/expeditions/_actions.ts
app/admin/team/page.tsx
app/admin/team/new/page.tsx
app/admin/team/[id]/page.tsx
app/admin/team/_actions.ts
app/admin/requests/page.tsx
app/admin/requests/_actions.ts
app/admin/users/page.tsx
app/admin/users/_actions.ts
__tests__/admin/layout.test.tsx
__tests__/admin/walks-actions.test.ts
__tests__/admin/expeditions-actions.test.ts
__tests__/admin/team-actions.test.ts
__tests__/admin/users-actions.test.ts
__tests__/admin/slug.test.ts
```

**Reused without changes**
- `lib/validation/admin.ts` — all Zod schemas already adapted to Walk/Expedition split.
- `lib/auth/permissions.ts` — `isAdmin`, `isSuperAdmin`.
- `hooks/useAdminAction.ts` — shared Server Action invocation hook.
- `lib/constants.ts` — all field-length constants.
- `components/ui/` — use the existing custom component library (Badge, Button, Modal, FormField, Spinner, Alert) for the admin UI. No shadcn components required.
- `sonner` — already installed; use `toast.success` / `toast.error` directly in pages that do not go through `useAdminAction`.

**Slug utility**
Extract a shared `ensureUniqueSlug(title, checkExists: (slug: string) => Promise<boolean>): Promise<string>` into `lib/admin/slug.ts`. Slugify title (lowercase, hyphens, strip non-alphanumeric), check for collision, append 4-char hex suffix on collision, retry up to 5 times.

**Middleware runtime**
Keep `runtime: 'nodejs'` — Auth.js here pulls in Prisma and bcrypt. No change.

**Session in Server Actions**
Use `auth()` from `@/lib/auth` (not `getServerSession`). This is already the pattern across the codebase.

**Toasts**
Use `sonner` (`import { toast } from 'sonner'`). Client components call `toast.success` / `toast.error` directly. `useAdminAction` handles this automatically for actions triggered from event handlers. For form submissions via `react-hook-form`, call `toast.success` in the `onSuccess` path and `toast.error` in the `onError` path.

**Form library**
Use `react-hook-form` + `@hookform/resolvers/zod` — both already installed.

**Pagination**
Implement via URL `?page=N` query param (server-side). Default page 1. `prisma.walk.findMany({ skip: (page - 1) * 20, take: 20 })`.

**Dependencies**: no new `npm`/`pnpm` packages required — all needed packages (`react-hook-form`, `@hookform/resolvers`, `zod`, `sonner`, `lucide-react`, `date-fns`) are already in `package.json`.

---

## Decisions (resolved)

- Walk guide: single guide (`guideId Int` FK, single `<select>`). Not M2M.
- `birdSpecies`: will not be added. Not in schema, not in scope.
- Walk gallery: single `galleryUrl String?` field (one URL input, optional).
- Expedition gallery: `galleryUrls String[]`, max 5 URLs (repeatable inputs, 0–5).
- `Walk.duration`: already in schema (`String? @db.VarChar(100)`). No migration needed.
- `MAX_PROFILE_LINKS`: stays at `1` (TeamMember profile links).
- `MAX_GALLERY_IMAGES = 15`, `MAX_GUIDES_PER_EVENT = 5`: correct, no change.
