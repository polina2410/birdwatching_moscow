# Complete Action

## Part 1 — Create PR

1. Ensure all feature changes are committed on the feature branch — stage and commit any remaining changes
2. Push the feature branch to origin: `git push -u origin <branch>`
3. Gather PR body content:
   - Read `context/specs/<feature-name>/spec.md` — extract Goal and acceptance criteria
   - Run `git diff main...HEAD --name-only` — list changed files
   - Run `git log main...HEAD --oneline` — list commits (includes the failing-tests checkpoint)
   - Identify test files added in this feature from `__tests__/`
4. Create the PR:

```
gh pr create --title "<feature name>" --body "$(cat <<'EOF'
## Goal
<one-sentence goal from spec.md>

## Spec
`context/specs/<feature-name>/spec.md`

## Acceptance criteria
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

5. Output the PR URL — **"Merge this PR on GitHub, then tell me when it's done."**

---

## Part 2 — Post-merge cleanup (run after human confirms merge)

6. `git checkout main && git pull`
7. Delete the local feature branch: `git branch -d <branch>`
8. Reset `context/features/current-feature.md`:
   - Change H1 back to `# Current Feature`
   - Clear Goals and Notes sections (keep placeholder comments)
   - Status back to "Not Started"
9. Add a one-line summary to the END of `context/features/features-history.md` — use the PR title or the Goal line from `context/specs/<feature-name>/spec.md`
10. Commit: `git commit -m "chore: reset current-feature.md after completing <feature>"`
11. Push main: `git push`
12. If the feature branch still exists on origin: `git push origin --delete <branch>`