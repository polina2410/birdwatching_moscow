# Current Feature: admin-navigation-button

## Status
In Progress

## Goals

- When `app/page.tsx` renders with `role = 'ADMIN'`, the HTML contains `<a href="/admin/">Админка</a>`
- When rendered with `role = 'SUPERADMIN'`, same `<a href="/admin/">Админка</a>` is present
- When rendered with `role = 'USER'`, no element with `href="/admin/"` is present
- When rendered with `session = null` (unauthenticated), no element with `href="/admin/"` is present
- In development (`NODE_ENV=development`), `next.config.ts` rewrites `/admin/:path*` to `http://localhost:8000/admin/:path*`
- In production (`NODE_ENV=production`), `next.config.ts` `rewrites()` returns an empty array

## Notes

**Spec:** context/specs/admin-navigation-button/spec.md

<!-- Completed features are appended to context/features/features-history.md, not here -->
