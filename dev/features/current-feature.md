# Current Feature: admin-first-login-password

## Status

In Progress

## Goals

- `POST /api/auth/verify-login-code` returns `{ next:'set-password', challengeToken }` when ADMIN/SUPERADMIN has `passwordHash === null`; returns `{ next:'password', challengeToken }` when passwordHash is set (existing behaviour)
- `POST /api/auth/set-initial-password`: valid challenge + password → saves hash, marks challenge used, issues new challenge, returns `{ challengeToken }`; invalid challenge → 401; user already has password → 400; short password → 400; rate limit → 429
- Login page `set-password` step: shows after `{ next:'set-password' }`, has password + confirm fields, validates match client-side, calls `set-initial-password` then `signIn('admin-2fa')` with returned token
- `pnpm test:run`, `pnpm lint`, `pnpm build` all pass

## Notes

**Spec:** dev/specs/admin-first-login-password/spec.md
