# Features History

<!-- Completed features are appended here by /feature complete -->

## Globe Interactivity

**Branch:** 
**Completed:** 

### Goals


### Summary

---

## Add Database Schema

**Branch:** add-database-schema
**Completed:** 2026-05-31

### Goals

- `prisma/schema.prisma` — all entities, enums, relations, and indexes
- `prisma/migrations/` — initial migration via `prisma migrate dev --name init`, including raw SQL for partial email index and CHECK constraints
- `prisma/seed.ts` — sample walks, expeditions (with days + guides), and team members
- `lib/constants.ts` — shared field-length and range constants (used by both Zod and Prisma)

### Summary

Implemented the full Prisma data layer. Schema covers all entities with proper relations and enums. Eight CHECK constraints and a partial unique index on `User.email` are applied via raw SQL in the migration (Prisma can't express them in schema). Money stored as integer kopecks. Seed populates walks, expeditions with days and guides, and team members.
