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
read the relevant best-practice doc before editing.

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

## Skill-Authoring Conventions

When authoring or editing a skill, subagent, or reference file, consult the
relevant doc below. The file at the link is the source of truth — the line
here is a hook, not a substitute.

- **[Progressive disclosure](./docs/best-practices/progressive-disclosure.md)** —
  Keep `SKILL.md` under ~500 lines; push mode/phase content into
  `references/` and per-subagent content into `subagents/`.
- **[Context window protection](./docs/best-practices/context-window-protection.md)** —
  Orchestrators dispatch and synthesize; subagents do the heavy reading.
  Pass file paths and summaries between steps, never raw output.
- **[Subagent-default execution](./docs/best-practices/subagent-default-execution.md)** —
  Decide inline vs. delegate per step using the two-question test, not by
  step complexity.
- **[Positive constraint framing](./docs/best-practices/positive-constraint-framing.md)** —
  Name what the agent IS allowed to do; reserve negation for safety
  boundaries. Brief in-file reminders may name forbidden tools.
- **[Instruction reinforcement](./docs/best-practices/instruction-reinforcement.md)** —
  At the top of long reference files, restate critical constraints in 1–3
  lines. Do not repeat in every file.
- **[Structural conventions](./docs/best-practices/structural-conventions.md)** —
  Skills: identity → inputs → registry → behavior → example. Subagents:
  identity → inputs → instructions → output → scope → escalation.
- **[Input and output contracts](./docs/best-practices/input-output-contracts.md)** —
  Document required inputs, output paths, and required output sections.
  Prefer URLs over pre-extracted keys as inputs.
- **[Escalation patterns](./docs/best-practices/escalation-patterns.md)** —
  Every subagent ends with explicit failure categories. Fail loudly; the
  orchestrator decides recovery.
- **[Template extraction](./docs/best-practices/template-extraction.md)** —
  Output templates over ~80 lines move into a sibling file loaded only at
  the assembly step.
- **[Identity and mental-model statements](./docs/best-practices/identity-and-mental-model.md)** —
  Open every skill and subagent with what-it-is and why-it-exists, calibrated
  to complexity.
- **[Example strategy](./docs/best-practices/example-strategy.md)** —
  Include a dispatch round-trip example in skills, an output-format example
  in subagents, and at least one failure example.
- **[Validation loops](./docs/best-practices/validation-loops.md)** —
  Every phase: announce → validate preconditions → execute → validate
  postconditions → update progress → gate. Max 3 fix cycles per task.
- **[Naming conventions](./docs/best-practices/naming-conventions.md)** —
  Skills use gerunds (`creating-jira-subtasks`); subagents use role nouns
  (`log-analyzer`). Frontmatter `name` matches the directory name.
- **[Artifact lifecycle management](./docs/best-practices/artifact-lifecycle.md)** —
  Orchestration artifacts (progress files, ticket snapshots) are never
  committed. Implementation artifacts (source, tests, configs) are.
- **[Empirical validation over self-report](./docs/best-practices/empirical-validation.md)** —
  Validate skill changes by running the workflow and observing behavior, not
  by asking the agent whether the fix will work.

For folder layout when scaffolding a new skill, see
[`docs/best-practices/quick-reference-skill-structure.md`](./docs/best-practices/quick-reference-skill-structure.md).

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
