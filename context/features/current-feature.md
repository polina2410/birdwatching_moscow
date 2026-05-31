# Current Feature

## Status
In Progress

## Goals

Implement the Prisma database schema, initial migration, and seed script as specified in [schema-spec.md](./schema-spec.md).

Deliverables:
- `prisma/schema.prisma` — all entities, enums, relations, and indexes
- `prisma/migrations/` — initial migration via `prisma migrate dev --name init`, including raw SQL for the partial email index and CHECK constraints
- `prisma/seed.ts` — sample walks, expeditions (with days + guides), and team members
- `lib/constants.ts` — shared field-length and range constants (used by both Zod and Prisma)

Done when `prisma migrate dev` runs clean on a fresh DB and `prisma db seed` populates without errors.

## Notes

- See [schema-spec.md](./schema-spec.md) for the full data model, invariants, and implementation rules.
- Money is integer kopecks throughout — no floats.
- `User.email` must NOT use `@unique` — partial unique index added via raw SQL in migration.
- All CHECK constraints (8 total) are raw SQL in the migration file; Prisma can't express them in the schema.
- `Region` enum was removed from the spec — do not implement it.
