# Spec: Django Admin Registration

**Goal:** Register admin classes for all five entities (Walk, Expedition, Request, AppUser, TeamMember) with Russian labels, appropriate list/filter/search configuration, and role-gated actions (block/unblock for all staff; change role for superusers only).

**Depends on:** `django-setup` spec (models and auth backend must exist before admin classes can be registered).

---

## What to build

All admin classes live in `django_admin/birdwatch/admin.py`.

### `WalkAdmin`

```python
@admin.register(Walk)
class WalkAdmin(admin.ModelAdmin):
    list_display  = ['title', 'startsAt', 'status', 'location', 'priceKopecks', 'capacity']
    list_filter   = ['status']
    search_fields = ['title', 'slug', 'location']
    ordering      = ['-startsAt']
```

`priceKopecks` display: add a `price_roubles` computed column (kopecks ÷ 100, formatted as "123 ₽") and use it in `list_display` instead of the raw field.

### `ExpeditionAdmin`

```python
@admin.register(Expedition)
class ExpeditionAdmin(admin.ModelAdmin):
    list_display  = ['title', 'startsAt', 'status', 'totalSpots', 'spotsLeft', 'location']
    list_filter   = ['status']
    search_fields = ['title', 'slug', 'location']
    ordering      = ['-startsAt']
```

### `RequestAdmin`

```python
@admin.register(Request)
class RequestAdmin(admin.ModelAdmin):
    list_display   = ['type', 'name', 'email', 'status', 'createdAt']
    list_filter    = ['type', 'status']
    search_fields  = ['name', 'email']
    readonly_fields = [all fields except 'status']
```

Requests are created by users; admins only update `status`. `has_add_permission` returns `False`.

### `AppUserAdmin`

```python
@admin.register(AppUser)
class AppUserAdmin(admin.ModelAdmin):
    list_display    = ['name', 'email', 'role', 'blockedAt', 'createdAt', 'deletedAt']
    list_filter     = ['role']
    search_fields   = ['name', 'email']
    readonly_fields = ['id', 'email', 'passwordHash', 'name', 'createdAt', 'updatedAt', 'deletedAt']
    actions         = ['block_users', 'unblock_users', 'change_role']
```

- `has_add_permission` returns `False` — app users are created via the app, not Django admin.
- `has_delete_permission` returns `False` — app users are soft-deleted via `deletedAt`, not hard-deleted.

### `TeamMemberAdmin`

```python
@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display  = ['name', 'sortOrder']
    ordering      = ['sortOrder']
    search_fields = ['name']
```

---

## Custom actions

### `block_users` and `unblock_users`

- Available to all Django staff (`is_staff = True`), i.e., both ADMIN and SUPERADMIN.
- `block_users`: sets `blockedAt = now()` on all selected `AppUser` rows.
  - Guard: if the selection includes the last active (non-deleted, non-blocked) SUPERADMIN (`role = 'SUPERADMIN'`), reject with `messages.error` and do not update any rows.
- `unblock_users`: sets `blockedAt = None` on all selected `AppUser` rows.
- Decorated with `@admin.action(description='Заблокировать')` / `@admin.action(description='Разблокировать')`.

### `change_role`

- **Superuser only.** Guard at the top of the action: `if not modeladmin.has_change_role_permission(request): raise PermissionDenied`.
- `has_change_role_permission(request)` returns `request.user.is_superuser`.
- The action renders an intermediate confirmation form (standard Django `intermediate page` pattern) where the superuser selects the new role from `['USER', 'ADMIN', 'SUPERADMIN']`.
- On confirmation:
  1. Resolve the acting user: `changer = AppUser.objects.get(email=request.user.email)`.
  2. For each selected `AppUser`:
     - If `target.id == changer.id`: skip with an error message (cannot change own role).
     - If `target.role == 'SUPERADMIN'` and only one active SUPERADMIN remains: skip with an error message (last SUPERADMIN guard).
     - Otherwise: record `from_role = target.role`, update `target.role = new_role`, save.
     - Insert a `RoleChangeLog` row: `targetUserId=target.id`, `changedByUserId=changer.id`, `fromRole=from_role`, `toRole=new_role`, `createdAt=now()`.
