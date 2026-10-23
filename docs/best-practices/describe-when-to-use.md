# describe-when-to-use

📝 Write each skill's `description` as its routing classifier: third person, action and object first, then `Use when` triggers in users' words and positive scope qualifiers.

🔒 This rule is `mandatory`: a miss is a material gap unless the rule allows an exception and the change's report or handoff, outside the skill package, states the rule and reason.

The description is the only signal the runtime has when it decides whether to load a skill; every line of the body loads after that decision, so nothing inside the file compensates for a description that undersells or oversells its scope. A false negative hides the capability; a false positive loads irrelevant instructions and can route a mutating request into the wrong workflow.

Open with the observable operation and its target ("Reviews one GitHub pull request", "Creates reviewable atomic git commits"), then `Use when` clauses in the words users actually say, covering noun and verb variants. Explicitly list applicable contexts, including when users describe the need without naming the domain. Keep positive scope qualifiers that change dispatch, such as "one GitHub pull request", "after the user asks, in words, to commit", or "read-only". Subagent counts, retry caps, phases, and output schemas go. Make it as short as precision allows; the length cap is owned by [runtime-portability-matrix](./runtime-portability-matrix.md).

Do not add exclusion clauses such as "Does not…", "Runs no…", or "Not for…" by default. Behavioral limits, such as not pushing or not writing files, belong in the skill body. Make the served scope specific enough to distinguish near-miss requests. Only after an observed should-not-trigger near-miss false-triggers, with evidence owned by [validate-by-observation](./validate-by-observation.md), may a boundary be added. Sharpen the positive scope first; an out-of-scope request clause is the last resort and names the request, never a sibling skill ([keep-skills-self-contained](./keep-skills-self-contained.md)).

The [Agent Skills description guide](https://agentskills.io/skill-creation/optimizing-descriptions) recommends user-intent framing and explicit applicable contexts; it suggests boundary clarification in the optimization loop when should-not-trigger queries false-trigger (checked 2026-10-22).

Test both sides of the boundary with should-trigger phrasings and should-not-trigger near-misses, each near-miss marked `not this skill` or `no skill`. A table of phrasings records intent; observed routing through the runtime is evidence and is owned by [validate-by-observation](./validate-by-observation.md). The `name` field is owned by [name-matches-directory](./name-matches-directory.md).

## Examples

```yaml
# ❌ no specific action boundary or `Use when` triggers; collides with creation and reply workflows
description: "Helps users with pull requests, reviews, and GitHub comments using a thorough multi-step workflow."
```

```yaml
# ✅ action and object first, Use when in user words, positive scope qualifiers
description: "Creates reviewable atomic git commits from an explicit list of files or folders after the user asks, in words, to commit. Use when the user says commit these files, commit only src/x, split my changes into atomic commits, commit the ticket work, or keep unrelated work out of the commit."
```

```markdown
<!-- ✅ boundary tests kept next to the description -->

| User phrasing                                                | Expected route              |
| ------------------------------------------------------------ | --------------------------- |
| "Commit the checkout changes in src/checkout"                | `committing-scoped-changes` |
| "Commit only the JNS-6880 files and leave the rest unstaged" | `committing-scoped-changes` |
| "Open a PR for this branch"                                  | `not this skill`            |
| "Amend the last commit with this fix"                        | no skill                    |
```

## Related rules

- [keep-skills-self-contained](./keep-skills-self-contained.md)
- [name-matches-directory](./name-matches-directory.md)
- [runtime-portability-matrix](./runtime-portability-matrix.md)
- [validate-by-observation](./validate-by-observation.md)
