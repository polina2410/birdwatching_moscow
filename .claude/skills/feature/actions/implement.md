# Implement Action

Assumes `/feature start` has already run: failing tests exist and are committed.

1. Read `context/features/current-feature.md` — verify Status is "In Progress"
2. Run `pnpm test:run` — confirm the failing tests from the checkpoint are still red. If any pass already, investigate before proceeding
3. Implement each goal using the minimum code needed to pass the tests. For each goal:
   - Write implementation code
   - Run `pnpm test:run` — iterate until green
   - **Never modify a test to make it pass — fix the implementation instead**
4. Once all tests pass, refactor if needed — run `pnpm test:run` after each change to stay green

## Quality Gate (run after all goals implemented)

5. Run `pnpm lint` — fix any errors before continuing
6. Run `pnpm test:run` — all tests must be green
7. Run `pnpm build` — fix any TypeScript or Next.js compilation errors before continuing
8. Use the `ui-reviewer` agent to check the UI visually
9. If the feature touches interactive elements, forms, or navigation — use the `a11y` agent to audit keyboard navigation and ARIA patterns
10. If the feature adds or modifies any file in `app/api/` — use the `api` agent to verify route design, error shapes, and Zod validation
11. Only report the feature as done when all checks pass

## Validate

12. Read `context/specs/<feature-name>/spec.md` — for every acceptance criterion, identify the test that proves it
13. Output a validation table:

| Acceptance criterion | Test file | Status |
|----------------------|-----------|--------|
| `<criterion>` | `__tests__/...` | ✅ / ❌ |

14. If any criterion has no corresponding test, raise it with the human — do not mark the feature done until every criterion is covered