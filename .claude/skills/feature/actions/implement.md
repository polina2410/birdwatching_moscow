# Implement Action

Assumes `/feature start` has already run: failing tests exist and are committed.

1. Read `context/features/current-feature.md` — verify Status is "In Progress"
2. Run `pnpm test:run` — confirm the failing tests from the checkpoint are still red. If any pass already, investigate before proceeding
3. Implement each goal / success criterion using the minimum code needed to pass the tests. For each:
   - Write implementation code
   - Run `pnpm test:run` — iterate until green
   - **Never modify a test to make it pass — fix the implementation instead**
4. Once all tests pass, refactor if needed — run `pnpm test:run` after each change to stay green

## Quality Gate (run after all goals implemented)

5. Run `pnpm lint` — fix any errors before continuing
6. Run `pnpm test:run` — all tests must be green
7. Run `pnpm build` — fix any TypeScript or Next.js compilation errors before continuing
8. If the feature adds or modifies any UI components or pages — use the `ui-reviewer` agent to check the UI visually
9. If the feature touches interactive elements, forms, or navigation — use the `a11y` agent to audit keyboard navigation and ARIA patterns
10. If the feature adds or modifies any file in `app/api/` — use the `api` agent to verify route design, error shapes, and Zod validation
11. Only proceed to Validate when all checks pass

## Validate

12. Extract the feature name from `current-feature.md` H1 (e.g. `# Current Feature: signup-form` → `signup-form`).
    - If `context/specs/<feature-name>/spec.md` exists: find the **Success criteria** section and map each criterion to the test that proves it
    - If only `context/specs/<feature-name>/story.md` exists: find the **Acceptance criteria** section and map each criterion to the test that proves it
    - If neither exists (inline load): map each Goal from `current-feature.md` to the test that proves it

13. Output a validation table:

| Success criterion | Test file | Status |
|-------------------|-----------|--------|
| `<criterion>` | `__tests__/...` | ✅ / ❌ |

14. If any criterion is ❌ (no test covers it): announce which criteria are uncovered and proceed to address each with the TDD cycle below — do not advance to `/feature test` until every criterion maps to a passing test. The `/feature test` action fills *line coverage gaps*, not missing spec coverage; a ❌ criterion requires a new failing test written here in the TDD cycle. For each such test:
    - Write the failing test
    - Run `pnpm test:run` — confirm it is **red**
    - Stage and commit: `git add __tests__/ && git commit -m "test: failing tests for <criterion>"` — this is a required TDD checkpoint
    - Implement until green — run `pnpm test:run` after each change to confirm — then move to the next criterion

15. After all ❌ criteria are resolved, re-run the full quality gate on the new code:
    - Run `pnpm lint` — fix any errors before continuing
    - Run `pnpm test:run` — all tests must be green
    - Run `pnpm build` — fix any TypeScript or Next.js compilation errors before continuing
    - If the fix added or modified UI components or pages — use the `ui-reviewer` agent
    - If the fix touched interactive elements, forms, or navigation — use the `a11y` agent
    - If the fix added or modified any file in `app/api/` — use the `api` agent

16. Re-output the validation table to confirm every criterion is now ✅. If any criterion is still ❌, return to step 14 and repeat the TDD cycle for the remaining uncovered criteria. Do not advance until the table is all green.

**Next step:** once all criteria are ✅, run `/feature test` to fill any remaining line-coverage gaps.