# Current Feature: app-wiring

## Status

In Progress

## Goals

- `pnpm build` succeeds with no "unconfigured host" warnings after adding `remotePatterns` for `storage.yandexcloud.net`
- A `<Image src="https://storage.yandexcloud.net/..." />` renders without a runtime error in development
- `POST /api/admin/upload` with a valid JPEG and admin session returns `200` and a URL starting with `https://storage.yandexcloud.net/`
- `POST /api/admin/upload` without a session returns `401`
- `POST /api/admin/upload` with a non-image file returns `400`
- `POST /api/admin/upload` with a file > 5 MB returns `400`
- `pnpm test:run` passes for all upload route cases
- `pnpm build` succeeds with no "cannot use hooks in Server Component" errors after provider wiring
- `components/Providers.tsx` is the only new `'use client'` boundary; `app/layout.tsx` has no `'use client'` directive

## Notes

**Spec:** dev/specs/app-wiring/spec.md
