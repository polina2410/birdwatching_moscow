# Spec: Django Project Setup

**Goal:** Bootstrap a Django project in `django_admin/` that connects to the same PostgreSQL database as the Next.js app, defines read-only Prisma-mirrored models, and authenticates Django admin logins against the app's `User` table — no separate credential management.

**Depends on:** `walk-expedition-split` spec (Prisma schema must be split before Django models can mirror it).

---

## What to build

### Directory structure

```
django_admin/
  manage.py
  requirements.txt
  birdwatch_admin/
    __init__.py
    settings.py
    urls.py
    wsgi.py
  birdwatch/
    __init__.py
    apps.py
    models.py
    backends.py
    admin.py          # empty at this phase — populated in django-admin-registration
    migrations/
      __init__.py     # empty — migrations disabled for Prisma-managed tables
```

### `requirements.txt`

```
django>=5.0,<6.0
psycopg2-binary
django-jazzmin
bcrypt
```

### Settings (`birdwatch_admin/settings.py`)

- `DATABASES['default']`: parse `DATABASE_URL` env var via `dj-database-url` or manual parsing; raise `ImproperlyConfigured` if not set.
- `INSTALLED_APPS`: `['jazzmin', 'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles', 'django.contrib.postgres', 'birdwatch']`.
- `LANGUAGE_CODE = 'ru-ru'`
- `MIGRATION_MODULES = {'birdwatch': None}` — prevents Django from generating or running migrations on Prisma-managed tables.
- `AUTHENTICATION_BACKENDS = ['birdwatch.backends.AppUserAuthBackend']`
- `JAZZMIN_SETTINGS`: `site_title`, `site_header` set to the project name; `order_with_respect_to` configured (Walk first, then Expedition, Request, AppUser, TeamMember); Django's own `auth` app hidden from the sidebar.

### URLs (`birdwatch_admin/urls.py`)

```python
from django.contrib import admin
from django.urls import path
urlpatterns = [path('admin/', admin.site.urls)]
```

### Django models (`birdwatch/models.py`)

All models:
- `class Meta: managed = False` — Django never issues DDL on these tables.
- `db_table` set to Prisma's PascalCase table name.
- FK columns use `db_column` to match Prisma's camelCase column names.
- Array columns (`birdSpecies`, `galleryUrls`, `profileLinks`) use `django.contrib.postgres.fields.ArrayField(models.TextField())`.
- PostgreSQL enum columns mapped as `models.CharField` with Python `choices` — the DB enforces the constraint.

Models to define:

**`Walk`** — all Walk fields; direct FK to `TeamMember` via `guide_id = models.IntegerField(db_column='guideId')` — Walk has a single guide, not an M2M relationship; there is no `_TeamMemberToWalk` join table. `db_table = 'Walk'`. `verbose_name = 'Прогулка'`, `verbose_name_plural = 'Прогулки'`.

**`Expedition`** — all Expedition fields; M2M to `TeamMember` via explicit through model with `db_table = '_ExpeditionToTeamMember'` (confirmed from migration SQL); the through model's `B` column is `INTEGER` (FK to `TeamMember.id`) — use `models.IntegerField()` for that side, not `CharField`. `db_table = 'Expedition'`. `verbose_name = 'Экспедиция'`, `verbose_name_plural = 'Экспедиции'`.

**`ExpeditionDay`** — `expeditionId` FK to `Expedition` (`db_column = 'expeditionId'`); `db_table = 'ExpeditionDay'`.

**`AppUser`** — mirrors app `User` table; `db_table = 'User'`; all fields including `role`, `blockedAt`, `deletedAt`, `passwordHash`; `verbose_name = 'Пользователь'`, `verbose_name_plural = 'Пользователи'`. Must NOT extend `AbstractUser` — it is a plain `Model`. Django's own `auth.User` is the separate admin session model.

**`TeamMember`** — all fields; `id = models.AutoField(primary_key=True)` (SERIAL integer — not UUID/CharField); `db_table = 'TeamMember'`; `verbose_name = 'Член команды'`, `verbose_name_plural = 'Команда'`.

