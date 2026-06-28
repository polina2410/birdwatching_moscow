# Start Action

1. Read `context/features/current-feature.md` — check Status and Goals
2. If Status is already "In Progress", error: "Feature already started. Run /feature implement to continue, or reset current-feature.md manually if you need to restart."
3. If Goals are empty, error: "Run /feature load first"
4. Extract the feature name from the H1 heading (e.g. `# Current Feature: signup-form` → `signup-form`). Determine the test source:
   - If `context/specs/<feature-name>/spec.md` exists: read its **Success criteria** section — this drives the tests
   - If only `context/specs/<feature-name>/story.md` exists: read its **Acceptance criteria** section — this drives the tests
   - If neither exists (inline load): tests will be derived from the **Goals** in `current-feature.md` — no file to read
5. Check whether the branch named `<feature-name>` already exists locally or on origin:
   - `git branch --list <feature-name>` — local check
   - `git ls-remote --heads origin <feature-name>` — remote check
   - If either returns output, error: "Branch <feature-name> already exists (locally/on origin). Delete it first or switch to it manually."
6. Ensure the working tree is clean: run `git status` — if there are uncommitted changes, stash or commit them before switching branches. Then ensure the current branch is `main`: `git checkout main && git pull`. This guarantees the feature branch diverges from the latest main, not from an unrelated branch.
7. Create and checkout the feature branch: `git checkout -b <feature-name>` — use the feature name extracted in step 4 (already kebab-case, matches the spec directory)
8. Set Status to "In Progress"
9. State explicitly: "Writing tests for [feature]. Not writing any implementation yet."
10. Write failing tests for all success criteria / goals:
    - If spec exists: derive from the **Success criteria** section of `spec.md`
    - If only story.md exists: derive from the **Acceptance criteria** section of `story.md`
    - If neither exists (inline load): derive from the **Goals** listed in `current-feature.md`
11. Run `pnpm test:run` — confirm every newly added test is **red**. Pre-existing failures in unrelated tests are expected; focus only on the tests written in step 10. A new test that passes before any implementation is broken — fix it before continuing.
12. Stage and commit the test files:
    ```
    git add __tests__/
    git commit -m "test: failing tests for <feature-name>"
    ```
13. **Stop here.** Output: "Tests committed. Review them, then run `/feature implement` to proceed."