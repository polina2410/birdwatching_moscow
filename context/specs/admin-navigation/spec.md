# Spec: Admin Navigation

**Goal:** Give ADMIN and SUPERADMIN users a visible shortcut to the admin panel from the public site, split event management into per-type routes, and open the Users section to ADMIN-role users (read-only).

---

## What to build

### 1. "Админка" button on the public site
A shadcn/ui `Button` rendered in `app/page.tsx` (server component) that appears only when `isAdmin(session?.user?.role)` is true. Clicking it navigates to `/admin`. Placement is temporary — a prominent fixed or inline position is acceptable. Not visible to guests or USER-role accounts.

### 2. New sidebar items: "Прогулки" and "Экспедиции"
Add two nav links to the admin sidebar in `app/admin/layout.tsx`:
- "Прогулки" → `/admin/walks`
- "Экспедиции" → `/admin/expeditions`
- "Заявки" → `/admin/request`

These are added alongside the existing "Команда" links.
Remove "События" link.

### 3. New pages: `/admin/walks` and `/admin/expeditions` and `/admin/request`
Two new server-component pages, each behind `requireAdmin()`:
- `app/admin/walks/page.tsx` — queries events with `type: 'WALK'` hardcoded; renders using the existing `EventsTable` component; no type filter UI exposed
- `app/admin/expeditions/page.tsx` — queries events with `type: 'EXPEDITION'` hardcoded; same structure
- `app/admin/request/page.tsx` — requests from the future forms (request for a walk or an expedition)

All the pages support `page`, `status`, and `search` query params (same as the existing events page). The `type` query param is ignored on these routes — the type is always fixed.

### 4. "Пользователи" visible to ADMIN role
- In `app/admin/layout.tsx`: change the "Пользователи" link condition from `isSuperAdmin(role)` to `isAdmin(role)` (always shown to any logged-in admin).
- In `app/admin/users/page.tsx`: change `requireSuperAdmin()` to `requireAdmin()`. Derive `canChangeRole: boolean` from `isSuperAdmin(role)` and pass it to `UsersTable`.
- In `components/admin/UsersTable.tsx`: accept `canChangeRole: boolean`. When `false`, hide only the role-change action from the "•••" dropdown. Block/unblock actions remain visible and functional for all admins.

### 5. Server-side action guard changes
In `app/admin/users/_actions.ts`:
- `blockUser` — change `requireSuperAdmin()` to `requireAdmin()`. Add guard: if `target.role === 'SUPERADMIN'`, throw `'Нельзя заблокировать суперадмина.'` (an ADMIN must not be able to block a higher-privilege user).
- `unblockUser` — change `requireSuperAdmin()` to `requireAdmin()`. Add the same SUPERADMIN target guard.
- `getUserRoleHistory` — change `requireSuperAdmin()` to `requireAdmin()` (read-only, appropriate for all admins).
- `changeUserRole` — no change, keeps `requireSuperAdmin()`.

---

## Success criteria

- [ ] On the public site, a user with role `ADMIN` or `SUPERADMIN` sees an "Админка" button; clicking it navigates to `/admin`
- [ ] On the public site, a user with role `USER` does not see the "Админка" button
- [ ] On the public site, a logged-out user does not see the "Админка" button
- [ ] The admin sidebar contains a "Прогулки" link that navigates to `/admin/walks`
- [ ] The admin sidebar contains an "Экспедиции" link that navigates to `/admin/expeditions`
- [ ] `/admin/walks` renders only events where `type === 'WALK'`; no EXPEDITION-type events appear in the list
- [ ] `/admin/expeditions` renders only events where `type === 'EXPEDITION'`; no WALK-type events appear in the list
- [ ] `/admin/walks` and `/admin/expeditions` and `/admin/request` are accessible to users with role `ADMIN` (do not redirect)
- [ ] `/admin/walks` and `/admin/expeditions` and `/admin/request` redirect to `/` for a USER-role session and for unauthenticated requests
- [ ] The admin sidebar "Пользователи" link is visible to a user with role `ADMIN` (previously hidden)
- [ ] `/admin/users` is accessible (HTTP 200, no redirect) for a session with role `ADMIN`
- [ ] `/admin/request` is accessible (HTTP 200, no redirect) for a session with role `ADMIN`
- [ ] When the current user is `ADMIN`, `UsersTable` renders the full user list with block/unblock actions visible but the role-change action hidden
- [ ] When the current user is `SUPERADMIN`, `UsersTable` renders all actions (block/unblock + role-change) as before
- [ ] The `changeUserRole` server action throws `'Forbidden'` when called by a session with role `ADMIN`
- [ ] The `blockUser` server action succeeds when called by a session with role `ADMIN` targeting a non-SUPERADMIN user
- [ ] The `unblockUser` server action succeeds when called by a session with role `ADMIN` targeting a non-SUPERADMIN user
- [ ] Remove `/admin/events` page
---

