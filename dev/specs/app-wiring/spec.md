# App Wiring — Spec

Three missing infrastructure pieces that must land before admin image management works end-to-end.

---

## 1. `next/image` remote patterns

### What to build

Add a `remotePatterns` entry in `next.config.ts` for Yandex Object Storage so `next/image` can fetch and optimise images stored in the bucket.

### Files touched

- `next.config.ts`

### Success criteria

- `pnpm build` succeeds with no "unconfigured host" warnings.
- A `<Image src="https://storage.yandexcloud.net/..." />` renders without a runtime error in development.
- The pattern is hostname-scoped (`hostname: 'storage.yandexcloud.net'`); no wildcard hostnames.

### Edge cases / error cases

- Do not add a catch-all `**` pattern — only the Yandex Object Storage hostname.

---

## 2. Admin image upload API route

### What to build

`POST /api/admin/upload` — accepts a `multipart/form-data` request with a single `file` field, uploads the file to Yandex Object Storage via the existing `s3` client in `lib/s3.ts`, and returns the public object URL.

### Files touched

- `app/api/admin/upload/route.ts` (new)

### Request

```
POST /api/admin/upload
Content-Type: multipart/form-data
Authorization: admin session cookie (checked via auth())

Body:
  file  — binary file, any image MIME type (image/jpeg, image/png, image/webp)
```

### Response

```json
// 200 OK
{ "url": "https://storage.yandexcloud.net/<bucket>/<key>" }

// 400 Bad Request — missing or non-image file
{ "error": "file required" }
{ "error": "unsupported file type" }

// 401 Unauthorized — not an admin session
{ "error": "unauthorized" }

// 500 Internal Server Error — S3 upload failed
{ "error": "upload failed" }
```

### Key decisions

- **Key format:** `uploads/<uuid>.<ext>` — no user-derived path segments to avoid path traversal.
- **ACL:** object is uploaded with `public-read` so the returned URL resolves without a signed query string.
- **Auth guard:** call `auth()` from `lib/auth.ts` and check `session.user.role === 'ADMIN'`; return 401 otherwise.
- **File size:** reject files larger than 5 MB (`Content-Length` check before streaming to S3); return 400.
- **MIME allow-list:** accept only `image/jpeg`, `image/png`, `image/webp`, `image/gif`; reject everything else with 400.

### Success criteria

- `POST /api/admin/upload` with a valid JPEG and admin session returns `200` and a URL starting with `https://storage.yandexcloud.net/`.
- `POST /api/admin/upload` without a session returns `401`.
- `POST /api/admin/upload` with a non-image file (e.g. `text/plain`) returns `400`.
- `POST /api/admin/upload` with a file > 5 MB returns `400`.
- `pnpm test:run` passes covering the above cases (mock `s3` and `auth` in tests).

### Edge cases / error cases

- Empty `file` field → 400.
- S3 `PutObjectCommand` throws → catch and return 500, do not leak the AWS error message.
- Concurrent uploads each get a unique key (uuid-based, no collision).

---

## 3. Provider wiring in `app/layout.tsx`

### What to build

Wrap the root layout body children with two providers that are built but not mounted:

- `SessionProvider` from `next-auth/react` — required for `useSession()` in any client component.
- `NavigationGuardProvider` from `components/NavigationGuardContext.tsx` — required for the unsaved-changes guard in admin forms.

Both are Client Components; the root layout stays a Server Component — providers must be extracted to a thin `'use client'` wrapper (`components/Providers.tsx`) and then rendered inside the layout.

### Files touched

- `components/Providers.tsx` (new)
- `app/layout.tsx`

### Structure

```tsx
// components/Providers.tsx
'use client'
import { SessionProvider } from 'next-auth/react'
import { NavigationGuardProvider } from './NavigationGuardContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NavigationGuardProvider>{children}</NavigationGuardProvider>
    </SessionProvider>
  )
}
```

```tsx
// app/layout.tsx — root layout stays a Server Component
import { Providers } from '@/components/Providers'
...
<body>
  <Providers>
    <Header />
    {children}
    <Footer />
  </Providers>
</body>
```

### Success criteria

- `pnpm build` succeeds with no "cannot use hooks in Server Component" errors.
- A client component that calls `useSession()` does not throw `SessionProvider is missing`.
- A component that calls `useNavigationGuardContext()` does not throw `NavigationGuardProvider is missing`.
- `components/Providers.tsx` is the only new `'use client'` boundary introduced; `app/layout.tsx` has no `'use client'` directive.

### Edge cases / error cases

- Do not pass a `session` prop to `SessionProvider` — let it fetch client-side (no SSR session needed here).
- `NavigationGuardProvider` wraps inside `SessionProvider` so admin guard components can also call `useSession()`.

---

## Implementation order

1. `next.config.ts` remotePatterns (no deps, 5-minute change).
2. `components/Providers.tsx` + `app/layout.tsx` wiring (no deps, 10-minute change).
3. `app/api/admin/upload/route.ts` (depends on S3 env vars being set; write tests first).

---

## Roadmap updates

When each task is complete, mark the corresponding line in `dev/roadmap.md` with a ➡️ green arrow prefix:

| Task | Roadmap section | Line to update |
|---|---|---|
| `next.config.ts` remotePatterns | §3 Infrastructure: Image storage setup | `- Update \`next.config.js\` with the correct \`remotePatterns\` entry for \`next/image\`` |
| Admin image upload route | §3 Infrastructure: Image storage setup | `- Update the admin image upload route to write to the chosen destination` |
| `SessionProvider` wiring | §5 Provider wiring | `- \`SessionProvider\` from \`next-auth/react\`…` |
| `NavigationGuardProvider` wiring | §5 Provider wiring | `- \`NavigationGuardProvider\` from \`components/NavigationGuardContext.tsx\`…` |

When all four lines in the roadmap are marked, both §3 and §5 headings can be considered done.
