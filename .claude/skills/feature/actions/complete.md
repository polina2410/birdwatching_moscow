# Complete Action

## Part 1 — Create PR

1. Read `context/features/current-feature.md` — verify Status is "In Progress". If not, error: "No feature is in progress. Run /feature load and /feature start first."
2. Verify spec coverage before creating the PR. Extract the feature name from the H1 heading and determine the source document:
   - If `context/specs/<feature-name>/spec.md` exists: read its **Success criteria** section
   - If only `context/specs/<feature-name>/story.md` exists: read its **Acceptance criteria** section
   - If neither exists (inline load): use the **Goals** from `current-feature.md`
   Map each criterion/goal to at least one test file in `__tests__/`. If any criterion is ❌ (no test covers it), stop: "Run `/feature implement` first — the following criteria are uncovered: <list>. Do not create a PR until all criteria are ✅."
3. Run `git status` — review every uncommitted file. Stage and commit only intentional feature files; skip debug files, local config, or anything unrelated to this feature. If there are changes to commit:
    ```
    git add <file1> <file2> ...
    git commit -m "<type>: <brief description>"
    ```
    Use conventional commits (`feat` for new functionality, `fix` for bug corrections, `chore` for non-feature housekeeping); stage specific files with `git add` rather than `git add .`. If there is nothing to commit, skip this step.
4. Run `pnpm lint` — fix any errors before continuing.
5. Run `pnpm test:run` — all tests must be green before proceeding. Fix any failures before continuing.
6. Run `pnpm build` — fix any TypeScript or Next.js compilation errors before continuing.
7. Push the feature branch to origin: `git push -u origin <feature-name>`
8. Extract the feature name from `current-feature.md` H1 (e.g. `# Current Feature: signup-form` → `signup-form`). Gather PR body content:
   - Run `git diff main...HEAD --name-only` — list changed files
   - Run `git log main...HEAD --oneline` — list commits (includes the failing-tests checkpoint)
   - Identify test files added in this feature from `__tests__/`
   - Check which source document exists:
     - **If spec.md exists**: read it to extract Goal and success criteria for the PR body
     - **If only story.md exists**: read it to extract Goal and acceptance criteria; use acceptance criteria as success criteria in the PR body
     - **If neither exists (inline load)**: use the Goals from `current-feature.md`; omit any document reference from the PR body
9. Create the PR:

**With spec:**
```
gh pr create --title "<feature name>" --body "$(cat <<'EOF'
## Goal
<one-sentence goal from spec.md>

## Spec
`context/specs/<feature-name>/spec.md`

## Success criteria
- [ ] <criterion 1 from spec>
- [ ] <criterion 2 from spec>
- [ ] <edge/error case from spec>

## Test evidence
| Criterion | Test file |
|-----------|-----------|
| <criterion> | `__tests__/...` |

## Files changed
<list from git diff>

## Commits
<list from git log>
EOF
)"
```

**With story (story.md-only load):**
```
gh pr create --title "<feature name>" --body "$(cat <<'EOF'
## Goal
<one-sentence goal derived from story.md>

## Story
`context/specs/<feature-name>/story.md`

## Success criteria
- [ ] <acceptance criterion 1 from story>
- [ ] <acceptance criterion 2 from story>

## Test evidence
| Criterion | Test file |
|-----------|-----------|
| <criterion> | `__tests__/...` |

## Files changed
<list from git diff>

## Commits
<list from git log>
EOF
)"
```

**Inline load (no source document):**
```
gh pr create --title "<feature name>" --body "$(cat <<'EOF'
## Goal
<derived from Goals in current-feature.md>

## Success criteria
- [ ] <goal 1>
- [ ] <goal 2>

## Test evidence
| Criterion | Test file |
|-----------|-----------|
| <criterion> | `__tests__/...` |

## Files changed
<list from git diff>

## Commits
<list from git log>
EOF
)"
```

10. Output the PR URL — **"Merge this PR on GitHub, then tell me when it's done."**

---

## Part 2 — Post-merge cleanup (run after human confirms merge)

11. `git checkout main && git pull`
12. Delete the local feature branch: `git branch -d <feature-name>`. If this fails (squash-merged branches are not recognised as merged by git), use `git branch -D <feature-name>` to force-delete — this is safe since the PR is already merged.
13. Reset `context/features/current-feature.md`:
    - Change H1 back to `# Current Feature`
    - Status back to "Not Started"
    - Clear Goals and Notes sections (keep placeholder comments)
    - Restore the `## History` section to its placeholder comment only — clear anything that was added there
14. Add a one-line summary to the END of `context/features/features-history.md`:
    - If spec exists: use the PR title or the Goal line from `context/specs/<feature-name>/spec.md`
    - If only story.md exists: use the PR title or a summary derived from `context/specs/<feature-name>/story.md`
    - If neither exists (inline load): use the PR title or the Goals from `current-feature.md`
15. Stage and commit the cleanup files — the path depends on whether main allows direct pushes:
    - **If direct push to main is allowed:**
      ```
      git add context/features/current-feature.md context/features/features-history.md
      git commit -m "chore: post-merge cleanup for <feature>"
      git push
      ```
    - **If the repo enforces branch protection (PRs required):** commit on a cleanup branch so the local main is never ahead of origin:
      ```
      git checkout -b chore/reset-<feature>
      git add context/features/current-feature.md context/features/features-history.md
      git commit -m "chore: post-merge cleanup for <feature>"
      git push -u origin chore/reset-<feature>
      gh pr create --title "chore: post-merge cleanup for <feature>" --body ""
      gh pr merge --squash --delete-branch
      git checkout main && git pull
      git branch -d chore/reset-<feature>
      ```
      If `git branch -d chore/reset-<feature>` fails (squash-merged branches are not recognised as merged by git), use `git branch -D chore/reset-<feature>` to force-delete — this is safe since the PR is already merged.
16. Delete the remote feature branch if it still exists on origin: `git push origin --delete <feature-name>` — if this fails because GitHub already auto-deleted the branch on merge, skip this step.