## Edge cases

- An `ADMIN`-role user who navigates directly to `/admin/users` via URL (not sidebar link) must be allowed in — the server guard on the page is `requireAdmin()`, not `requireSuperAdmin()`
- An `ADMIN`-role user who calls `changeUserRole` directly (e.g., via `curl` or client-side fetch) must receive a `Forbidden` error — the action-level `requireSuperAdmin()` guard is the enforcement point
- An `ADMIN`-role user who calls `blockUser` or `unblockUser` targeting a `SUPERADMIN` user must receive an error — privilege escalation is blocked at the action level regardless of UI state
- `/admin/walks` and `/admin/expeditions` and `/admin/request` with no matching data in the database must render an empty table (no crash, no 404)
- The "Админка" button on the public site must not render at all in the HTML for non-admin sessions (server-rendered — not just hidden via CSS)
- If both `WALK` and `EXPEDITION` events exist, each filtered page must show only its own type — cross-contamination is a test failure

---

## Error cases

- A USER-role session hitting `/admin/walks`, `/admin/expeditions`, or `/admin/users` and `/admin/request` is redirected to `/` (same behaviour as other protected admin pages)
- An unauthenticated request to any `/admin/*` route is redirected to `/` via the existing `AdminLayout` guard (no change to this behaviour)
- `UsersTable` with `canChangeRole={false}` must not expose any interactive element that could invoke `changeUserRole`

---

## Out of scope

- Removing or reordering existing sidebar links ("Команда") — these stay as-is
- Adding type-specific creation flows on `/admin/walks` or `/admin/expeditions` (e.g., a "Создать прогулку" button pre-filled with type WALK)
- Showing block/unblock actions for SUPERADMIN-role users in the table — those rows' action buttons may be present but will error server-side if an ADMIN attempts to use them
- Making the "Админка" button permanent or styling it as a nav header element — placement is explicitly temporary
- Any change to the `changeUserRole`, `blockUser`, `unblockUser`, or `getUserRoleHistory` server actions

---

## Technical notes

**Files to create:**
- `app/admin/walks/page.tsx`
- `app/admin/expeditions/page.tsx`
- `app/admin/request/page.tsx`

**Files to modify:**
- `app/page.tsx` — add auth check and conditional "Админка" button
- `app/admin/layout.tsx` — add "Прогулки" and "Экспедиции" links; change "Пользователи" guard from `isSuperAdmin` to `isAdmin`
- `app/admin/users/page.tsx` — swap `requireSuperAdmin()` for `requireAdmin()`; derive `canChangeRole` from session role; pass to `UsersTable`
- `app/admin/users/_actions.ts` — change `blockUser`, `unblockUser`, `getUserRoleHistory` guards from `requireSuperAdmin()` to `requireAdmin()`; add SUPERADMIN-target guard in `blockUser` and `unblockUser`
- `components/admin/UsersTable.tsx` — rename `canManageUsers` to `canChangeRole: boolean`; hide only role-change action when false; block/unblock always visible

**Files unchanged:**
- `app/admin/events/page.tsx`
- `lib/auth/permissions.ts`
- `lib/auth/requireAdmin.ts`

**Constraints:**
- All UI components must use shadcn/ui
- `app/page.tsx` is a server component — use `auth()` directly, no client-side session hook
- `EventType` enum values are `WALK` and `EXPEDITION` (confirmed in `app/admin/events/page.tsx`)
- `requireAdmin()` already exists in `lib/auth/requireAdmin.ts` — use it directly

---

## Open questions

1. **Sidebar item count:** The story states "The admin panel sidebar shows three menu items: 'Прогулки', 'Экспедиции', 'Пользователи'". This spec preserves the existing items ("Команда", "Заявки") and adds the new ones. If the intent is to replace the existing sidebar entirely with only the three listed items, the scope of this feature expands significantly (existing team/requests/events-aggregate workflows break). Confirm which interpretation is correct before implementation begins.