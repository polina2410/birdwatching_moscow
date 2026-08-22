# Spec: POST /api/requests

## What to build

A single public API route that accepts join requests for expeditions and private walks.  
No authentication required. No design work involved.

---

## Background

The `Request` Prisma model already exists and has no pending migrations.  
The `RequestType` (`EXPEDITION` | `PRIVATE_WALK`) and `RequestStatus` (`NEW` | `WAITLIST`) enums are live.  
The admin panel already lists and manages requests via Server Actions.

**Deliberate omission:** the roadmap's "phone" field is not in the schema and is not added here. A migration can add it in a later spec if needed.

---

## Endpoint

```
POST /api/requests
Content-Type: application/json
Auth: none (public)
```

### Request body — EXPEDITION

```json
{
  "type": "EXPEDITION",
  "expeditionId": "<uuid>",
  "name": "Полина Смехова",
  "email": "polina@example.com",
  "message": "Хочу присоединиться к экспедиции"
}
```

`message` is optional for EXPEDITION requests.

### Request body — PRIVATE_WALK

```json
{
  "type": "PRIVATE_WALK",
  "name": "Иван Иванов",
  "email": "ivan@example.com",
  "message": "Хочу организовать прогулку для группы"
}
```

`expeditionId` must NOT be present (or must be `null`/`undefined`) for PRIVATE_WALK.  
`message` is required for PRIVATE_WALK (the only contact channel available).

### Success response — 201

```json
{ "id": "<uuid>" }
```

---

## Validation rules (Zod — add to `lib/validation/requests.ts`)

| Field        | Rule                                                                 |
|--------------|----------------------------------------------------------------------|
| `type`       | `z.enum(['EXPEDITION', 'PRIVATE_WALK'])`                            |
| `expeditionId` | required + valid UUID when `type === 'EXPEDITION'`; must be absent or null for `PRIVATE_WALK` |
| `name`       | string, 1–100 chars                                                  |
| `email`      | valid email format, ≤ 254 chars                                      |
| `message`    | string ≤ 2000 chars; optional for EXPEDITION, required for PRIVATE_WALK |

Use a Zod discriminated union keyed on `type`.

---

## Business logic (`app/api/requests/route.ts`)

1. Parse and validate body with the Zod schema → 400 on failure with `{ error: string }`.
2. If `type === 'EXPEDITION'`:  
   a. Look up the expedition by `expeditionId`.  
   b. If not found → 404 `{ error: "Expedition not found" }`.  
   c. If found but `status !== 'ACTIVE'` → 404 (treat unpublished/cancelled/deleted as not found; do not leak existence).
3. Create `Request` row with `status: 'NEW'`.
4. Return 201 `{ id }`.

No rate limiting in this spec (added later with other routes if needed).

---

## Files to create / modify

| Path | Action |
|------|--------|
| `lib/validation/requests.ts` | New — Zod schema exported as `requestBodySchema` |
| `app/api/requests/route.ts` | New — route handler |
| `__tests__/api/requests.test.ts` | New — tests (written before implementation) |
| `dev/roadmap.md` | Update — mark all features already completed in `features-history.md` as done |

No schema migration required.

### Roadmap update scope

Cross-reference `dev/features/features-history.md` against `dev/roadmap.md` and mark each completed item inline (e.g. prepend `~~` strikethrough or a `✓` marker, whichever is consistent). Completed features as of this spec:

- Database schema (schema-spec)
- Authentication (auth-spec)
- Admin panel CRUD
- Walk / Expedition schema split
- Next.js admin panel (replaces Django admin)
- Passwordless OTP login
- Admin first-login password setup
- YooKassa payment integration

This is a documentation-only change — no code, no tests needed for it.

---

## Success criteria

Each criterion maps to at least one test. All must pass (`pnpm test:run`) before the feature is complete.

1. `POST /api/requests` with a valid EXPEDITION body and an ACTIVE expedition → 201 `{ id }`, record in DB with `type='EXPEDITION'`, `status='NEW'`, correct `expeditionId`.
2. `POST /api/requests` with a valid PRIVATE_WALK body → 201 `{ id }`, record in DB with `type='PRIVATE_WALK'`, `status='NEW'`, `expeditionId=null`.
3. `POST /api/requests` with `type=EXPEDITION` and no `expeditionId` → 400 (Zod error).
4. `POST /api/requests` with `type=EXPEDITION` and a non-existent `expeditionId` → 404.
5. `POST /api/requests` with `type=EXPEDITION` and an expedition whose `status !== 'ACTIVE'` (e.g., DRAFT) → 404.
6. `POST /api/requests` with a missing required field (`name`, `email`) → 400
7. `POST /api/requests` with an invalid email format → 400. useLooksLikeEmail hook to check
8. `POST /api/requests` with `name` exceeding 100 chars → 400.
9. `POST /api/requests` with `type=PRIVATE_WALK` and no `message` → 400.
10. `POST /api/requests` with `type=PRIVATE_WALK` and an `expeditionId` supplied → 400 (discriminated union rejects it).
11. `pnpm test:run` passes.
12. `pnpm build` passes with zero TypeScript errors.

---

## Edge cases (must be covered by tests or explicit code)

- `message` present but empty string on EXPEDITION → treated as no message (coerce with `.optional()` or `.transform`)
- `expeditionId` is a valid UUID string but references no row → 404 (not 500)
- CANCELLED expedition → same 404 response as not found; do not distinguish
- Concurrent duplicate submissions (same person, same expedition) → both succeed; deduplication is the admin's job
