# Test Action

1. Read `context/features/current-feature.md` — verify Status is "In Progress". If not, error: "No feature is in progress. Run /feature load and /feature start first."
2. Run `git diff main...HEAD --name-only` to get the list of files changed in this feature. Pass this list to the `coverage` agent to identify uncovered functions and branches within these files — not just files with zero coverage, but any testable logic that lacks coverage.
3. For uncovered functions and branches with testable logic, use the `test-master` skill to write unit tests:
    - Focus on server actions and utilities (not components)
    - Test happy path and error cases
    - Do not write tests just to write them. Use your best judgment
4. Run `pnpm test:run` to verify all tests pass
5. If new tests were written, stage and commit them:
    ```
    git add __tests__/
    git commit -m "test: coverage tests for <feature-name>"
    ```
   If the coverage agent found no gaps and no tests were written, skip this step.

**Next step:** optionally run `/feature explain` to document what changed, then run `/feature complete` to create the PR.