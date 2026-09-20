# describe-when-to-use

📝 Write each skill's `description` as its routing classifier: third person, action and object first, explicit `Use when` triggers, and named exclusions for sibling skills.

🔒 This rule is `mandatory`: a miss is a material gap unless the skill names the rule and the reason for the exception in its `SKILL.md`.

The description is the only signal the runtime has when it decides whether to load a skill; every line of the body loads after that decision, so nothing inside the file compensates for a description that undersells or oversells its scope. A false negative hides the capability; a false positive loads irrelevant instructions and can route a mutating request into the wrong workflow.

Open with the observable operation and its target ("Reviews one pull request", "Creates reviewable atomic git commits"), then `Use when` clauses in the words users actually say, covering noun and verb variants. Keep only detail that changes dispatch: boundaries such as "exactly one PR" or "after the user asks, in words, to commit" stay; subagent counts, retry caps, phases, and output schemas go. Where a sibling shares nouns, name the near-miss and its owner ("Does not open pull requests (use pr-creator)") so the two descriptions partition the territory. Make it as short as precision allows; the length cap is owned by [runtime-portability-matrix](./runtime-portability-matrix.md).

Test both sides of the boundary with should-trigger phrasings and should-not-trigger near-misses, each near-miss naming the expected sibling or `no skill`. A table of phrasings records intent; observed routing through the runtime is evidence and is owned by [validate-by-observation](./validate-by-observation.md). The `name` field is owned by [name-matches-directory](./name-matches-directory.md).

## Examples

```yaml
# ❌ no action boundary, no user vocabulary, no exclusions — collides with creation and reply workflows
description: "Helps users with pull requests, reviews, and GitHub comments using a thorough multi-step workflow."
```

```yaml
# ✅ action and object first, Use when in user words, dispatch-relevant boundary, siblings named
description: "Creates reviewable atomic git commits from an explicit list of files or folders after the user asks, in words, to commit. Use when the user says commit these files, commit only src/x, split my changes into atomic commits, commit the ticket work, or keep unrelated work out of the commit. Shows the exact commit plan for approval before any commit and preserves unrelated staged and unstaged work. Does not push, amend, or rewrite history. Does not open pull requests (use pr-creator). Does not summarize recent project state (use analyzing-recent-project-state)."
```

```markdown
<!-- ✅ boundary tests kept next to the description -->
| User phrasing | Expected route |
| --- | --- |
| "Commit the checkout changes in src/checkout" | `committing-scoped-changes` |
| "Commit only the JNS-6880 files and leave the rest unstaged" | `committing-scoped-changes` |
| "Open a PR for this branch" | `pr-creator` |
| "Amend the last commit with this fix" | no skill |
```

## Related rules

- [name-matches-directory](./name-matches-directory.md)
- [runtime-portability-matrix](./runtime-portability-matrix.md)
- [validate-by-observation](./validate-by-observation.md)
