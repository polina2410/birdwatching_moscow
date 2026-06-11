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
- Styles via CSS Modules (`.module.css`) — no inline styles, no global class strings
- No magic numbers — extract named constants

## Architecture

- Components live in `components/`
- Business logic in `lib/`
- API calls only in `lib/api/`
- Route Handlers in `app/api/`
- Custom hooks in `hooks/`
- TypeScript types in `types/`
- One component per file
- No prop drilling beyond 2 levels — use context or lift state

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