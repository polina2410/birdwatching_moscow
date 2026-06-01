# Implementation Task: Database Schema

## What to build

Implement this data model as a Prisma schema for PostgreSQL, then generate the initial migration and a seed script. This document is the specification — build what it describes. Do not summarize it back; produce the actual `schema.prisma`, migration, and seed files.

## Deliverables (definition of done)

1. **`prisma/schema.prisma`** — every entity below, with the exact fields, types, relations, enums, and indexes specified. Datasource `postgresql`, generator `prisma-client-js`.
2. **Initial migration** — generated via `prisma migrate dev --name init`, committed under `prisma/migrations/`.
3. **`prisma/seed.ts`** — a seed script that inserts a few sample walks, expeditions (with days and guides), and team members, so later features have data to build against. Use placeholder content where the client's real data isn't available yet, clearly marked as placeholder.

The task is complete when `prisma migrate dev` runs cleanly against a fresh Postgres database and `prisma db seed` populates it without errors.

## Rules that must hold (read before implementing)

- **Money is integer kopecks, never floats.** Every monetary field is an `Int`. `priceKopecks: 500000` means 5000 ₽.
- **Validation lives in Zod, backstopped by the DB.** Field limits (lengths, ranges, formats) are defined once as shared constants and reused by both Zod (primary, on every API input) and Prisma/Postgres (a subset, as `@db.VarChar` and `CHECK` backstops). See **Field constraints**. Don't enforce these only in the database, and don't rely only on Zod for the money/quantity backstops.
- **Personal data stays in this database** (Russian hosting, 152-ФЗ). Do not introduce external data stores for user data.
- **Single Next.js app**, Prisma is the only data layer. No second backend.

When the spec and your prior assumptions about "the usual way" conflict, follow the spec — the invariants here are deliberate.

---

## Entities at a glance

| Entity | Role |
|---|---|
| `User` | accounts, holds role flag for admin |
| `Event` | a walk OR an expedition (single table, `type` discriminates) |
| `ExpeditionDay` | per-day schedule rows for expeditions |
| `TeamMember` | a guide; linked to events they guide |
| `Order` | one checkout; ties together payment + tickets (**walks only**) |
| `Ticket` | one purchased seat for one **walk**, owned by a user |
| `CartItem` | a held reservation for a **walk**, pre-purchase, with expiry |
| `Request` | заявка submission (private walk OR expedition inquiry), no payment |

> **Key scoping decision:** only **walks** are sold online. Expeditions are not purchasable — signup is via a `Request`. So `Order`, `Ticket`, `CartItem`, and `capacity` apply to walks only; expeditions never touch the cart/payment path.

### Field requiredness legend

Every field table below has a **Req?** column with one of three values. This distinguishes "the user must supply it" from "it's never null because the system fills it" — they are different things and map to different Prisma declarations:

- **R — Required.** Non-nullable; must be supplied at creation. Prisma: plain field (e.g. `title String`). Inserting without it is an error.
- **O — Optional.** Nullable; may be absent. Prisma: `?` (e.g. `capacity Int?`). Absence is a valid, meaningful state.
- **D — Default.** Non-nullable, but the **app or database supplies it**, not the user. Prisma: `@default(...)` or set in application logic (e.g. `status`, `createdAt`, `id`). Required in the database, not required from the caller.

When a field is **D**, the table notes say where the default comes from. Treat **R vs D** as the important distinction: both are non-null columns, but only **R** fields must appear in a create form / API payload.

---

## User

The account. Role is a simple enum, not a separate table — there are only two roles.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| email | string | R | login identifier; unique among **active** users only — see invariants. NOT a plain `@unique` |
| passwordHash | string | R | never store plaintext |
| name | string | R | |
| role | enum `USER` \| `ADMIN` | D | default `USER` |
| createdAt | timestamp | D | `@default(now())` |
| updatedAt | timestamp | D | `@updatedAt` |
| deletedAt | timestamp | O | null = active; set = soft-deleted |