**`Request`** — all fields; `expeditionId` nullable FK to `Expedition` (`db_column = 'expeditionId'`); `db_table = 'Request'`; `verbose_name = 'Заявка'`, `verbose_name_plural = 'Заявки'`.

**`RoleChangeLog`** — `targetUserId`, `changedByUserId`, `fromRole`, `toRole`, `createdAt`; `db_table = 'RoleChangeLog'`. Used by the role-change action (defined in `django-admin-registration`) to write audit records.

### Custom auth backend (`birdwatch/backends.py`)

`AppUserAuthBackend` routes Django admin login through the app's `User` table:

**`authenticate(request, username=None, password=None)`:**
1. Look up `AppUser` by `email = username` where `deletedAt IS NULL` and `blockedAt IS NULL`.
2. Verify `password` against `AppUser.passwordHash` using `bcrypt.checkpw`.
3. If invalid or user not found: return `None`.
4. If `role` is not `ADMIN` or `SUPERADMIN`: return `None` (non-admin app users cannot log into Django admin).
5. Get-or-create a Django `auth.User` row: `username=email`, `email=email`, `is_active=True`, `is_staff=True`, `is_superuser=(role == 'SUPERADMIN')`.
6. Sync `is_superuser` on every login (role may have changed since last login).
7. Return the `auth.User` instance.

**`get_user(user_id)`:** return `auth.User.objects.get(pk=user_id)` or `None`.

This means:
- `auth_user` is auto-populated on first login — no manual `createsuperuser` needed.
- `request.user.email` inside any Django admin view always matches an `AppUser` row.
- `RoleChangeLog.changedByUserId` resolved via `AppUser.objects.get(email=request.user.email).id`.

---

## Success criteria

- [ ] `cd django_admin && python -m pip install -r requirements.txt` exits 0.
- [ ] `cd django_admin && python manage.py check` exits 0 with "System check identified no issues."
- [ ] `cd django_admin && python manage.py migrate` exits 0 — applies only Django's own auth/session/admin migrations; Prisma-managed tables are untouched.
- [ ] `cd django_admin && python manage.py runserver 8000` starts without error (no import errors, no misconfigured settings).
- [ ] GET `http://localhost:8000/admin/login/` returns HTTP 200 and the response body contains a `<form>`.
- [ ] An app user with `role = ADMIN` or `SUPERADMIN` can log in at `/admin/login/` using their app email and password; after login, GET `/admin/` returns HTTP 200 or 302.
- [ ] An app user with `role = USER` cannot log in at `/admin/login/` — the form re-renders with an error.
- [ ] A blocked app user (`blockedAt IS NOT NULL`) cannot log in.
- [ ] After a SUPERADMIN logs in, their `auth_user` row has `is_superuser = True`; after an ADMIN logs in, `is_superuser = False`.
- [ ] `python manage.py shell -c "from birdwatch.models import Walk; print(Walk.objects.count())"` returns the count of walk rows without throwing (confirms DB connection and model mapping).

---

## Edge cases

- **`DATABASE_URL` not set:** `settings.py` raises `django.core.exceptions.ImproperlyConfigured` at startup — the server does not start.
- **Prisma join table naming:** `_ExpeditionToTeamMember` is confirmed from migration SQL and is the only join table — Walk does not use M2M and has no join table.
- **`auth_user` row sync:** If an ADMIN's role is changed to USER between logins, `authenticate` returns `None` and they can no longer access Django admin, but their `auth_user` row remains (stale but harmless — `is_staff` is re-synced on next successful login).
- **bcrypt hash format:** The app stores hashes in the format NextAuth.js produces (standard bcrypt `$2b$` prefix). Confirm `bcrypt.checkpw` accepts this format; if the app uses a different prefix (`$2a$`), add a normalization step.

---

## Out of scope

- Django admin class registration (covered in `django-admin-registration` spec).
- The "Админка" Next.js button (covered in `admin-navigation-button` spec).
- nginx / production proxy configuration.
- Django admin styling beyond jazzmin defaults.
