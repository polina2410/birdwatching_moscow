# Start Action

1. Read `context/features/current-feature.md` — verify Goals are populated
2. If empty, error: "Run /feature load first"
3. Extract the feature name from the H1 heading (e.g. `# Current Feature: signup-form` → `signup-form`). Read `context/specs/<feature-name>/spec.md` if it exists — the **Success criteria** section drives the tests
4. Set Status to "In Progress"
5. Create and checkout the feature branch — use the feature name extracted in step 3 (already kebab-case, matches the spec directory)
6. State explicitly: "Writing tests for [feature]. Not writing any implementation yet."
7. Write failing tests for all goals:
   - If spec exists: derive from the **Success criteria** section of `spec.md`
   - If no spec (inline load): derive from the Goals listed in `current-feature.md`
8. Run `pnpm test:run` — confirm every new test is **red**. A test that passes before any implementation is broken — fix it before continuing
9. Commit: `git commit -m "test: failing tests for <feature-name>"`
10. **Stop here.** Output: "Tests committed. Review them, then run `/feature implement` to proceed."