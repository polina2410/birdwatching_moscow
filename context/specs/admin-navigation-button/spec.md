# Spec: Admin Navigation Button

**Goal:** Add an "Админка" link to the Next.js homepage visible only to ADMIN and SUPERADMIN users, and configure a dev proxy so `/admin/` routes to Django during local development.

**Depends on:** `django-setup` spec (Django must be running at port 8000 for the link to resolve in dev).

---

## What to build

### "Админка" button on `app/page.tsx`

- `app/page.tsx` becomes an `async` Server Component.
- Call `const session = await auth()` from `@/lib/auth` at the top of the function.
- If `session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN'`, render:
  ```tsx
  <a href="/admin/">Админка</a>
  ```
- For `role === 'USER'` or `session === null`, render nothing extra.
- No new component file required — the logic is small enough to live directly in `page.tsx`.
- The button is only on the homepage (`/`). It does not appear on other public pages, auth pages, or account pages.

### Next.js dev proxy (`next.config.ts`)

Add a `rewrites` entry so the "Админка" button works in local development without manually switching ports:

```ts
async rewrites() {
  if (process.env.NODE_ENV !== 'development') return [];
  return [
    {
      source: '/admin/:path*',
      destination: 'http://localhost:8000/admin/:path*',
    },
  ];
},
```

This rewrite is **development-only**. In production, nginx routes `/admin/` directly to the Django process — Next.js is not involved.

---

## Success criteria

- [ ] When `app/page.tsx` renders server-side with a session where `role = 'ADMIN'`, the rendered HTML contains an `<a>` element with `href="/admin/"` and text content "Админка".
- [ ] When rendered with `role = 'SUPERADMIN'`, same result.
- [ ] When rendered with `role = 'USER'`, no element with `href="/admin/"` is present in the rendered HTML.
- [ ] When rendered with `session = null` (unauthenticated), no element with `href="/admin/"` is present.
- [ ] In development (`NODE_ENV=development`), a GET request to `http://localhost:3000/admin/` is proxied to `http://localhost:8000/admin/` and returns the Django admin response.
- [ ] In production (`NODE_ENV=production`), `next.config.ts` `rewrites()` returns an empty array (the proxy is inactive; nginx handles routing).

---

## Edge cases

- **Session role not set:** If `session.user.role` is undefined or any value other than `'ADMIN'` / `'SUPERADMIN'`, the button must not render. Default to hidden, not visible.
- **`app/page.tsx` already has content:** The `auth()` call and conditional `<a>` must be added without breaking existing markup on the page.
- **Proxy in test environment:** `NODE_ENV` in `pnpm test:run` is typically `'test'`, not `'development'` — rewrites return an empty array during tests, which is correct.

---

## Error cases

- `auth()` throws (e.g., misconfigured `AUTH_SECRET`): the error propagates and Next.js returns a 500. This is acceptable — it is not specific to this feature.
- Django is not running in dev and the user clicks "Админка": Next.js proxy forwards the request; Django is unreachable; the browser shows a connection error. Acceptable — Django must be started separately.

---

## Out of scope

- Styling or positioning of the "Админка" button (placeholder homepage only).
- nginx configuration for production (infrastructure concern, handled separately).
- Session-based role caching or client-side role checks.
- The "Админка" button appearing on any page other than `/`.
