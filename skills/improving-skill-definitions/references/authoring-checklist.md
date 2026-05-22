# Authoring Checklist

Read this file before audit and validation, or when applying a checklist-driven
fix. Use it as operational criteria, not as content to copy wholesale into every
skill.

## Material Issue Gate

Make a change only when it fixes a concrete problem in at least one category:

| Category | Material issue examples |
| -------- | ----------------------- |
| Reliability | Missing output contract, ambiguous execution order, absent failure handling |
| Portability | Runtime-specific syntax used without need, unsupported frontmatter, absolute paths |
| Standalone packaging | Dependency on repository-local docs, sibling skills, private config, or unbundled files |
| Context efficiency | Always-loaded `SKILL.md` contains long templates, examples, static tables, or phase playbooks |
| Maintainability | Stale registry paths, duplicated instructions that disagree, unclear artifact boundaries |
| Validation | No observable success criteria, no retry limit, no path or contract checks |
| User comprehension | Purpose, inputs, outputs, or no-change behavior are hard to determine |

Leave the package unchanged when its current structure is clear, standalone,
proportionate to the workflow, and proposed edits would only rename, reshuffle,
or polish without improving behavior.

## Package Shape

```text
skill-name/
├── SKILL.md
├── subagents/
│   └── role-noun.md
├── references/
│   └── topic-or-phase.md
└── scripts/
```

Use only the directories the package needs. Keep bundled paths inside the skill
package and relative to the file that contains them.

## `SKILL.md` Checks

- Frontmatter has `name` and `description` only unless a runtime-specific field
  is required and verified.
- `name` is kebab-case and matches the containing skill directory.
- Description states what the skill does and when to use it.
- File normally stays under 500 lines.
- Body contains identity, inputs, output contract, pipeline or workflow,
  subagent registry when applicable, progressive loading map, execution steps,
  validation, and a concise example.
- Detailed templates, long examples, large checklists, source indexes, and
  phase-specific playbooks live in `references/`.

## Subagent Checks

- File name and frontmatter `name` match exactly.
- Name is a role noun in kebab-case.
- The opening paragraph states the role, purpose, and mental model.
- Inputs are explicit.
- Instructions are step-by-step and scoped to the subagent's job.
- Output format is structured and easy for the orchestrator to summarize.
- Scope says what the subagent does and where it stops.
- Escalation categories include `BLOCKED`, `FAIL` where relevant, and `ERROR`.

## Progressive Disclosure Checks

- The always-loaded skill body contains routing and contracts, not every detail.
- References are loaded just in time for specific phases, modes, templates, or
  source-backed decisions.
- Subagent definitions are read only when dispatching that subagent.
- External URLs support optional rationale or current docs; they are not required
  for normal execution.
- Every tag, section, subagent, and reference changes behavior if removed.

## Context Protection Checks

- The orchestrator keeps decisions, statuses, short summaries, and user
  confirmations.
- Raw file contents, command output, diffs, external pages, and large examples
  stay inside the responsible subagent unless the orchestrator needs a concise
  summary to decide the next step.
- Handoffs use paths, verdicts, issue IDs, and short summaries rather than raw
  transcripts.

## Constraint Framing Checks

- Primary instructions define permitted actions and the intended mental model.
- Direct prohibitions appear only in concrete anti-patterns, safety boundaries,
  or short reminders where naming the wrong action creates useful friction.
- Anti-patterns are specific actions, not vague attitudes.

## External Resource Checks

- Add external URLs only when they reduce local bulk, provide current platform
  syntax, or support a concrete decision.
- Prefer a bundled source index over scattering URLs through `SKILL.md`.
- Include why each URL exists and when to fetch it.
- Keep essential instructions, inputs, outputs, escalation behavior, and
  validation criteria local to the package.

## Validation Checks

- Referenced local paths exist.
- Frontmatter names match directories or file basenames.
- `SKILL.md` is focused and under the size guidance or has a clear reason.
- Subagents have inputs, output format, scope, and escalation.
- Standalone package checks pass.
- Validation loops define targeted fixes and retry limits when applicable.
- Script directories, if present, include a consumer-facing invocation or clear
  instructions; run scripts when safe and relevant.

## No-Change Report Checks

A `NO_CHANGE` result should include:

- Files inspected.
- Evidence that contracts, paths, standalone packaging, and disclosure boundaries
  are already adequate.
- Optional improvements considered and rejected.
- Any validation limits.
