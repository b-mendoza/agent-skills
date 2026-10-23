# describe-when-to-use

> Current-state authoring reference; update when these package conventions change.

Tier: mandatory; word-form preferences for new names are recommended.

Use when creating or changing a skill's routing description or a skill/subagent name.

## Name

A skill's frontmatter `name` equals its directory name; a subagent's equals its file basename. Use kebab-case: lowercase letters, digits, and single hyphens, none leading, trailing, or doubled. Limits, reserved words, and portable fields live in the [runtime matrix](./runtime-portability-matrix.md).

For new names, prefer a gerund for a skill and a role noun for a subagent when natural; use a noun phrase when clearer. Never rename an established name for style alone.

## Description

Write in third person, opening with the observable action and object, then `Use when` triggers in users' words. Cover noun and verb variants and relevant contexts, including requests that do not name the domain. Keep positive qualifiers that affect routing, such as "one pull request," "read-only," or "after the user asks, in words, to commit." Omit subagent counts, retry caps, phases, and output schemas; be as short as precision allows.

Behavioral limits belong in the body. Sharpen positive scope before adding exclusions; only add an out-of-scope request clause after an observed should-not-trigger near-miss false-triggers. Name the request, never a sibling skill, under the [packaging rule](./keep-skills-self-contained.md).

The [Agent Skills description guide](https://agentskills.io/skill-creation/optimizing-descriptions), checked 2026-10-22, supports user-intent framing, explicit contexts, and clarifying boundaries after observed false triggers. [Anthropic's authoring guide](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), checked 2026-10-22, requires third person because descriptions enter the system prompt. Use third person for the capability, such as "Creates," and the imperative `Use when` for invocation guidance.

Test should-trigger phrasings and should-not-trigger near-misses, marking each near-miss `not this skill` or `no skill`. A table records intended routes; [observed runtime routing](./validate-by-observation.md) proves them.

## Example

For `skills/committing-scoped-changes/SKILL.md`, unlike a vague "helps with commits" description:

```yaml
---
name: "committing-scoped-changes"
description: "Creates reviewable atomic git commits from an explicit list of files or folders after the user asks, in words, to commit. Use when the user says commit these files, commit only src/x, split my changes into atomic commits, commit the ticket work, or keep unrelated work out of the commit."
---
```

| User phrasing | Expected route |
| --- | --- |
| Commit only the checkout files | `committing-scoped-changes` |
| Open a PR for this branch | `not this skill` |
| Amend the last commit with this fix | `no skill` |
