# User Story: Admin Navigation

As an admin, I want quick access to the admin panel from the main site, so that I can manage walks, expeditions, and users without navigating manually.

## Acceptance criteria

- [ ] A logged-in user with role `ADMIN` or `SUPERADMIN` sees an "Админка" button on the page
- [ ] A logged-in user with role `USER` does not see the "Админка" button
- [ ] A logged-out user does not see the "Админка" button
- [ ] Clicking "Админка" navigates to the admin panel
- [ ] The admin panel sidebar shows three menu items: "Прогулки", "Экспедиции", "Пользователи"
- [ ] "Прогулки" navigates to `/admin/walks` and shows only walk-type events
- [ ] "Экспедиции" navigates to `/admin/expeditions` and shows only expedition-type events
- [ ] "Пользователи" is visible to all admins (`ADMIN` and `SUPERADMIN`)
- [ ] On "Пользователи", role change actions are restricted to `SUPERADMIN` only — `ADMIN` users see the list but cannot change roles