**Invariants**
- Account deletion is a **soft delete** (`deletedAt` set), not a hard row removal — the user has orders and tickets that must remain referentially intact for accounting. Hard-deleting would orphan paid orders.
- **Email is unique only among active accounts**, not globally. A soft-deleted row must NOT block re-registration with the same email. Implement this as a **partial unique index** scoped to non-deleted rows — do not use Prisma's `@unique` on `email`, which would enforce global uniqueness and permanently lock the address after deletion.
    - Prisma cannot express a partial index in the schema, so declare the field as plain (non-unique) in `schema.prisma`, then add the constraint via raw SQL in the migration:
      ```sql
      CREATE UNIQUE INDEX "User_email_active_key" ON "User"("email") WHERE "deletedAt" IS NULL;
      ```
    - Application-level uniqueness checks on registration must likewise filter `deletedAt IS NULL`.
- **Re-registration creates a brand-new account.** When someone registers with an email that belongs to a soft-deleted row, insert a new `User` (new `id`); the old row stays archived and disconnected. Do not reactivate or reattach the old account — its orders/tickets remain with the archived row, and reattaching deleted history would conflict with the deletion the user requested (152-ФЗ).

---

## Event (walks + expeditions)

One table for both. A walk and an expedition share most fields; `type` discriminates, and expedition-only data lives in related rows.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| type | enum `WALK` \| `EXPEDITION` | R | |
| slug | string, unique (table-wide) | D | URL identifier for `/events/[slug]` and `/expeditions/[slug]`. App-generated at creation (not user-required in raw form — auto-derived from title if no custom slug given), then frozen. See **Slug handling** |
| title | string | R | |
| description | text | R | |
| startsAt | timestamp | R | walks sort by this |
| location | string | R | text location |
| priceKopecks | int | O | integer kopecks, never float. **Required for walks, null for expeditions** — expeditions show price as display text, not a sellable amount. Nullable at the column level; enforce "present when type=WALK" in app logic |
| capacity | int | O | **walks only**; total seats, drives cart reservation race. Null for expeditions |
| birdSpecies | text or string[] | O | list shown on detail page |
| totalSpots | int | O | **expeditions only**; total capacity, set manually by admin. Null for walks |
| spotsLeft | int | O | **expeditions only**; places remaining, edited **directly** by admin. Stored, not derived. Null for walks |
| status | enum `DRAFT` \| `ACTIVE` \| `CANCELLED` \| `DELETED` | D | default `DRAFT`. Admin-set thereafter. See **Status & lifecycle** |
| coverPhotoUrl | string | R | card + hero |
| galleryUrls | string[] | D | defaults to empty list `[]`; may be empty |
| publishedAt | timestamp | O | set when status first becomes `ACTIVE`; null while never-published. Display/sorting only — `status` drives visibility |
| publishedBy | uuid (fk → User) | O | which admin published it; null until first published |

> **Conditional requiredness (walk vs expedition):** several fields are nullable at the database level (**O**) but effectively **required for one `type`**: walks need `priceKopecks` and `capacity`; expeditions need `totalSpots` and `spotsLeft`. The database can't express "required only when type=X", so these are nullable columns with the per-type rule enforced in application/validation logic. Note this with a `// NOTE:` in the schema.

Guides are linked via a **many-to-many join to `TeamMember`** (see below), not a column here.

**Invariants**
- `capacity` is the hard ceiling **for walks**. Seats taken = sold `Ticket`s + **active** (non-expired) `CartItem`s. Expeditions do not use `capacity`; they have their own admin-maintained fields (below).
- Walks list filters `type = WALK AND status = ACTIVE AND startsAt >= now`, sorted by `startsAt`. Visibility is driven by `status`, never by `publishedAt`.
- Expeditions are never added to a cart or order. Signup happens through a `Request` (see below).
- **Expeditions have capacity but no online purchase, and it is admin-maintained, not system-computed.** The admin sets `totalSpots` (total capacity) and edits `spotsLeft` **directly** as offline bookings come in — `spotsLeft` is the stored remaining count, NOT derived from anything. The page shows "`spotsLeft` of `totalSpots` left."
- When `spotsLeft <= 0`, the expedition is full: the signup form switches to a **waiting list** (files a `Request` with `status = WAITLIST`) rather than a normal request. See `Request`.

### Status & lifecycle

Every event carries a `status`. It is admin-set (with one exception noted), defaults to `DRAFT`, and is the **single source of truth for whether an event is publicly visible** — listing/detail queries filter on it, not on `publishedAt`.

