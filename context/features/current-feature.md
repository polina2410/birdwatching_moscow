# Current Feature: walk-expedition-split

## Status
In Progress

## Goals

- `pnpm exec prisma migrate status` exits 0 with no pending migrations
- `pnpm exec tsx prisma/seed.ts` exits 0 with "Seed complete." output
- After seeding, `prisma.walk.count()` returns 2 and `prisma.expedition.count()` returns 1
- `prisma.walk.findFirst({ include: { guide: true, tickets: true, cartItems: true } })` completes without throwing
- `prisma.expedition.findFirst({ include: { guides: true, days: true, requests: true } })` completes without throwing
- `prisma.ticket.findFirst({ include: { walk: true } })` completes without throwing (FK rename confirmed)
- `prisma.request.findFirst({ where: { type: 'EXPEDITION' }, include: { expedition: true } })` returns a non-null result with a populated `expedition`
- `prisma.request.findFirst({ where: { type: 'PRIVATE_WALK' } })` returns a row where `expeditionId` is null
- `pnpm build` succeeds with zero TypeScript errors — no remaining references to `Event` model or `EventType` enum

## Notes

**Spec:** context/specs/walk-expedition-split/spec.md
