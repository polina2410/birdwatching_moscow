# Current Feature: django-admin-registration

## Status
Not Started

## Goals

- GET `/admin/birdwatch/walk/` as ADMIN or SUPERADMIN returns HTTP 200 with at least one seeded walk title
- GET `/admin/birdwatch/expedition/` as ADMIN or SUPERADMIN returns HTTP 200 with the seeded expedition title
- GET `/admin/birdwatch/request/` as ADMIN or SUPERADMIN returns HTTP 200
- GET `/admin/birdwatch/appuser/` as ADMIN or SUPERADMIN returns HTTP 200 with at least one user row
- GET `/admin/birdwatch/teammember/` as ADMIN or SUPERADMIN returns HTTP 200
- Sidebar after login contains **Прогулки, Экспедиции, Заявки, Пользователи, Команда** in that order; Django `auth` group absent
- Action dropdown on AppUser changelist includes "Изменить роль" when logged-in user is SUPERADMIN
- Action dropdown on AppUser changelist does NOT include "Изменить роль" when logged-in user is ADMIN (not SUPERADMIN)
- `change_role` confirmation updates `AppUser.role` AND inserts `RoleChangeLog` row with correct `targetUserId`, `changedByUserId`, `fromRole`, `toRole`
- Attempting to downgrade the only remaining SUPERADMIN via `change_role` returns an error and does not change the role
- `block_users` sets `blockedAt` to a non-null timestamp on selected rows (available to ADMIN and SUPERADMIN)
- `unblock_users` sets `blockedAt` to null on selected rows (available to ADMIN and SUPERADMIN)
- `block_users` action appears in the dropdown for both ADMIN and SUPERADMIN users

## Notes

**Spec:** context/specs/django-admin-registration/spec.md
