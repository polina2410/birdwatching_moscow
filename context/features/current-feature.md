# Current Feature: admin-navigation

## Status
In Progress

## Goals

- On the public site, a user with role `ADMIN` or `SUPERADMIN` sees an "Админка" button; clicking it navigates to `/admin`
- On the public site, a user with role `USER` does not see the "Админка" button
- On the public site, a logged-out user does not see the "Админка" button
- The admin sidebar contains a "Прогулки" link that navigates to `/admin/walks`
- The admin sidebar contains an "Экспедиции" link that navigates to `/admin/expeditions`
- `/admin/walks` renders only events where `type === 'WALK'`; no EXPEDITION-type events appear in the list
- `/admin/expeditions` renders only events where `type === 'EXPEDITION'`; no WALK-type events appear in the list
- `/admin/walks` and `/admin/expeditions` are accessible to users with role `ADMIN` (do not redirect)
- `/admin/walks` and `/admin/expeditions` redirect to `/` for a USER-role session and for unauthenticated requests
- The admin sidebar "Пользователи" link is visible to a user with role `ADMIN` (previously hidden)
- `/admin/users` is accessible (HTTP 200, no redirect) for a session with role `ADMIN`
- When the current user is `ADMIN`, `UsersTable` renders the full user list with block/unblock actions visible but the role-change action hidden
- When the current user is `SUPERADMIN`, `UsersTable` renders all actions (block/unblock + role-change) as before
- The `changeUserRole` server action throws `'Forbidden'` when called by a session with role `ADMIN`
- The `blockUser` server action succeeds when called by a session with role `ADMIN` targeting a non-SUPERADMIN user
- The `unblockUser` server action succeeds when called by a session with role `ADMIN` targeting a non-SUPERADMIN user

## Notes

**Spec:** context/specs/admin-navigation/spec.md

Key decisions:
- Existing sidebar items (Команда, Заявки, Events) are preserved; new items added alongside
- `/admin/request` (singular) from spec is not created — existing `/admin/requests` page already handles requests
- Out-of-scope note in spec contradicts section 5; section 5 (blockUser/unblockUser guard changes) takes precedence per user instruction
- `UsersTable` gets `canChangeRole: boolean` prop; block/unblock always visible to all admins

## History

<!-- Completed features are tracked in context/features/features-history.md -->