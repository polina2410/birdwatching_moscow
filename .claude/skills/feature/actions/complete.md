# Complete Action

1. Ensure all feature changes are committed on the feature branch — stage and commit any remaining changes with a descriptive message
2. Push the feature branch to origin: `git push -u origin <branch>`
3. Create a pull request: `gh pr create --title "<feature name>" --body "<goals summary>"`
4. Output the PR URL and **stop** — the human merges the PR on GitHub

## Post-merge clean-up (run after PR is merged)

5. `git checkout main && git pull`
6. Delete the local feature branch: `git branch -d <branch>`
7. Reset `context/features/current-feature.md`:
    - Change H1 back to `# Current Feature`
    - Clear Goals and Notes sections (keep placeholder comments)
    - Add feature summary to the END of `context/features/features-history.md`
8. Commit: `git commit -m "chore: reset current-feature.md after completing [feature]"`
9. Push main: `git push`
10. If feature branch still exists on origin: `git push origin --delete <branch>`