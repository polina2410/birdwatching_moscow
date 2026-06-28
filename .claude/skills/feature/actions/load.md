# Load Action

1. Read `context/features/current-feature.md`. If Status is "In Progress", error: "A feature is already in progress. Complete or reset it before loading a new one."

2. Check $ARGUMENTS (after "load"):
    - If it looks like a feature name (single word or kebab-case, no spaces): look for `context/specs/<feature-name>/spec.md` and `context/specs/<feature-name>/story.md`
        - If `spec.md` exists: proceed using `spec.md`
        - If only `story.md` exists (spec not yet generated): proceed using `story.md` — note to the user that `spec.md` hasn't been produced yet; running the BA agent to produce it will give more precise success criteria, but `/feature start` can proceed using the story's acceptance criteria as a substitute
        - If neither file exists: error — "No spec found at context/specs/<feature-name>/. Run the BA agent first, or use an inline description: /feature load <description>"
    - If it's multiple words (inline description): derive a kebab-case feature name by lowercasing and hyphenating the key noun/concept words — drop leading action verbs (add, implement, create, update, fix, build) and skip articles/prepositions (a, an, the, for, to, of). Use 2–4 words. Examples: "add bird photo gallery" → `bird-photo-gallery`; "fix login redirect for guests" → `login-redirect-guests`. No spec file will exist for this feature.
    - If empty: error — "load" requires a spec name or inline feature description

3. Update `context/features/current-feature.md`:
    - Update H1 heading to `# Current Feature: <feature-name>` using the derived kebab-case name — this ensures the branch name in `/feature start` matches
    - Write goals as bullet points under `## Goals`:
        - If `spec.md` exists: derive from its success criteria
        - If only `story.md` exists: derive from its acceptance criteria
        - If inline description: generate goals from the description
    - Under `## Notes`:
        - If `spec.md` exists: add `**Spec:** context/specs/<feature-name>/spec.md`
        - If only `story.md` exists: add `**Story:** context/specs/<feature-name>/story.md`
        - If inline description: omit the reference line entirely
    - Set Status to "Not Started"

4. **Stop here.** Output: "Feature loaded: <feature-name>. Goals written to current-feature.md. Run `/feature start` when ready to create the branch and write failing tests."

Do NOT proceed to branch creation or test writing. Wait for the user to explicitly run `/feature start`.