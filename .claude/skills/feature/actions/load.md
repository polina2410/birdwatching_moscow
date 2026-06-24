# Load Action

1. Check $ARGUMENTS (after "load"):
    - If it looks like a feature name (single word or kebab-case, no spaces): look for `context/specs/{name}/spec.md`
    - If it's multiple words: use as inline feature description, generate goals directly
    - If empty: error — "load" requires a spec name or inline feature description

2. Update `context/features/current-feature.md`:
    - Update H1 heading to include feature name (e.g., `# Current Feature: Add Navbar`)
    - Write goals as bullet points under `## Goals` (derived from spec acceptance criteria, or generated from inline description)
    - If a spec exists, add under `## Notes`: `**Spec:** context/specs/<feature-name>/spec.md`
    - Set Status to "Not Started"

3. Confirm spec loaded and show the feature summary