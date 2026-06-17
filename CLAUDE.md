# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev             # Start development server
pnpm build           # Production build
pnpm lint            # Run ESLint
pnpm test            # Run Vitest in watch mode
pnpm test:run        # Run Vitest once (CI)
pnpm exec vitest run __tests__/hooks/useQuiz.test.ts  # run a single test file
```

## Code Style

- Always use TypeScript — no `any` types, use `unknown` or proper generics
- Prefer named exports over default exports
- Use `const` arrow functions for components
- No magic numbers — extract named constants

### Frontend

- Styles via plain CSS or CSS Modules (`.module.css`) — no inline styles
- **Mobile-first** — write base styles for mobile, layer up with `min-width` media queries; never start from desktop and override down
- **Prefer CSS over JS** — implement visual behavior (layout, animation, transitions, hover/focus states, show/hide, responsive) with CSS where the feature has solid support in modern Chrome, Safari, and Yandex Browser; only use JS/Framer Motion when CSS cannot express the behavior or browser support is insufficient
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
- Test custom hooks and utils — not component internals
- Always test happy path + at least one error case
- Run `pnpm test:run` before marking any work complete

## Git

- Branch names: `kebab-case` derived from feature name
- Never force-push main
- Commit messages: imperative mood, under 72 chars
- Never commit `.env` or secrets
- Always confirm with the user before destructive git commands