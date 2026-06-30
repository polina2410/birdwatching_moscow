# Spec: Django Admin Production Deploy

**Goal:** Make the Django admin production-ready on the Selectel VPS by hardening settings, collecting static files, running via gunicorn, and routing requests correctly through nginx.

**Depends on:** `django-setup`, `django-admin-registration` (Django must be fully implemented before deployment).

---

## What to build

### 1. Settings changes (`django_admin/birdwatch_admin/settings.py`)

**a. Add `BASE_DIR`** at the top of the file, alongside existing imports:
```python
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
```

**b. Replace hardcoded `DEBUG = True`:**
```python
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
```
The default is `'false'`, so `DEBUG` is off unless the env var is explicitly set to `'true'` (case-insensitive).

**c. Replace hardcoded `ALLOWED_HOSTS = ['*']`:**
```python
_allowed = os.environ.get('DJANGO_ALLOWED_HOSTS', '')
if not DEBUG and not _allowed:
    raise ImproperlyConfigured(
        'DJANGO_ALLOWED_HOSTS must be set when DEBUG is false'
    )
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(',') if h.strip()] if _allowed else ['*']
```

**d. Add a secret-key guard** immediately after the existing `SECRET_KEY` line:
```python
_DEV_KEY = 'dev-secret-key-change-in-production'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', _DEV_KEY)
if not DEBUG and SECRET_KEY == _DEV_KEY:
    raise ImproperlyConfigured(
        'Set DJANGO_SECRET_KEY to a real secret in production'
    )
```

**e. Add reverse-proxy headers** so Django generates correct absolute URLs (redirects, CSRF) when behind nginx:
```python
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

**f. Change `STATIC_URL` to an absolute path and add `STATIC_ROOT`:**
```python
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
```
`STATIC_URL` must be an absolute URL path (not the current relative `'static/'`) so the browser resolves asset URLs correctly regardless of which admin page is being rendered. `STATIC_ROOT` is the directory `collectstatic` writes to.

### 2. Gunicorn dependency (`django_admin/requirements.txt`)

Add `gunicorn>=22.0` as a line in `requirements.txt`.

**Production start command** (operator runs on server — not a file in the repo):
```bash
cd /path/to/django_admin
pip install -r requirements.txt
gunicorn birdwatch_admin.wsgi --bind 127.0.0.1:8000 --workers 2
```

gunicorn must bind to `127.0.0.1` (loopback only), not `0.0.0.0`, so port 8000 is not publicly reachable.

### 3. collectstatic step (operator runs before first start and on each deploy)

```bash
cd /path/to/django_admin
python manage.py collectstatic --noinput
```

This copies all Django and jazzmin CSS/JS into `django_admin/staticfiles/`. nginx serves this directory directly; Django does not serve static files when `DEBUG=False`.

### 4. nginx location blocks (document only — file lives on server, not in repo)

These blocks belong inside the existing `server { }` block for the domain, alongside the Next.js proxy block. The `/static/` block must appear **before** `/admin/` so nginx's prefix match selects the static alias for asset requests.

```nginx
# Django admin static files — served directly by nginx
# Must appear before the /admin/ proxy block
location /static/ {
    alias /path/to/django_admin/staticfiles/;
    expires 30d;
    add_header Cache-Control "public";
}

# Django admin — proxy to gunicorn
location /admin/ {
    proxy_pass         http://127.0.0.1:8000;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_redirect     off;
}
```

`proxy_pass http://127.0.0.1:8000` (no trailing URI) forwards the full request path to gunicorn unchanged, so Django receives `/admin/...` and the URL conf `path('admin/', ...)` matches correctly.

`proxy_set_header Host $host` is required so `request.get_host()` returns the real domain name; Django uses this to build the post-login redirect URL.

Replace `/path/to/django_admin/` with the absolute path on the server (e.g. `/home/deploy/birdwatching_moscow/django_admin/`).

