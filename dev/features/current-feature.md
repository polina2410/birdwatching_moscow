# Current Feature: HTTP Security Headers

## Status

In Progress

## Goals

- `SECURITY_HEADERS` contains entries for all four headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- `headers()` returns exactly one source entry matching `'/:path*'`
- `reactCompiler: true` remains set after refactor
- `pnpm test:run` passes
- `pnpm build` passes with zero TypeScript errors

## Notes

- **Scope**: `next.config.ts` only — no UI, no migration, no CSP (deferred)
- **Export**: `SECURITY_HEADERS` must be a named export so tests can import it without running Next.js
- **Files**: modify `next.config.ts`; create `__tests__/next-config/security-headers.test.ts`
- **No new deps**, no schema changes
- HSTS goes at Nginx level (not here); X-Powered-By is stripped by Next.js automatically; CSP is a separate future feature