States:
- **`DRAFT`** — being prepared, not public. Default on creation.
- **`ACTIVE`** — live and public; walks are bookable. The first time an event becomes `ACTIVE`, set `publishedAt = now` and `publishedBy = current admin` (don't overwrite these on later status changes).
- **`CANCELLED`** — was live, called off. The record and its page remain (so existing ticket holders and links still resolve), but it's not bookable and not in the upcoming list.
- **`DELETED`** — soft-removed by admin. Never shown anywhere public. Allowed **only** when the event has no purchased tickets (see rule below).

"Past" / "finished" is **not a status** — it is derived from `startsAt < now`. The existing date filter already removes past events from the upcoming list, so no stored `ARCHIVED` state and no scheduled job are needed.

Rules:
- **An event with one or more purchased `Ticket`s cannot be set to `DELETED`.** Deletion is blocked while tickets exist — the admin must use `CANCELLED` instead. This prevents orphaning paid orders. Enforce in the delete action (check for tickets before allowing the transition), since the schema alone can't express it.
- **`CANCELLED` is always available**, including for events with tickets — it's the correct path when a sold-out or partially-sold event is called off. (Refund handling is a downstream concern for the orders feature, not modeled here; leave a note there.)
- **Public visibility = `status = ACTIVE`.** Every public listing/detail query must filter to `ACTIVE`. Because `DELETED`/`CANCELLED`/`DRAFT` are status values rather than a separate flag, a query that forgets this filter will leak them — so treat the status filter as mandatory on every public read.
- **Upcoming vs. past is derived from `startsAt`, not stored.** The events page shows `status = ACTIVE AND startsAt >= now`. A past-events archive view, if built, is the same query with `startsAt < now`. Nothing sets an "archived" flag and no job runs on a timer — the date is the single source of truth for whether an event has happened.

### Slug handling

The slug is in the URL permanently, so it must be stable and collision-free. Implement these rules in the create/update logic (not just the schema):

- **Generated at creation, then frozen.** When an event is created, compute its slug once and store it. **Editing the title later does NOT regenerate the slug** — the URL stays stable across title edits. The only way to change a slug is an explicit, deliberate admin action (not a side effect of editing anything else).
- **Custom override (expeditions, optionally walks).** If the admin supplies a custom slug at creation (e.g. `altay2026`), use it (after sanitizing — see below). If left blank, auto-generate from the title. This is how expeditions get clean hand-picked URLs while walks get automatic ones; it's one field with a fallback, not two code paths.
- **Auto-generation = Latin transliteration of the title.** Cyrillic title → transliterated, lowercased, spaces→hyphens, punctuation stripped (e.g. «Вечерний бердвотчинг в Покровском-Стрешнево» → `vecherniy-berdvoching-v-pokrovskom-streshneve`). Use Latin, not percent-encoded Cyrillic, so URLs stay clean when shared in messengers/email. Sanitize custom slugs the same way (lowercase, hyphenate, strip anything not `[a-z0-9-]`).
- **Table-wide uniqueness.** The slug must be unique across the **entire `Event` table**, not per-`type` — a walk and an expedition cannot share a slug, because the routing (`/events/[slug]` vs `/expeditions/[slug]`) resolves against one namespace. Enforce with the `@unique` already on the column.
- **Collision → short random suffix.** On generation, if the candidate slug already exists, append a short random token (e.g. 4 chars, `vecherniy-berdvoching-a3f9`). Prefer a random suffix over a sequential counter (`-1`, `-2`, `-3`): no counting query needed, and it doesn't leak how many similar events exist. Only add the suffix when there's an actual collision, so the first/only event of a given title keeps the clean slug.

---

## ExpeditionDay

The per-day timeline that the brief calls out as a key visual block. Walks don't use this.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| eventId | uuid (fk → Event) | R | |
| dayNumber | int | R | 1, 2, 3… |
| title | string | R | |
| description | text | R | |

Ordered by `dayNumber` within an event.

---

## TeamMember

A guide / scientist. Powers the team page, and links to the events they guide.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| name | string | R | |
| photoUrl | string | R | |
| education | text | O | may be blank for some guides |
| achievements | text | O | may be blank |
| profileLinks | json or string[] | D | defaults to empty list `[]`; ORCID, ResearchGate, etc. |
| sortOrder | int | R | fixed display order on team page (admin-set: 0, 1, 2…). Separate from `id` so reordering never touches the primary key |

**Event ↔ TeamMember** is many-to-many (a member guides many events; an event has several guides). In Prisma this is an implicit join table, or an explicit `EventGuide` table if you later need per-event guide notes.

**Invariants**
- The event detail page reads its guides through this join; the team page reads `TeamMember` directly, ordered by `sortOrder` **ascending**.
- **The team page order is fixed, not dynamic.** No customer-facing sort control, no alphabetical default — `sortOrder` ascending is the only ordering. The admin defines it by setting `sortOrder` (0, 1, 2…).
- `sortOrder` is a **separate field from the `id`**, deliberately. The `id` stays a uuid primary key; reordering changes only `sortOrder`, never the key other tables reference.
- A `TeamMember` is content, not a `User` — guides don't log in. Keep these separate.

---

## Order

One checkout attempt. The bridge between cart, payment, and tickets. This is the entity the ЮKassa webhook updates.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| userId | uuid (fk → User) | R | |
| status | enum (see below) | D | default `PENDING` |
| totalKopecks | int | R | full order total, paid entirely via ЮKassa |
| yooKassaPaymentId | string | O | ЮKassa's id; null until payment is initiated. Set during checkout, used for webhook matching |
| createdAt | timestamp | D | `@default(now())` |
| updatedAt | timestamp | D | `@updatedAt` |

**Status enum:** `PENDING` → `AWAITING_PAYMENT` → `PAID` | `FAILED` | `EXPIRED`

**Invariants**
- The order is marked `PAID` **only** by the ЮKassa webhook, never by the user's redirect back to the success page.
- Webhook handling must be **idempotent** keyed on `yooKassaPaymentId` — ЮKassa may call twice; never create duplicate tickets.

---

## Ticket

A purchased seat **for a walk**. Created when an order reaches `PAID`. Populates "Мои билеты." Expeditions are never ticketed.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| orderId | uuid (fk → Order) | R | |
| userId | uuid (fk → User) | R | denormalized for easy "my tickets" query |
| eventId | uuid (fk → Event) | R | |
| createdAt | timestamp | D | `@default(now())` |

**Invariants**
- One row per seat. Two tickets to the same walk = two rows (simpler than a quantity column when you later need per-seat state).

---

## CartItem

A held reservation for a **walk** before purchase. Server-side, with expiry — this is what the 20-minute timer actually reads. Expeditions can't be added to the cart.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| userId | uuid (fk → User) | R | |
| eventId | uuid (fk → Event) | R | |
| quantity | int | R | |
| reservedUntil | timestamp | D | set by app to now + 20 min at creation |
| createdAt | timestamp | D | `@default(now())` |

**Invariants**
- The client countdown is cosmetic; `reservedUntil` on the server is the truth. At checkout, expired items are rejected.
- Active reservation = `reservedUntil > now`. Capacity math counts only active ones.
- Expired rows free their seats — filtered lazily on read (see design constraints).

---

## Request

A заявка submission — covers **both** private-walk requests and expedition signup inquiries. No payment, no account required. Generalized from the brief's separate "private walk" form because expeditions (non-purchasable) need the same shape.

| Field | Type | Req? | Notes |
|---|---|---|---|
| id | uuid (pk) | D | `@default(uuid())` |
| type | enum `PRIVATE_WALK` \| `EXPEDITION` | R | which form it came from |
| status | enum `NEW` \| `WAITLIST` | D | default `NEW`; set to `WAITLIST` when the expedition was full at submission |
| eventId | uuid (fk → Event) | O | set for expedition inquiries; null for private walks |
| firstName | string | R | |
| lastName | string | R | |
| email | string | R | |
| message | text | R | free text: group size, location, details |
| createdAt | timestamp | D | `@default(now())` |

**Invariants**
- `EXPEDITION` requests link to the expedition via `eventId`; `PRIVATE_WALK` requests leave it null.
- This is the **only** signup path for expeditions — they never produce an `Order` or `Ticket`.
- **Waitlist is a status, not a separate table.** When someone submits the expedition form while spots remain (`spotsLeft > 0`) → `status = NEW`. When full (`spotsLeft <= 0`) → `status = WAITLIST`. Same form, same fields, different status. The admin sees both in one list, filterable, and pulls from `WAITLIST` when a spot frees up.
- `PRIVATE_WALK` requests are always `NEW` (no capacity concept for private walks).
- Status enum can grow later (`CONTACTED`, `CONFIRMED`, `CLOSED`) if the admin wants to track follow-up — `NEW` and `WAITLIST` are all that's needed now.

---

## Design constraints (these are settled — implement as stated, don't redesign)

1. **Expeditions are not purchasable.** Only walks go through cart → order → ticket. Expedition signup is a `Request` (type `EXPEDITION`). `Order`, `Ticket`, `CartItem`, and computed `capacity` are walk-only. Expeditions instead carry **admin-maintained** `totalSpots` / `spotsLeft` (`spotsLeft` edited directly as offline bookings happen). When `spotsLeft <= 0`, the signup form becomes a **waiting list** — captured as a `Request` with `status = WAITLIST`, not a separate table.
2. **Team members are a `TeamMember` table** linked many-to-many to `Event` as guides. Guides are content, not `User` accounts.
3. **Walks and expeditions share one `Event` table** with a `type` discriminator — they overlap heavily and most fields are common. Walk-only fields (`capacity`, ticketing) and expedition-only fields (`totalSpots`, `spotsLeft`, `ExpeditionDay`) are nullable/related rows.
4. **Cart expiry: lazy-on-read.** No worker job. Every capacity/cart query filters `reservedUntil > now`, so expired rows can't affect correctness; they just sit harmlessly. **Add an index on `reservedUntil`** since every such query filters on it. A nightly cleanup is a trivial later addition if dead rows ever matter.
5. **Photos: S3-compatible object storage**, referenced by URL (no schema change). Provider chosen at deploy — Yandex Object Storage, VK Cloud, or self-hosted MinIO, all S3-API. Survives redeploys, keeps the VPS disk lean, same code across providers. Verify 152-ФЗ fit and reachability before committing a provider; all three Russian options qualify.

## Field constraints (lengths, formats, ranges)

**Architecture:** define each limit **once** as a shared constant (e.g. `lib/constants.ts`), and reuse it in both the Zod input schemas and the Prisma column definitions, so the two layers can never drift. Zod is the primary gate on every API input and carries **all** of these rules (lengths, formats, ranges) with user-friendly messages. The database enforces a **subset as backstops** so data can't be corrupted by anything that bypasses the API.

**Layer responsibilities:**
- **Single-line strings** → length lives in **both**: Zod `.max(n)` + Prisma `@db.VarChar(n)`.
- **Long-form text** → `text` in the DB (no column limit); cap enforced in **Zod only**.
- **Numeric ranges** → Zod for the user-facing rule; a DB `CHECK` for the hard "must never be wrong" cases (money, quantities).
- **Formats** (email, URL, slug pattern) → **Zod only**. No regex CHECKs in Postgres.

### String lengths

| Field(s) | Max | DB            | Notes |
|---|-----|---------------|---|
| `Event.title` | 150 | VarChar(150)  | |
| `Event.slug` | 200 | VarChar(200)  | also matches `^[a-z0-9-]+$` (Zod) |
| `Event.location` | 100 | VarChar(100)  | |
| `User.name`, `Request.firstName`, `Request.lastName`, `TeamMember.name` | 50  | VarChar(50)   | |
| `User.email`, `Request.email` | 254 | VarChar(254)  | RFC max length; valid-email format in Zod |
| `coverPhotoUrl`, `galleryUrls[]` items, `TeamMember.photoUrl`, `profileLinks[]` items | 2048 | VarChar(2048) | valid-URL format in Zod |
| `Order.yooKassaPaymentId` | 100 | VarChar(100)  | format set by ЮKassa |

### Long-form text (DB stays `text`; cap in Zod only)

| Field(s) | Zod cap | Notes                               |
|---|---------|-------------------------------------|
| `Event.description`, `ExpeditionDay.description` | 1000    |                                     |
| `TeamMember.education`, `TeamMember.achievements` | 1000    |                                     |
| `Request.message` | 1000    |                                     |
| `ExpeditionDay.title` | 150     | single-line; VarChar(150) in DB too |

### Numeric ranges

| Field | Rule | DB CHECK? | Notes |
|---|---|---|---|
| `Event.priceKopecks` | `>= 0` | yes | negative price must be impossible at DB level |
| `Order.totalKopecks` | `>= 0` | yes | |
| `Event.capacity` | `>= 1` | yes | a walk with 0 capacity makes no sense |
| `Event.totalSpots` | `>= 1` | yes | expeditions |
| `Event.spotsLeft` | `>= 0` | yes | 0 = full; never negative |
| `CartItem.quantity` | `1..10` | CHECK `>= 1` | upper bound (per-order cap) in Zod; pick the real cap when building cart |
| `ExpeditionDay.dayNumber` | `>= 1` | yes | |
| `TeamMember.sortOrder` | `>= 0` | yes | |

### Formats (Zod only)

- `email` fields — valid email format.
- URL fields (`coverPhotoUrl`, `galleryUrls[]`, `photoUrl`, `profileLinks[]`) — valid URL.
- `slug` — matches `^[a-z0-9-]+$` (consistent with **Slug handling**).

> The numbers above are sensible defaults for this domain, not sacred. Adjust a limit if real content needs it — but change the **shared constant**, so Zod and Prisma move together.

## Indexes worth adding now

- `User.email` — **partial unique** index, unique only where `deletedAt IS NULL` (raw SQL in migration; see `User` invariants). Not a plain `@unique`.
- `Event`: `(type, status, startsAt)` — matches the public list query (`type = WALK AND status = ACTIVE AND startsAt >= now`, sorted by `startsAt`).
- `Event.slug` — unique **across the whole table** (both walks and expeditions share one slug namespace), for detail-page lookups.
- `CartItem.reservedUntil` — every capacity check filters on it.
- `Order.yooKassaPaymentId` — unique, for idempotent webhook matching.
- `Ticket.userId` — "Мои билеты."

---

## Build steps

1. Write `prisma/schema.prisma` from the entities and relations above, including every index in the section above.
2. Run `prisma migrate dev --name init` to generate and apply the initial migration.
3. Write `prisma/seed.ts` inserting sample walks, expeditions (with `ExpeditionDay` rows and `TeamMember` guides linked), and team members. Wire it up via the `prisma.seed` key in `package.json`.
4. Verify: `prisma migrate dev` runs clean on a fresh DB, `prisma db seed` populates without error.

## Notes for the implementer

- **Enums:** define all enums as Prisma enums: `Role`, `EventType` (`WALK`/`EXPEDITION`), `EventStatus` (`DRAFT`/`ACTIVE`/`CANCELLED`/`DELETED`), `OrderStatus`, `RequestType` (`PRIVATE_WALK`/`EXPEDITION`), `RequestStatus` (`NEW`/`WAITLIST`). Note `EventStatus` and `RequestStatus` are distinct enums — don't conflate the two `status` fields.
- **Soft delete on `User`** is a nullable `deletedAt` — there is no cascade that hard-removes a user's orders or tickets.
- **`User.email` is NOT `@unique` in the schema.** Uniqueness is enforced by a partial index (unique where `deletedAt IS NULL`) added as raw SQL in the migration — see the `User` invariants. Do not "fix" this by adding `@unique`; that would re-introduce the bug where a deleted account locks its email forever.
- **Event ↔ TeamMember** is many-to-many. Use Prisma's implicit join unless per-event guide notes are needed (they aren't yet).
- **Nullable walk/expedition fields:** `Event` holds both kinds via `type`. Walk-only fields (`capacity`) and expedition-only fields (`totalSpots`, `spotsLeft`) are nullable; don't split into two tables.
- **The `Req?` column** in each field table is authoritative for nullability: **R** → plain non-null field; **O** → nullable (`?`); **D** → non-null with `@default(...)` or app-set value. Map each field accordingly — don't make a **D** field user-required, and don't make an **R** field nullable.
- **Conditional (per-type) requiredness** on `Event` can't be a DB constraint: `priceKopecks`/`capacity` (walks) and `totalSpots`/`spotsLeft` (expeditions) are nullable columns, with "required for this type" enforced in validation logic. Leave a `// NOTE:` in the schema.
- **Field constraints** (lengths, ranges, formats) come from the **Field constraints** section. Implement string lengths as `@db.VarChar(n)`, numeric ranges marked "DB CHECK? yes" as `CHECK` constraints in the migration (Prisma can't declare CHECKs in the schema — add them via raw SQL in the migration, like the partial email index), and everything else in Zod. Define the limits as shared constants so Zod and Prisma reference the same numbers.
- If any detail genuinely isn't specified (e.g. a field length, a default), pick a sensible default and leave a `// NOTE:` comment in the schema rather than stopping to ask — these are not blocking.