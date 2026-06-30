# Current Feature: django-production-deploy

## Status
In Progress

## Goals

- `python manage.py collectstatic --noinput` exits 0 and creates `django_admin/staticfiles/admin/` containing CSS and JS files
- `curl -I https://your-domain.com/static/admin/css/base.css` returns HTTP 200 (nginx serves the static file)
- `curl -IL https://your-domain.com/admin/` follows redirects and ultimately returns HTTP 200 with `content-type: text/html`
- The login page at `https://your-domain.com/admin/login/` is styled (CSS loads)
- Logging in with an ADMIN or SUPERADMIN user's app email + password grants access to the admin panel
- Logging in with a USER role account is rejected
- With `DJANGO_DEBUG=false`, visiting `/admin/nonexistent/` returns a 404 page, not a debug traceback
- With `DJANGO_ALLOWED_HOSTS` set to the production domain, a spoofed `Host: evil.com` header returns HTTP 400
- `gunicorn birdwatch_admin.wsgi --bind 127.0.0.1:8000 --workers 2` starts without errors

## Notes

**Spec:** context/specs/django-production-deploy/spec.md

<!-- Completed features are appended to context/features/features-history.md, not here -->