---

## Required environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Always | PostgreSQL connection string — already enforced by existing code |
| `DJANGO_SECRET_KEY` | When `DEBUG=false` | Must not be the dev default; startup raises `ImproperlyConfigured` otherwise |
| `DJANGO_ALLOWED_HOSTS` | When `DEBUG=false` | Comma-separated, e.g. `birdwatching.moscow,www.birdwatching.moscow`; startup raises `ImproperlyConfigured` if absent |
| `DJANGO_DEBUG` | No | Defaults to `'false'`; set to `'true'` in dev only |

---

## Success criteria

- [ ] `grep "DEBUG = True" django_admin/birdwatch_admin/settings.py` returns no matches — DEBUG is no longer hardcoded.
- [ ] `grep "ALLOWED_HOSTS = \['\*'\]" django_admin/birdwatch_admin/settings.py` returns no matches — the wildcard is no longer hardcoded.
- [ ] `grep "STATIC_ROOT" django_admin/birdwatch_admin/settings.py` returns one line defining `STATIC_ROOT`.
- [ ] `grep "STATIC_URL" django_admin/birdwatch_admin/settings.py` shows `'/static/'` (absolute, not the old relative `'static/'`).
- [ ] `grep "USE_X_FORWARDED_HOST" django_admin/birdwatch_admin/settings.py` returns `USE_X_FORWARDED_HOST = True`.
- [ ] `grep "SECURE_PROXY_SSL_HEADER" django_admin/birdwatch_admin/settings.py` returns a line defining the header tuple.
- [ ] `grep "gunicorn" django_admin/requirements.txt` returns a match.
- [ ] With `DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS=birdwatching.moscow`, `DJANGO_SECRET_KEY=<real-key>`, `DATABASE_URL=<real-url>` set: `python manage.py check` exits 0 with "System check identified no issues."
- [ ] With `DJANGO_DEBUG=false` and `DJANGO_ALLOWED_HOSTS` unset: `python manage.py check` raises `ImproperlyConfigured` and exits non-zero.
- [ ] With `DJANGO_DEBUG=false` and `DJANGO_SECRET_KEY` equal to `'dev-secret-key-change-in-production'`: startup raises `ImproperlyConfigured`.
- [ ] After `python manage.py collectstatic --noinput` exits 0: `django_admin/staticfiles/admin/css/base.css` exists on the filesystem.
- [ ] `curl -I https://<domain>/static/admin/css/base.css` returns HTTP 200 — nginx serves the static file, not gunicorn.
- [ ] `curl -IL https://<domain>/admin/` follows redirects and returns HTTP 200 with content-type `text/html`.
- [ ] `curl -s https://<domain>/admin/login/` contains `<form` in the response body — Django rendered the login page.
- [ ] `curl -s https://<domain>/admin/login/` contains the jazzmin site title (e.g. `Birdwatching Moscow`) — templates and static CSS loaded (page is styled, not raw HTML).
- [ ] With `DJANGO_DEBUG=false`, `GET https://<domain>/admin/nonexistent/` returns the Django 404 page with no traceback in the response body.

---

## Edge cases

