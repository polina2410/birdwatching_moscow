# Spec: HTTP Security Headers

## What to build

Add four HTTP security headers to every response via `next.config.ts`. No UI, no migration, no design decisions.

CSP is explicitly **out of scope** — it requires YooKassa widget domain research and staging verification (see roadmap Step 17 notes). That is a separate feature.

---

## Background

`next.config.ts` currently has no `headers()` export. The `headers()` async function in Next.js config applies response headers to matched routes.

All four headers below are static strings — no per-request logic, no environment branching.

---

## Headers to add (applied to all routes — source `'/:path*'`)

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

---

## Implementation

Add a `headers()` async function to `next.config.ts` that returns one entry matching `'/:path*'` with all four headers. Extract the header definitions into a named constant so they can be imported and tested directly.

```ts
// next.config.ts (outline only — exact code is the implementation's job)
export const SECURITY_HEADERS = [ ... ]

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}
```

Exporting `SECURITY_HEADERS` as a named export makes it importable in tests without running Next.js itself.

---

## Files to create / modify

| Path | Action |
|------|--------|
| `next.config.ts` | Modify — add `headers()` and export `SECURITY_HEADERS` |
| `__tests__/next-config/security-headers.test.ts` | New — tests (written before implementation) |

No new dependencies. No schema migration.

---

## Success criteria

Each criterion maps to at least one test. All must pass (`pnpm test:run`) before the feature is complete.

1. `SECURITY_HEADERS` contains an entry with `key: 'X-Frame-Options'` and `value: 'SAMEORIGIN'`.
2. `SECURITY_HEADERS` contains an entry with `key: 'X-Content-Type-Options'` and `value: 'nosniff'`.
3. `SECURITY_HEADERS` contains an entry with `key: 'Referrer-Policy'` and `value: 'strict-origin-when-cross-origin'`.
4. `SECURITY_HEADERS` contains an entry with `key: 'Permissions-Policy'` and `value: `'camera=(), microphone=(), geolocation=()'`.
5. `headers()` returns exactly one source entry with `source: '/:path*'`.
6. The single source entry's `headers` array is `SECURITY_HEADERS` (same reference or identical shape).
7. `reactCompiler: true` remains set — the refactor must not drop existing config.
8. `pnpm test:run` passes.
9. `pnpm build` passes with zero TypeScript errors.

---

## Edge cases (explicit code decisions, no tests needed)

- Do **not** set `X-Powered-By: Next.js` removal here — Next.js strips it automatically in production.
- Do **not** add `Strict-Transport-Security` here — HSTS must be set at the Nginx level (already documented in roadmap Inf-B), not in the app, because the app also runs on HTTP locally.
- `Content-Security-Policy` is intentionally absent — future spec.
