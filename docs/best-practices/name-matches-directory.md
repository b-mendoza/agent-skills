# name-matches-directory

📝 Set a skill's frontmatter `name` to its directory name and a subagent's `name` to its file basename, in kebab-case, whenever you create or rename either file.

🔒 This rule is `mandatory`: a miss is a material gap unless the skill names the rule and the reason for the exception in its `SKILL.md`.

Runtimes look a skill up by `name`. When `skills/orchestrating-workflow/SKILL.md` declares `name: "OrchestratingJiraWorkflow"`, dispatch fails on the runtime that enforces identity and silently degrades on the one that does not, so the package works where it was authored and breaks on the other target. Identity between directory, basename, and frontmatter removes the whole class of bug. Names are kebab-case: lowercase letters, digits, and single hyphens, none leading, trailing, or doubled. Length caps, reserved words, the portable field set, and `skills-ref validate` (run it when available) are owned by [runtime-portability-matrix](./runtime-portability-matrix.md).

Word form is a preference at naming time only. Prefer a gerund for a new skill when it reads naturally (`analyzing-data`, `orchestrating-workflow`) and a role noun for a subagent (`ticket-fetcher`, `artifact-validator`); take a noun phrase when it is the clearer name (`pr-creator`, `recency-guard`). An established name is never renamed for style: the rename breaks user habits, external references, and dispatch strings for no behavioral gain. What the `description` says is owned by [describe-when-to-use](./describe-when-to-use.md).

## Examples

```yaml
# ❌ skills/review-pull-request/SKILL.md — name fights the directory and the shape rule
---
name: "ReviewPR"
description: "Review one pull request ..."
---
```

```yaml
# ✅ skills/review-pull-request/SKILL.md
---
name: "review-pull-request"
description: "Review one pull request ..."
---
```

```yaml
# ✅ skills/review-pull-request/subagents/chunk-reviewer.md
---
name: "chunk-reviewer"
description: "Review one assigned dimension of the PR for evidence-backed findings."
---
```

```markdown
<!-- ❌ new names that fight the filesystem -->
skills/do_jira_work/subagents/ValidatingArtifacts.md

<!-- ✅ new skill as a gerund, subagent as a role noun, established noun phrase kept -->
skills/orchestrating-workflow/subagents/ticket-fetcher.md
skills/pr-creator/SKILL.md
```

## Related rules

- [runtime-portability-matrix](./runtime-portability-matrix.md)
- [describe-when-to-use](./describe-when-to-use.md)
