# Load Action

1. Check $ARGUMENTS (after "load"):
    - If it looks like a feature name (single word or kebab-case, no spaces): look for `context/specs/{name}/spec.md`
    - If it's multiple words: use as inline feature description, generate goals directly
    - If empty: error — "load" requires a spec name or inline feature description

2. Update `context/features/current-feature.md`:
    - Update H1 heading to `# Current Feature: <feature-name>` using the exact spec directory name (e.g. `signup-form` → `# Current Feature: signup-form`) — this ensures the branch name derived in `/feature start` matches the spec directory
    - Write goals as bullet points under `## Goals`:
        - If `story.md` exists: derive from its acceptance criteria
        - If only `spec.md` exists: derive from its success criteria
        - If inline description: generate goals from the description
    - Add under `## Notes`: `**Spec:** context/specs/<feature-name>/spec.md`
    - Set Status to "Not Started"

3. Confirm spec loaded and show the feature summary