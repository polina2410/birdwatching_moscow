# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How We Work (read this first)

This project uses **Spec-Driven Development (SDD)** with **Test-Driven Development (TDD)** during implementation. The operating model is:

**User story → Spec → Plan → TDD per task → Validate against spec**

Plan first, code second. Review happens at **phase gates**, not on every edit. Do not jump to implementation when a feature is non-trivial — stop at each gate and wait for explicit human approval before proceeding.

### When to apply the full flow

- **Full SDD + TDD**: any feature touching more than ~2 files, anything involving data models, money/tickets, auth, or background jobs, or anything with non-obvious design decisions.
- **Lightweight (plan + TDD, skip formal spec)**: small, well-understood changes touching 1–2 files.
- **Skip the ceremony**: single-file bug fixes, formatting, copy changes, trivial CRUD. Just write the test + fix.

When in doubt, ask which mode applies before starting.

## Spec-Driven Development (SDD)

Specs are the source of truth. Code follows the plan; the plan follows the spec; the spec follows the story.

### Where artefacts live

```
context/specs/<feature-name>/
  story.md    # user story + acceptance criteria
  spec.md     # what to build, edge cases, checkable success criteria
  plan.md     # numbered, ordered implementation tasks
```

`<feature-name>` is `kebab-case` and matches the branch name.

### Phase gates (STOP for human approval at each →)

1. **Story** — write/confirm `story.md`. → **Gate 1**
2. **Spec** — write `spec.md` from the story. → **Gate 2**
3. **Plan** — break the spec into numbered tasks in `plan.md`. → **Gate 3**
4. **Implement** — work the plan one task at a time using the TDD cycle below. Human reviews per task or per logical group, not per edit.
5. **Validate** — confirm the implementation satisfies every acceptance criterion in the spec. Report which criteria are met and how (which test proves each).

Do not silently advance past a gate. Present the artefact, then wait.

### Spec quality rules

- Success criteria MUST be **checkable**, not interpretable. Good: "`pnpm test:run` passes", "endpoint returns 200 with `{ id }`", "double-booking under 50 concurrent requests is impossible". Bad: "clean code", "good performance", "works well".
- Every spec lists explicit **edge cases** and **error cases**, not just the happy path.
- A spec is not done until each acceptance criterion can be mapped to at least one planned test.

## User Stories

Every feature starts from a story in `story.md`:

```
As a <role>, I want <capability>, so that <benefit>.

Acceptance criteria:
- [ ] <checkable condition>
- [ ] <checkable condition>
- [ ] <error/edge case condition>
```

- Acceptance criteria are the bridge to the spec and the tests — write them as conditions you could verify mechanically.
- If a criterion can't be phrased as something a test could check, rewrite it until it can.

## Test-Driven Development (TDD)

TDD is **mandatory** during implementation. Claude tends to write implementation first and sometimes edits tests to make them pass — both are forbidden here. Follow this exact cycle for each task in the plan:

### The cycle (RED → GREEN → REFACTOR)

1. **Write failing tests first.** State explicitly: "Writing tests for X. Not writing the implementation yet." Derive the tests from the spec's acceptance criteria.
2. **Run them and confirm they fail** (`pnpm test:run`). A test that passes before any implementation is a broken test — fix it.
3. **Commit the failing tests as a checkpoint** before writing implementation, e.g. `git commit -m "test: failing tests for <feature>"`. This is the safety net: if tests later change, the diff shows exactly what changed and the work can be reverted.
4. **Implement until green.** Write the minimum code to pass the current tests. **Do not modify the tests** to make them pass — fix the implementation. Keep going until all tests pass.
5. **Refactor** with tests staying green. Improve readability, remove duplication, tighten types. Re-run tests after each change.

### Forbidden

- ❌ Writing implementation code before a failing test exists.
- ❌ Editing, weakening, deleting, or skipping a test to get to green — fix the code instead.
- ❌ Writing tests that assert what the code already does (tautological tests written after the fact).
- ❌ Marking a task complete with red or skipped tests.

If a test seems wrong, stop and raise it with the human rather than changing it unilaterally.

## Commands

```bash
pnpm dev             # Start development server
pnpm build           # Production build
pnpm lint            # Run ESLint
pnpm test            # Run Vitest in watch mode
pnpm test:run        # Run Vitest once (CI)
pnpm exec vitest run __tests__/lib/utils.test.ts  # run a single test file
```

## Code Style

- Always use TypeScript — no `any` types, use `unknown` or proper generics
- Prefer named exports over default exports
- Use `const` arrow functions for components
- No magic numbers — extract named constants

### Frontend

- Styles via plain CSS or CSS Modules (`.module.css`) — no inline styles
- **Mobile-first** — write base styles for mobile, layer up with `min-width` media queries; never start from desktop and override down
- **Prefer CSS over JS** — implement visual behaviour (layout, animation, transitions, hover/focus states, show/hide, responsive) with CSS where the feature has solid support in modern Chrome, Safari, and Yandex Browser; only use JS/Framer Motion when CSS cannot express the behavior or browser support is insufficient
- No prop drilling beyond 2 levels — use context or TanStack Query state
- HTTP calls only via Axios instances in a dedicated `api/` layer
- One component per file

## Architecture

- Components live in `components/`
- Business logic in `lib/`
- API calls only in `lib/api/`
- Route Handlers in `app/api/`
- Custom hooks in `hooks/`
- TypeScript types in `types/`
- Shared utility functions in `utils/`
- React context providers in `context/`
- Feature tracking in `context/features/` (`current-feature.md`, `features-history.md`)
- Specs live in `context/specs/<feature-name>/`
- One component per file
- No prop drilling beyond 2 levels — use context or lift state

## Infrastructure

Deployed on **Selectel VPS** (not Vercel/serverless). Implications:

- No function timeout constraints — long-running server tasks are fine
- **Ticket concurrency** — wrap purchases in Prisma transactions with row-level locks to prevent double-booking under simultaneous requests
- **Certificate generation (stage 2)** — implement as a background job queue (e.g. BullMQ + Redis) running as a separate process on the same VPS; do not block the HTTP response
- **Auth** — database sessions via NextAuth.js v5 (Auth.js) with the Prisma adapter (`strategy: "database"`); sessions stored in PostgreSQL for instant revocation; secrets in `.env` only, never committed

## Testing

- Tests live in `__tests__/`
- Use Vitest + Testing Library
- Test custom hooks and utils, and behaviour — not component internals
- Each acceptance criterion in the spec maps to at least one test
- Always test happy path + at least one error case
- Run `pnpm test:run` before marking any work complete

## Git

- Branch names: `kebab-case` derived from feature name (matches `context/specs/<feature-name>/`)
- Commit failing tests as their own checkpoint before implementation (`test: ...`) — see the TDD cycle
- Do not amend or overwrite a failing-test checkpoint commit during implementation; the diff is the safety net
- Never force-push main
- Commit messages: imperative mood, under 72 chars
- Never commit `.env` or secrets
- Always confirm with the user before destructive git commands