- Decorated with `@admin.action(description='Изменить роль')`.
- The action must NOT appear in the action dropdown for non-superuser staff. Achieve this by overriding `get_actions` on `AppUserAdmin` to exclude `change_role` when `not request.user.is_superuser`.

---

## Russian verbose names

All `verbose_name` / `verbose_name_plural` are set on the model `Meta` class (defined in `django-setup`). Confirm they appear correctly in the Django admin sidebar and page headings.

| Model | verbose_name | verbose_name_plural |
|---|---|---|
| Walk | Прогулка | Прогулки |
| Expedition | Экспедиция | Экспедиции |
| Request | Заявка | Заявки |
| AppUser | Пользователь | Пользователи |
| TeamMember | Член команды | Команда |

---

## Sidebar order (Jazzmin)

`JAZZMIN_SETTINGS['order_with_respect_to']` in settings:
```python
['birdwatch.walk', 'birdwatch.expedition', 'birdwatch.request', 'birdwatch.appuser', 'birdwatch.teammember']
```

Hide Django's own `auth` and `sites` apps from the sidebar using `hide_apps` in `JAZZMIN_SETTINGS`.

---

## Success criteria

- [ ] GET `/admin/birdwatch/walk/` as a logged-in staff or superuser returns HTTP 200 and includes the title of at least one seeded walk.
- [ ] GET `/admin/birdwatch/expedition/` as a logged-in superuser returns HTTP 200 and includes the title of the seeded expedition.
- [ ] GET `/admin/birdwatch/request/` as a logged-in superuser returns HTTP 200.
- [ ] GET `/admin/birdwatch/appuser/` as a logged-in superuser returns HTTP 200 and shows at least one user row.
- [ ] GET `/admin/birdwatch/teammember/` as a logged-in superuser returns HTTP 200.
- [ ] The sidebar visible after login contains the items **Прогулки, Экспедиции, Заявки, Пользователи, Команда** in that order. Django's auth group is absent from the sidebar.
- [ ] The action dropdown on the AppUser changelist includes **"Изменить роль"** when the logged-in Django user is a superuser.
- [ ] The action dropdown on the AppUser changelist does **not** include **"Изменить роль"** when the logged-in Django user is staff-but-not-superuser.
- [ ] Invoking `change_role` on a target user and confirming a new role: `AppUser.role` is updated in the database AND a `RoleChangeLog` row exists with matching `targetUserId`, `changedByUserId`, `fromRole`, `toRole`.
- [ ] Attempting to downgrade the only remaining SUPERADMIN via `change_role` returns an error message and does not change the role.
- [ ] Invoking `block_users` sets `blockedAt` to a non-null timestamp on the selected rows.
- [ ] Invoking `unblock_users` sets `blockedAt` to null on the selected rows.
- [ ] The `block_users` action is present in the action dropdown for both staff and superuser Django users.

---

## Edge cases

- **`change_role` on own account:** The action skips the row and shows an error message — the superuser's own role is not changed.
- **Last SUPERADMIN guard in `change_role`:** Counts only active (non-deleted) SUPERADMIN rows. If the count would drop to zero after the change, the change is rejected.
- **Last SUPERADMIN guard in `block_users`:** Same check — blocking the last SUPERADMIN is rejected.
- **`change_role` called by non-superuser (direct POST bypass):** `PermissionDenied` is raised before any DB write.
- **Bulk action with mixed valid/invalid rows:** Valid rows are updated; invalid rows (own account, last SUPERADMIN) are skipped individually with per-row error messages. The action does not abort all-or-nothing.

---

## Error cases

- A staff (non-superuser) Django user POSTs to execute `change_role`: `PermissionDenied` raised; no DB changes; Django returns HTTP 403.
- `AppUser.objects.get(email=request.user.email)` raises `DoesNotExist` during `change_role` (e.g., the acting admin's app user was deleted between login and action): raise an error and abort the action without writing any changes.

---

## Out of scope

- Walk or Expedition create/edit form customisation beyond defaults.
- Certificate generation, ticket management, or payment admin.
- Mobile layout for the Django admin.
- Active-link highlighting in the sidebar.
