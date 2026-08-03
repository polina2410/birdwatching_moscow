# Spec: Walk / Expedition Schema Split

**Goal:** Replace the single `Event` Prisma model with two dedicated models — `Walk` and `Expedition` — eliminating nullable-by-convention fields and making type-specific constraints explicit in the schema.

---

## What to build

### New `Walk` model (table `"Walk"`, ticketed)

Shared fields: `id UUID @id`, `slug VarChar(200) @unique`, `title VarChar(150)`, `description Text`, `startsAt DateTime`, `location VarChar(100)`, `status EventStatus @default(DRAFT)`, `coverPhotoUrl VarChar(2048)`, `publishedAt DateTime?`, `publishedBy String?`, `createdAt @default(now())`

Walk-specific (now required, no longer nullable): `priceKopecks Int`, `capacity Int`, `guideId String`

Relations: `publisher User?`, `guide TeamMember` (single FK — a walk has exactly one guide), `tickets Ticket[]`, `cartItems CartItem[]`

Index: `[status, startsAt]`

### New `Expedition` model (table `"Expedition"`, spot-based)

Same shared fields as Walk.

Expedition-specific (now required): `totalSpots Int`, `spotsLeft Int`

Relations: `publisher User?`, `guides TeamMember[]` (M2M — an expedition can have multiple guides), `days ExpeditionDay[]`, `requests Request[]`

Index: `[status, startsAt]`

### Downstream model changes

| Model | Old | New |
|---|---|---|
| `ExpeditionDay` | `eventId → Event` | `expeditionId → Expedition` |
| `TeamMember` | `events Event[]` | `walks Walk[]` (reverse of Walk.guideId, one-to-many) + `expeditions Expedition[]` (M2M) |
| `Ticket` | `eventId → Event` | `walkId → Walk` |
| `CartItem` | `eventId → Event` | `walkId → Walk` |
| `Request` | `eventId → Event?` | `expeditionId → Expedition?` |
| `User` | `publishedEvents Event[]` | `publishedWalks Walk[]` + `publishedExpeditions Expedition[]` |

Remove the `EventType` enum. Keep `EventStatus` — both new models use it.

### Migration strategy

This migration cannot be auto-generated (one table splits into two). The implementer must:

1. Run `prisma migrate dev --create-only` to generate a blank migration file.
2. Write raw SQL inside a single transaction:
   - a. `CREATE TABLE "Walk"` and `"Expedition"` with all constraints (UNIQUE on slug, FK to `"User"`). Walk includes a `guideId` column (FK to `"TeamMember"`, NOT NULL).
   - b. Copy WALK rows from `"Event"` into `"Walk"`, populating `guideId` from `_EventToTeamMember` — select one `teamMemberId` per event (e.g., `MIN(teamMemberId)` for determinism). If a walk event has no guide row in the join table, the INSERT will fail the NOT NULL constraint — seed data must have at least one guide per walk.
   - c. Create join table `"_ExpeditionToTeamMember"` (confirm exact name from Prisma's alphabetical ordering); migrate rows from `"_EventToTeamMember"` for EXPEDITION-type events only.
   - d. Add `expeditionId` to `"ExpeditionDay"`, populate via join to `"Expedition"`, drop `eventId`.
   - e. Add `walkId` to `"Ticket"`, populate via join to `"Walk"`, drop `eventId`.
   - f. Add `walkId` to `"CartItem"`, populate via join to `"Walk"`, drop `eventId`.
   - g. Add `expeditionId` to `"Request"`, populate from `eventId` for EXPEDITION-type rows only (`PRIVATE_WALK` rows stay null), drop `eventId`.
   - h. Drop `"Event"`, `"_EventToTeamMember"`, and the `EventType` PostgreSQL enum.
3. Apply with `prisma migrate dev` locally, `prisma migrate deploy` in production.

### `prisma/seed.ts` update

- Delete in FK-safe order: `request → cartItem → ticket → order → expeditionDay → expedition → walk → teamMember → user`.
- Replace `prisma.event.create({ data: { type: EventType.WALK, ... } })` with `prisma.walk.create({ data: { ..., guideId: '<teamMemberId>' } })` — pass a single `guideId` scalar, not a nested `guides: { connect: [...] }` relation.
- Replace the expedition `prisma.event.create` call with `prisma.expedition.create`.
- Replace `prisma.expeditionDay.createMany({ data: [{ eventId: ... }] })` with `expeditionId`.
- Remove the `EventType` import.

---

## Success criteria

- [ ] `pnpm exec prisma migrate status` exits 0 with no pending migrations.
- [ ] `pnpm exec tsx prisma/seed.ts` exits 0 with "Seed complete." output.
- [ ] After seeding, `prisma.walk.count()` returns 2 and `prisma.expedition.count()` returns 1.
- [ ] `prisma.walk.findFirst({ include: { guides: true, tickets: true, cartItems: true } })` completes without throwing.
- [ ] `prisma.expedition.findFirst({ include: { guides: true, days: true, requests: true } })` completes without throwing.
- [ ] `prisma.ticket.findFirst({ include: { walk: true } })` completes without throwing (FK rename confirmed).
- [ ] `prisma.request.findFirst({ where: { type: 'EXPEDITION' }, include: { expedition: true } })` returns a non-null result with a populated `expedition`.
- [ ] `prisma.request.findFirst({ where: { type: 'PRIVATE_WALK' } })` returns a row where `expeditionId` is null.
- [ ] `pnpm build` succeeds with zero TypeScript errors — confirms no remaining references to the deleted `Event` model or `EventType` enum.

---

## Edge cases

- **PRIVATE_WALK requests:** `Request` rows with `type = 'PRIVATE_WALK'` have `eventId = null`. The migration must not attempt to populate `expeditionId` for them; they must remain null.
- **Walk with multiple guides in existing data:** The current `_EventToTeamMember` join table may have more than one row per WALK event. The migration picks one deterministically (`MIN(teamMemberId)`) and discards the rest. Any walk with multiple guides in existing data silently loses the extra guides — verify seed data before running in production.
- **Walk with no guide in existing data:** If a WALK event has no row in `_EventToTeamMember`, the migration will fail the `guideId NOT NULL` constraint. Ensure all walk seed rows have at least one guide entry before migrating.
- **Empty Ticket / CartItem tables:** Zero rows in dev. The column rename steps must still succeed.
- **Prisma join table naming for Expedition M2M:** Implicit M2M tables are named `_AToB` with A and B in alphabetical model-name order. `Expedition` < `TeamMember` alphabetically → likely `_ExpeditionToTeamMember`. Confirm against the actual generated migration SQL before hardcoding.
- **`EventStatus` enum retained:** Must not be dropped — both `Walk` and `Expedition` reference it.

---

## Error cases

- Migration fails mid-execution (FK violation, constraint error) → the wrapping transaction rolls back; `"Event"` remains intact; re-running the migration is safe.
- `pnpm build` fails if any file still imports `Event` or `EventType` → treat as a blocker; clear all references before considering the migration complete.

---

## Out of scope

- Public-facing walk or expedition pages.
- Purchase flow UI changes (FK rename is done; purchase routes are not built yet).
- Any Django work (depends on this spec but is a separate spec).
