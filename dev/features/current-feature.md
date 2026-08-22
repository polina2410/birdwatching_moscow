# Current Feature: requests-api

## Status

In Progress

## Goals

- `POST /api/requests` with valid EXPEDITION body + ACTIVE expedition → 201 `{ id }`, DB row with `type='EXPEDITION'`, `status='NEW'`, correct `expeditionId`
- `POST /api/requests` with valid PRIVATE_WALK body → 201 `{ id }`, DB row with `type='PRIVATE_WALK'`, `status='NEW'`, `expeditionId=null`
- `type=EXPEDITION` with no `expeditionId` → 400 (Zod)
- `type=EXPEDITION` with non-existent `expeditionId` → 404
- `type=EXPEDITION` with expedition whose `status !== 'ACTIVE'` → 404
- Missing required field (`name`, `email`) → 400
- Invalid email format → 400
- `name` exceeding 100 chars → 400
- `type=PRIVATE_WALK` with no `message` → 400
- `type=PRIVATE_WALK` with `expeditionId` supplied → 400 (discriminated union rejects it)
- `pnpm test:run` passes
- `pnpm build` passes with zero TypeScript errors
- `dev/roadmap.md` updated to mark all features from `features-history.md` as completed

## Notes

**Spec:** dev/specs/requests-api/spec.md
