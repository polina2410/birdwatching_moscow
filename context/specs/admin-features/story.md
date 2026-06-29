# User Story: Admin Navigation

As an admin, I want quick access to the admin panel from the main site, so that I can manage walks, expeditions, requests, users, team without navigating manually.

## Acceptance criteria

- [ ] A logged-in user with role `ADMIN` or `SUPERADMIN` sees an "Админка" button on the page
- [ ] A logged-in user with role `USER` does not see the "Админка" button
- [ ] A logged-out user does not see the "Админка" button
- [ ] Clicking "Админка" navigates to the admin panel
- [ ] On click to the top left - open `/admin/walks`
- [ ] The admin panel sidebar shows the menu items: "Прогулки", "Экспедиции", "Заявки", "Пользователи", "Команда"
- [ ] "Прогулки" navigates to `/admin/walks` and shows only walks
- [ ] "Заявки" navigates to `/admin/requests` and shows only requests from the future forms
- [ ] "Экспедиции" navigates to `/admin/expeditions` and shows only expeditions
- [ ] "Пользователи" is visible to all admins (`ADMIN` and `SUPERADMIN`)
- [ ] On "Пользователи", role change actions are restricted to `SUPERADMIN` only — `ADMIN` users see the list but cannot change roles