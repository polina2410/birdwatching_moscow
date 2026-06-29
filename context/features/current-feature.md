# Current Feature: django-setup

## Status
Not Started

## Goals

- `cd django_admin && python -m pip install -r requirements.txt` exits 0
- `cd django_admin && python manage.py check` exits 0 with "System check identified no issues."
- `cd django_admin && python manage.py migrate` exits 0 — applies only Django's own auth/session/admin migrations; Prisma-managed tables are untouched
- `cd django_admin && python manage.py runserver 8000` starts without error (no import errors, no misconfigured settings)
- GET `http://localhost:8000/admin/login/` returns HTTP 200 and the response body contains a `<form>`
- An app user with `role = ADMIN` or `SUPERADMIN` can log in at `/admin/login/` using their app email and password; after login, GET `/admin/` returns HTTP 200 or 302
- An app user with `role = USER` cannot log in at `/admin/login/` — the form re-renders with an error
- A blocked app user (`blockedAt IS NOT NULL`) cannot log in
- After a SUPERADMIN logs in, their `auth_user` row has `is_superuser = True`; after an ADMIN logs in, `is_superuser = False`
- `python manage.py shell -c "from birdwatch.models import Walk; print(Walk.objects.count())"` returns the count of walk rows without throwing

## Notes

**Spec:** context/specs/django-setup/spec.md