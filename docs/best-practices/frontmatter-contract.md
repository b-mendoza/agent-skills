# frontmatter-contract

## Tier

`mandatory`. The frontmatter `name` and `description` are the runtime discovery and dispatch surface. A name that does not match its directory breaks skill lookup in runtimes that enforce identity; a vague description mis-routes every invocation decision the runtime makes. These are correctness rules, not style.

## When it applies

When creating or editing the YAML frontmatter of any `SKILL.md` or subagent file, and during every post-edit verification pass.

## The practice

### Identity rules (checkable, no exceptions)

1. **`name` exactly matches the containing directory** (for `SKILL.md`) **or the file basename** (for subagent files). `skills/orchestrating-workflow/SKILL.md` must declare `name: "orchestrating-workflow"`; `subagents/ticket-fetcher.md` must declare `name: "ticket-fetcher"`.
2. **Names are kebab-case:** lowercase letters, digits, and single hyphens; no leading, trailing, or consecutive hyphens; 64 characters or fewer. This is the portable intersection of what the targeted runtimes accept.
3. **`name` and `description` are the only required fields** in portable files. Any runtime-specific field (tool permissions, model hints, invocation controls) must be a declared runtime-specific exception per the [runtime portability matrix](./runtime-portability-matrix.md).

### Description rules

The `description` is the routing classifier: the runtime reads it to decide whether this skill matches the user's request. Author it as a contract, not a summary:

4. **Author the description as a routing classifier.** The rules for that text (third person, action-and-object first, explicit `Use when` clauses, material exclusions, and should-trigger / should-not-trigger tests) are owned by [trigger-and-description-authoring](./trigger-and-description-authoring.md); a description that skips them fails this contract.

### Verification

After any frontmatter edit, check mechanically:

- `name` equals directory (skill) or basename (subagent).
- Name satisfies the kebab-case shape rule.
- YAML parses (a malformed frontmatter block can silently degrade discovery even when direct invocation still works).
- No runtime-specific keys without a declared exception.

## Rationale

Runtimes look skills up by name and route requests by description. When `name: "OrchestratingJiraWorkflow"` sits next to a directory `orchestrating-workflow/`, dispatch fails in environments that enforce identity — and the failure is silent in environments that do not, which means the package works on the author's runtime and breaks on the other target. Forcing identity between directory, basename, and frontmatter removes the whole class of bug, which is why this rule is mandatory while the word-form preferences in [naming-conventions](./naming-conventions.md) are optional style.

The description rules exist because the description is the only signal the runtime has at routing time. Every line of a `SKILL.md` body loads _after_ the routing decision; a description that undersells or oversells the skill's scope cannot be compensated for by anything inside the file.

## Concrete examples

Good: identity matches, portable minimum, classifier-shaped description.

```yaml
---
name: "review-pull-request"
description: "Reviews exactly one GitHub pull request end-to-end and posts findings for user approval. Use when a user asks to review a PR, check a pull request, or audit proposed changes. Does not create PRs (see pr-creator) or respond to existing review comments (see responding-to-pr-review-comments)."
---
```

Bad: identity mismatch, first-person vague description, undeclared runtime-specific key.

```yaml
---
name: "ReviewPR" # does not match review-pull-request/
description: "I help you with pull requests." # routes everything and nothing
tools: [Read, Bash] # Claude-specific, no declared exception
---
```

## References

- Agent Skills specification, accessed 2026-07-22: <https://agentskills.io/specification>. Source for the portable name shape and required-field minimum; re-check before changing the rules above.
- Anthropic Agent Skills documentation, accessed 2026-09-07: <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>. Supports description-as-trigger authoring. Also sets the platform limits: `description` 1-1024 characters, no XML tags; `name` may not contain the reserved words "anthropic" or "claude".
