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
| [`evals/`](./evals/)                     | Local eval suite. Runs skills against fixture repos; `node evals/src/orchestration/run.ts`. |
| [`.agents/skills/`](./.agents/skills/)   | Vendored third-party skills. Source of truth for OpenCode discovery.    |
| [`.claude/skills/`](./.claude/skills/)   | Mirror of vendored skills for Claude Code discovery.                    |
| [`skills-lock.json`](./skills-lock.json) | Pin file for vendored third-party skills (managed by tooling).          |
| [`opencode.jsonc`](./opencode.jsonc)     | OpenCode configuration (currently MCP server registration only).        |
| [`README.md`](./README.md)               | Human-facing repo overview and skill catalog.                           |

## Skill-Authoring Guidance

When authoring or editing a skill, subagent, or reference file, read the docs
named for your task before editing. The linked docs are the source of truth;
[`docs/best-practices/README.md`](./docs/best-practices/README.md) is the
full index. Mandatory-tier practices apply whenever their trigger condition
holds, even when a task row below does not name them — the row lists the
docs most tasks of that shape need, then conditional adds keyed on what the
skill actually does.

| Task | Read before editing | Also read when the skill… |
| ---- | ------------------- | ------------------------- |
| Create a new skill | [`quick-reference-skill-structure`](./docs/best-practices/quick-reference-skill-structure.md), [`frontmatter-contract`](./docs/best-practices/frontmatter-contract.md), [`trigger-and-description-authoring`](./docs/best-practices/trigger-and-description-authoring.md), [`skill-section-order`](./docs/best-practices/skill-section-order.md), [`input-output-contracts`](./docs/best-practices/input-output-contracts.md), [`earned-complexity`](./docs/best-practices/earned-complexity.md), [`runtime-portability-matrix`](./docs/best-practices/runtime-portability-matrix.md) | …mutates files: [`mutation-scope-boundaries`](./docs/best-practices/mutation-scope-boundaries.md); …produces files: [`artifact-lifecycle`](./docs/best-practices/artifact-lifecycle.md); …dispatches subagents: [`subagent-registry-format`](./docs/best-practices/subagent-registry-format.md), [`orchestrator-as-routing-ui`](./docs/best-practices/orchestrator-as-routing-ui.md), [`context-window-protection`](./docs/best-practices/context-window-protection.md); …needs approval gates: [`human-in-the-loop-checkpoints`](./docs/best-practices/human-in-the-loop-checkpoints.md) |
| Restructure a large `SKILL.md` or move content into supporting files | [`progressive-disclosure`](./docs/best-practices/progressive-disclosure.md), [`template-extraction`](./docs/best-practices/template-extraction.md), [`skill-section-order`](./docs/best-practices/skill-section-order.md), [`earned-complexity`](./docs/best-practices/earned-complexity.md) | |
| Add or edit a subagent | [`subagent-default-execution`](./docs/best-practices/subagent-default-execution.md), [`skill-section-order`](./docs/best-practices/skill-section-order.md), [`identity-and-mental-model`](./docs/best-practices/identity-and-mental-model.md), [`input-output-contracts`](./docs/best-practices/input-output-contracts.md), [`escalation-categories`](./docs/best-practices/escalation-categories.md), [`context-window-protection`](./docs/best-practices/context-window-protection.md) | …passes large payloads: [`handoff-file-dispatch`](./docs/best-practices/handoff-file-dispatch.md); …mutates files: [`mutation-scope-boundaries`](./docs/best-practices/mutation-scope-boundaries.md) |
| Write or revise instructions, constraints, examples, or long reference files | [`identity-and-mental-model`](./docs/best-practices/identity-and-mental-model.md), [`operating-posture`](./docs/best-practices/operating-posture.md), [`positive-constraint-framing`](./docs/best-practices/positive-constraint-framing.md), [`instruction-reinforcement`](./docs/best-practices/instruction-reinforcement.md), [`example-strategy`](./docs/best-practices/example-strategy.md), [`progressive-disclosure`](./docs/best-practices/progressive-disclosure.md), [`external-information-linking`](./docs/best-practices/external-information-linking.md) | |
| Add validation steps, gates, or fix loops | [`phase-execution-cycle`](./docs/best-practices/phase-execution-cycle.md), [`critical-output-gates`](./docs/best-practices/critical-output-gates.md), [`empirical-validation`](./docs/best-practices/empirical-validation.md), [`escalation-categories`](./docs/best-practices/escalation-categories.md), [`input-output-contracts`](./docs/best-practices/input-output-contracts.md) | …is being audited as a package: [`best-practices-compliance-gate`](./docs/best-practices/best-practices-compliance-gate.md) |
| Design multi-phase control flow or a state machine | [`state-machine-artifacts`](./docs/best-practices/state-machine-artifacts.md), [`phase-execution-cycle`](./docs/best-practices/phase-execution-cycle.md), [`orchestrator-as-routing-ui`](./docs/best-practices/orchestrator-as-routing-ui.md) | |
| Add user approval / confirmation checkpoints | [`human-in-the-loop-checkpoints`](./docs/best-practices/human-in-the-loop-checkpoints.md), [`escalation-categories`](./docs/best-practices/escalation-categories.md) | |
| Make a skill deterministic or reproducible | [`deterministic-execution`](./docs/best-practices/deterministic-execution.md), [`empirical-validation`](./docs/best-practices/empirical-validation.md) | |
| Decide what artifacts to commit, keep local, or delete | [`artifact-lifecycle`](./docs/best-practices/artifact-lifecycle.md), [`mutation-scope-boundaries`](./docs/best-practices/mutation-scope-boundaries.md) | |
| Change runtime, tool, permission, or subagent compatibility | [`runtime-portability-matrix`](./docs/best-practices/runtime-portability-matrix.md), [`frontmatter-contract`](./docs/best-practices/frontmatter-contract.md), [`orchestrator-as-routing-ui`](./docs/best-practices/orchestrator-as-routing-ui.md), [`mutation-scope-boundaries`](./docs/best-practices/mutation-scope-boundaries.md) | |