- **`DJANGO_DEBUG=True` (capital T) vs `'true'` (lowercase):** The expression `.lower() == 'true'` accepts both. Either casing enables debug mode. Operators must ensure this is not set on the production server.
- **`DJANGO_ALLOWED_HOSTS` set but empty string:** `_allowed.split(',')` produces `['']`; the list comprehension filters empty strings, leaving `ALLOWED_HOSTS = []`. Django returns HTTP 400 for all requests. Fix: set the variable to at least one valid hostname.
- **`collectstatic` not run:** `staticfiles/` directory is absent; nginx `alias` resolves to a non-existent path; `/static/admin/css/base.css` returns HTTP 404. The admin login page loads but is completely unstyled. Detected by the `curl -I` success criterion.
- **`/static/` nginx block listed after `/admin/`:** Both blocks use prefix matching. When nginx evaluates location blocks, it picks the longest matching prefix, but for equal-length prefixes it uses declaration order. Because `/admin/` is longer than `/static/`, they do not conflict — but if a future block uses `/static/admin/` or similar, order matters. Document the block order in the server config comment.
- **`proxy_pass` includes a trailing URI path (e.g. `http://127.0.0.1:8000/`):** nginx strips the `/admin/` prefix before forwarding; Django receives `/login/` instead of `/admin/login/` and returns 404 because the URL conf has no route for bare `/login/`. `proxy_pass` must have no trailing URI.
- **`proxy_set_header Host` missing:** `request.get_host()` returns `127.0.0.1:8000`. Django's post-login redirect becomes `http://127.0.0.1:8000/admin/` — unreachable from the browser.
- **`USE_X_FORWARDED_HOST` set without nginx forwarding `Host`:** Ignored. Both the Django setting and the nginx header are required together.
- **nginx `alias` path missing trailing slash:** nginx returns 404 for all static files. The `alias` directive requires a trailing slash when the `location` block has one.

---

## Error cases

- **`DATABASE_URL` not set:** `ImproperlyConfigured` raised at startup — gunicorn fails to start. Verify env vars are exported before running gunicorn.
- **`DJANGO_SECRET_KEY` is the dev default in production:** `ImproperlyConfigured` raised at startup (after this spec is implemented). Previously would have silently used a known key, allowing session forgery.
- **gunicorn not installed:** `python: No module named gunicorn` at start. Fix: `pip install -r requirements.txt`.
- **Port 8000 already in use:** gunicorn fails to bind; nginx returns HTTP 502 for all `/admin/` requests. Fix: stop the conflicting process.
- **`staticfiles/` directory not writable:** `collectstatic` exits with `PermissionError`. Fix: ensure the deploy user owns the `django_admin/` directory.

---

## Out of scope

- SSL/TLS certificate setup (already handled separately).
- Next.js nginx configuration (already handled separately).
- systemd or supervisor unit files for process management (operator's choice).
- `manage.py migrate` automation on deploy (operator runs manually).
- CI/CD pipeline or zero-downtime deploys.
- `CSRF_TRUSTED_ORIGINS` (needed once HTTPS is fully active; add `CSRF_TRUSTED_ORIGINS = ['https://birdwatching.moscow']` if CSRF failures appear on form POST after SSL is configured).
- Log rotation or monitoring configuration.

---

## Technical notes

**Files affected:**
- `django_admin/birdwatch_admin/settings.py` — add `BASE_DIR`; replace `DEBUG`, `ALLOWED_HOSTS`, `STATIC_URL`; add `STATIC_ROOT`, `USE_X_FORWARDED_HOST`, `SECURE_PROXY_SSL_HEADER`, secret-key guard, `ALLOWED_HOSTS` guard
- `django_admin/requirements.txt` — add `gunicorn>=22.0`

**Constraints:**
- `STATIC_URL = '/static/'` must be absolute. The current relative `'static/'` produces browser-relative URLs that happen to resolve correctly from `/admin/login/` but are fragile and not guaranteed from every page depth.
- gunicorn binds to `127.0.0.1:8000` (loopback), not `0.0.0.0:8000`.
- Django does not serve static files when `DEBUG=False`; the `django.contrib.staticfiles` app only handles that in dev.

**Open questions:**
- What is the absolute filesystem path to `django_admin/` on the VPS? The nginx `alias` directive requires this exact path. (Operator fills in before applying the config.)
- Does `/static/` conflict with any existing Next.js routes? Next.js uses `/_next/static/` for its own assets, so `/static/` should be free — confirm with the team.
- Should `gunicorn --workers` be tuned? 2 workers is a conservative default for a low-traffic admin panel; adjust based on available CPU cores (typically `2 * cores + 1`).
