---
name: feature
description: Manage current feature workflow - start, implement, explain (optional) or complete
argument-hint: load|start|implement|test|explain|complete
---

# Feature Workflow

Manages the full lifecycle of a feature from spec to merge.

## Working File

@context/features/current-feature.md

### File Structure

current-feature.md has these sections:

- `# Current Feature` - H1 heading with feature name when active
- `## Status` - Not Started | In Progress
- `## Goals` - Bullet points of what success looks like
- `## Notes` - Additional context, constraints, or details from spec
- `## History` - Completed features (append only)

## Task

Execute the requested action: $ARGUMENTS

| Action | Description |
|--------|-------------|
| `load` | Load a feature spec or inline description |
| `start` | Create branch, write failing tests, commit checkpoint — stops for human review |
| `implement` | Implement until tests are green, run quality gate |
| `test` | Fill coverage gaps after implementation |
| `explain` *(optional)* | Document what changed and why |
| `complete` | Commit, push, merge, reset |

See [actions/](actions/) for detailed instructions.

If no action provided, explain the available options.