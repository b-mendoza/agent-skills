# agent-skills — Project Instructions

## Project Overview

`agent-skills` is a skill library for coding agents. Each skill is a
self-contained directory with a `SKILL.md`, optional `subagents/` and
`references/` directories, and any supporting scripts. Skills are designed to
work across multiple runtimes; the canonical targets are **OpenCode** and
**Claude Code**, so prefer lowest-common-denominator frontmatter and
markdown — avoid runtime-specific syntax (e.g., `@path` imports) in any file
that needs to run on both.

The repo is the artifact: the codebase IS the skill definitions. Most edits
in this repo are skill or subagent authoring tasks. When that is the work,
use the routing table in `Skill-Authoring Guidance` to choose the minimum
best-practice docs to read before editing.

## Repository Layout

| Path                                     | Contents                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| [`skills/`](./skills/)                   | First-party skills authored in this repo. One directory per skill.      |
| [`docs/`](./docs/)                       | Design notes, harmonization specs, and the best-practices reference.    |
| [`docs/best-practices/`](./docs/best-practices/) | Per-topic skill-authoring guidance. See its [index](./docs/best-practices/README.md). |
| [`.agents/skills/`](./.agents/skills/)   | Vendored third-party skills. Source of truth for OpenCode discovery.    |
| [`.claude/skills/`](./.claude/skills/)   | Mirror of vendored skills for Claude Code discovery.                    |
| [`skills-lock.json`](./skills-lock.json) | Pin file for vendored third-party skills (managed by tooling).          |
| [`opencode.jsonc`](./opencode.jsonc)     | OpenCode configuration (currently MCP server registration only).        |
| [`README.md`](./README.md)               | Human-facing repo overview and skill catalog.                           |

## Skill-Authoring Guidance

When authoring or editing a skill, subagent, or reference file, read only the
docs named for your task before editing. The linked docs are the source of
truth; [`docs/best-practices/README.md`](./docs/best-practices/README.md) is
the full index for uncommon cases.

| Task | Read before editing |
| ---- | ------------------- |
| Create a new skill | [`quick-reference-skill-structure`](./docs/best-practices/quick-reference-skill-structure.md), [`structural-conventions`](./docs/best-practices/structural-conventions.md), [`naming-conventions`](./docs/best-practices/naming-conventions.md), [`identity-and-mental-model`](./docs/best-practices/identity-and-mental-model.md) |
| Restructure a large `SKILL.md` or move content into supporting files | [`progressive-disclosure`](./docs/best-practices/progressive-disclosure.md), [`template-extraction`](./docs/best-practices/template-extraction.md) |
| Add or edit a subagent | [`subagent-default-execution`](./docs/best-practices/subagent-default-execution.md), [`context-window-protection`](./docs/best-practices/context-window-protection.md), [`escalation-patterns`](./docs/best-practices/escalation-patterns.md), [`input-output-contracts`](./docs/best-practices/input-output-contracts.md) |
| Write or revise instructions, constraints, examples, or long reference files | [`positive-constraint-framing`](./docs/best-practices/positive-constraint-framing.md), [`example-strategy`](./docs/best-practices/example-strategy.md), [`instruction-reinforcement`](./docs/best-practices/instruction-reinforcement.md) |
| Add validation steps or fix loops | [`validation-loops`](./docs/best-practices/validation-loops.md), [`empirical-validation`](./docs/best-practices/empirical-validation.md) |
| Decide what artifacts to commit, keep local, or delete | [`artifact-lifecycle`](./docs/best-practices/artifact-lifecycle.md) |

## Verification

This repo currently has no automated build, lint, or test pipeline for skill
authoring. There is no skill-validator command, no formal frontmatter
schema-check, and no CI. Treat this as a known gap, not as permission to
declare work done without checks. After editing a `SKILL.md` or subagent
definition:

- Confirm the file is under the size guidance from
  [progressive disclosure](./docs/best-practices/progressive-disclosure.md)
  (`SKILL.md` under 500 lines).
- Confirm any subagent paths referenced in a registry table actually exist
  on disk.
- Confirm the YAML frontmatter `name` matches the directory or file name.
- If the skill ships a `scripts/` directory, run the script the way a
  consumer would invoke it.
- If the change touches `skills-lock.json` or vendored skills under
  `.agents/skills/` or `.claude/skills/`, confirm the change came from the
  managing tool — do not hand-edit the lockfile.

When unsure whether a change is correct, escalate to the user rather than
declaring success.

## Repo-Specific Notes

- **Dual-runtime targets.** Skills must work for both OpenCode and Claude
  Code. Avoid runtime-specific frontmatter fields and prefer plain markdown
  links over `@path` imports.
- **Auto-commit.** Edits in this repo are auto-committed with scoped
  messages. Treat this as expected workflow behavior; structure changes so
  each logical edit is a clean commit boundary.
- **Orchestration artifacts are local-only.** Files like
  `docs/<TICKET_KEY>-progress.md` or `docs/<TICKET_KEY>-tasks.md` are
  generated by the Jira workflow and must never be committed. See
  [artifact lifecycle](./docs/best-practices/artifact-lifecycle.md).