## Verification

This repo has no CI pipeline for skill authoring. The Agent Skills
reference validator (`skills-ref validate <skill-dir>`, see the
[runtime portability matrix](./docs/best-practices/runtime-portability-matrix.md))
checks standard frontmatter and naming when available; everything else is
manual. Treat the lack of CI as a known gap, not as permission to declare
work done without checks. After editing a `SKILL.md` or subagent
definition:

- Run `skills-ref validate` on the skill directory when the tool is
  available.
- Confirm the file is under the size guidance from
  [progressive disclosure](./docs/best-practices/progressive-disclosure.md)
  (`SKILL.md` under 500 lines, instruction body under ~5,000 tokens).
- Confirm any subagent paths referenced in a registry table actually exist
  on disk.
- Confirm the YAML frontmatter `name` matches the directory or file name
  per the [frontmatter contract](./docs/best-practices/frontmatter-contract.md).
- If the skill ships a `scripts/` directory, run the script the way a
  consumer would invoke it.
- If the skill has cases in [`evals/`](./evals/), re-run them and commit the
  updated `evals/report.md`: `node evals/src/orchestration/run.ts --case=<id>` for one case, or
  `node evals/src/orchestration/run.ts` for the suite. Behavior changes outside the intended one
  are regressions. The suite needs `pnpm install` in `evals/` once; its own
  toolchain is checked with `pnpm lint` and `pnpm test` from that directory.
- If the change touches `skills-lock.json` or vendored skills under
  `.agents/skills/` or `.claude/skills/`, confirm the change came from the
  managing tool — do not hand-edit the lockfile.

When unsure whether a change is correct, escalate to the user rather than
declaring success.

## Repo-Specific Notes

- **Dual-runtime targets.** Skills must work for both OpenCode and Claude
  Code. Use the
  [runtime portability matrix](./docs/best-practices/runtime-portability-matrix.md)
  before changing tool, permission, frontmatter, or subagent behavior. Avoid
  runtime-specific frontmatter fields and prefer plain markdown links over
  `@path` imports.
