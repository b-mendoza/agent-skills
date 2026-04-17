---
title: "Execution Pipeline Harmonization Spec for Task Planning Skills"
status: "canonical-current-state"
skill_group_slug: "task-planning"
slug_derivation: "Derived from the shared subject matter of `skills/planning-github-task` and `skills/planning-jira-task`: both orchestrate planning for one numbered task inside a task-plan workflow, so the shared group is `task-planning` rather than a platform-specific slug."
sources:
  - "docs/task-planning-harmonization-phase-0-report.md"
  - "docs/task-planning-harmonization-phase-1-triage-ledger.md"
  - "docs/task-planning-harmonization-phase-2-change-summary.md"
  - "skills/planning-github-task/SKILL.md"
  - "skills/planning-github-task/references/pipeline.md"
  - "skills/planning-github-task/references/data-contracts.md"
  - "skills/planning-github-task/subagents/execution-prepper.md"
  - "skills/planning-github-task/subagents/execution-planner.md"
  - "skills/planning-github-task/subagents/test-strategist.md"
  - "skills/planning-github-task/subagents/refactoring-advisor.md"
  - "skills/planning-jira-task/SKILL.md"
  - "skills/planning-jira-task/references/pipeline.md"
  - "skills/planning-jira-task/references/data-contracts.md"
  - "CLAUDE.md"
traceability_chain: "Phase 0 established zero drift in shape, Phase 1 recorded zero `FIX`/`PRESERVE`/`DEFER` entries, Phase 2 confirmed no changes were required, and this spec records that harmonized state without changing either skill."
---

# Execution Pipeline Harmonization Spec

## Purpose

This document records the canonical shared execution-pipeline contract shape for
the task-planning skill pair:

- `skills/planning-github-task`
- `skills/planning-jira-task`

It is descriptive, not normative for runtime loading. The skills remain
self-contained and must not depend on this file.

## Traceability

- Phase 0 report: established zero shape-level findings and identified the
  shared five-stage orchestration shape, matching dispatch rules, matching
  rerun rules, and matching escalation taxonomy.
- Phase 1 ledger: recorded zero entries, so this pass preserves the current
  harmonized structure rather than introducing new shape changes.
- Phase 2 change summary: confirmed no skill-file fixes were applied and no new
  findings were discovered.
- This spec: converts that verified state into one harness-agnostic reference
  for future audits.

## Canonical Shared Model

Use these neutral terms when describing the shared shape across both skills:

- `WORK_ITEM_KEY`: the platform-specific task-plan identifier token.
  GitHub binds this to `ISSUE_SLUG`; Jira binds this to `TICKET_KEY`.
- `TASK_NUMBER`: the numbered task inside `docs/<WORK_ITEM_KEY>-tasks.md`.
- `RE_PLAN`: optional boolean-like flag used only for critique-driven reruns.
- `DECISIONS_FILE`: optional critique output at
  `docs/<WORK_ITEM_KEY>-task-<TASK_NUMBER>-decisions.md`.

Canonical upstream task-plan pattern:

- `docs/<WORK_ITEM_KEY>-tasks.md`

Canonical downstream artifact ownership pattern:

- `docs/<WORK_ITEM_KEY>-task-<TASK_NUMBER>-brief.md`
- `docs/<WORK_ITEM_KEY>-task-<TASK_NUMBER>-execution-plan.md`
- `docs/<WORK_ITEM_KEY>-task-<TASK_NUMBER>-test-spec.md`
- `docs/<WORK_ITEM_KEY>-task-<TASK_NUMBER>-refactoring-plan.md`

Artifact lifecycle shape:

- Keep planning artifacts on disk.
- Overwrite only the file owned by an intentionally re-run subagent.
- Do not delete planning artifacts as cleanup.
- Do not commit planning artifacts to git.

## Shared Contract Shape Definitions

### Orchestrator Input Shape

Required fields:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `WORK_ITEM_KEY` | string | Platform-specific identifier token. Named `ISSUE_SLUG` in GitHub and `TICKET_KEY` in Jira. |
| `TASK_NUMBER` | integer or numeric string | Identifies one numbered task section. |

Optional fields:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `RE_PLAN` | boolean-like string | Used only when critique invalidates prior planning output. |
| `DECISIONS_FILE` | path string | Present only when critique produced explicit decisions for rerun guidance. |

### Upstream Prerequisite Shape

The task-plan file must contain, for the selected `TASK_NUMBER`:

- `## Task <TASK_NUMBER>:`
- Task title
- `Objective`
- `Relevant requirements and context`
- `Implementation notes`
- `Definition of done`
- `Likely files / artifacts affected`
- `Dependencies / prerequisites` with a value, including `None`
- `Priority`
- `Questions to answer before starting` with a value, including `None`

Expected readiness state:

- Declared dependencies are already complete.
- Open questions are resolved, explicitly waived, or recorded as follow-up
  decisions.
- `## Decisions Log`, when present, overrides earlier task-plan wording.

### Downstream Artifact Section Shape

`brief.md` must contain:

- `# Execution Brief - <WORK_ITEM_KEY> Task <TASK_NUMBER>: <Title>`
- `## Objective`
- `## Relevant Requirements and Context`
- `## Implementation Notes`
- `## Definition of Done`
- `## Likely Files / Artifacts Affected`
- `## Resolved Questions and Decisions`
- `## Constraints`

`execution-plan.md` must contain:

- `# Execution Plan - <WORK_ITEM_KEY> Task <TASK_NUMBER>: <Title>`
- `## Codebase Summary`
- `## Recommended Skills`
- `## Implementation Approach`
- `## File-Level Strategy`
- `## Risks and Considerations`
- `## User Impact Assessment`
- `## Blockers / Ambiguities`

`test-spec.md` must contain:

- `# Test Specification - <WORK_ITEM_KEY> Task <TASK_NUMBER>: <Title>`
- `## Test Framework and Conventions`
- `## Test Groups`
- `## Definition of Done Coverage`
- `## Notes for Task Executor`
- `## Blockers / Ambiguities`

`refactoring-plan.md` must contain:

- `# Refactoring Recommendation - <WORK_ITEM_KEY> Task <TASK_NUMBER>: <Title>`
- `## Verdict`
- `## Before Implementation`
- `## During Implementation`
- `## Out of Scope`
- `## Impact on Existing Tests`
- `## Blockers / Ambiguities`

### Subagent Summary Output Shape

Each subagent returns a short plaintext summary, not full artifact contents.

Shared shape rules:

- First line is `<STATUS_LABEL>: PASS|FAIL|BLOCKED|ERROR`.
- The summary includes the owned artifact path or `Not written`.
- Remaining fields are concise, next-step-relevant rollups for the orchestrator.
- The orchestrator retains only verdicts, file paths, and minimal notes.

Status labels by stage:

- `execution-prepper` -> `PREP`
- `execution-planner` -> `PLAN`
- `test-strategist` -> `TEST_SPEC`
- `refactoring-advisor` -> `REFACTORING`

Escalation interpretation shape:

- `PASS`: output is valid; advance to the next stage.
- `FAIL`: inputs exist but ambiguity or readiness gaps make planning unreliable;
  stop and surface the issue.
- `BLOCKED`: required artifact or required task section is missing; stop and
  surface the missing prerequisite.
- `ERROR`: unexpected read, write, parsing, or tool failure; stop and ask the
  user how to proceed.

## Pipeline Stages and Ordering

Canonical pipeline order:

1. `execution-prepper`
2. `execution-planner`
3. `test-strategist`
4. `refactoring-advisor`
5. completion report

Stage handoff shape:

1. `execution-prepper`
   Inputs: `WORK_ITEM_KEY`, `TASK_NUMBER`, plus `RE_PLAN` and `DECISIONS_FILE`
   only when applicable.
   Output: brief artifact.
2. `execution-planner`
   Inputs: `BRIEF_FILE`, plus `DECISIONS_FILE` when applicable.
   Output: execution plan artifact.
3. `test-strategist`
   Inputs: `BRIEF_FILE`, `PLAN_FILE`, plus `DECISIONS_FILE` when applicable.
   Output: test specification artifact.
4. `refactoring-advisor`
   Inputs: `BRIEF_FILE`, `PLAN_FILE`, `TEST_SPEC_FILE`, plus `DECISIONS_FILE`
   when applicable.
   Output: refactoring recommendation artifact.
5. completion report
   Output summary contains task number and title, all four artifact paths, one
   or two sentences on the recommended approach, the number or shape of tests
   specified, and the refactoring verdict.

Execution rules:

- Dispatch one subagent at a time.
- Validate required input existence before each dispatch.
- Confirm the expected owned artifact was written before advancing.
- Keep only concise summaries in orchestrator context.
- Stop immediately on `FAIL`, `BLOCKED`, or `ERROR`.

## Subagent Dispatch Conventions

Shared dispatch contract:

- The orchestrator reads reference docs only when needed for dispatch, contract
  questions, or rerun decisions.
- Read a subagent definition only immediately before dispatching that subagent.
- Pass only explicit handoff inputs required for the current stage.
- Do not pass the whole task plan forward once the brief exists.
- On reruns, allow the subagent to read its own existing artifact so it can
  update deliberately rather than rebuild blindly.
- Downstream subagents may consume only the artifacts listed in the pipeline for
  their stage, plus `DECISIONS_FILE` when applicable.

Shared rerun policy:

- Critique affecting task scope, definition of done, resolved questions, or task
  context reruns `execution-prepper` and all downstream stages.
- Critique affecting implementation approach, file strategy, or recommended
  skills reruns `execution-planner`, `test-strategist`, and
  `refactoring-advisor`.
- Critique affecting only test expectations reruns `test-strategist`, then
  reruns `refactoring-advisor` only if test changes alter implementation
  sequencing, setup, or expected impact on existing tests.
- Critique affecting only refactoring guidance reruns `refactoring-advisor`
  alone.
- Maximum re-plan loops: `3`.

## Platform-Specific Divergence Boundaries

These divergences are preserved because they change platform vocabulary, not the
shared contract shape.

| Divergence boundary | GitHub form | Jira form | Justification |
| ------------------- | ----------- | --------- | ------------- |
| Primary work-item identifier field | `ISSUE_SLUG` | `TICKET_KEY` | Each skill must speak the platform's native identifier language while preserving the same one-field identity role in the contract. |
| Upstream task-plan file pattern | `docs/<ISSUE_SLUG>-tasks.md` | `docs/<TICKET_KEY>-tasks.md` | The artifact pattern is structurally identical; only the identifier token changes. |
| Optional task-linking table name | `## GitHub Task Issues` | `## Jira Subtasks` | These reflect upstream workflow artifacts from platform-specific task-linking phases and are intentionally tolerated, not required. |
| Optional snapshot context file wording | issue snapshot | ticket snapshot | The auxiliary file plays the same role, but platform-local terminology keeps each skill readable in its own workflow. |
| Platform mutation prohibition language | do not mutate GitHub issues | do not transition Jira issues | The planning boundary is the same, but the prohibited side effect must name the platform-specific action. |
| Optional per-task linked artifact examples | child issue URLs or numbers | `Jira Subtask: <KEY>` lines | These examples document tolerated upstream annotations without changing planning-pipeline shape. |

No other divergence boundary is canonical in the current harmonized state.

## Decisions Made During This Pass

### Decision 1: Preserve the current zero-drift contract as the canonical shape

Rationale:

- Phase 0 found zero shape-level inconsistencies.
- Phase 1 recorded zero `FIX`, zero `PRESERVE`, and zero `DEFER` entries.
- Phase 2 confirmed that no skill-file changes were required.

Result:

- This spec documents the current shared pipeline instead of proposing further
  harmonization edits.

### Decision 2: Normalize the description with `WORK_ITEM_KEY` in the spec only

Rationale:

- The two skills use different platform-native identifier names.
- `CLAUDE.md` requires skills to remain self-contained and dual-runtime safe.
- A neutral abstraction is useful in a spec, but would add unnecessary new names
  inside the skills themselves.

Result:

- This spec uses `WORK_ITEM_KEY` as a descriptive umbrella term.
- The skills continue to use `ISSUE_SLUG` and `TICKET_KEY` locally.

### Decision 3: Treat platform-local terminology as preserved divergence, not drift

Rationale:

- Phase 0 explicitly excluded content-level platform differences when they do
  not alter contract shape.
- Phase 1 warned Phase 2 not to erase legitimate GitHub-vs-Jira terminology
  differences.

Result:

- The spec marks those boundaries explicitly so future harmonization passes do
  not over-normalize them.

### Decision 4: Keep this document harness-agnostic and non-executable

Rationale:

- `CLAUDE.md` states that skills must remain self-contained and work across
  OpenCode and Claude Code.
- This phase is scoped to recording the harmonized state, not changing runtime
  loading behavior.

Result:

- The spec is a reference document under `docs/` only.

## Deferred Items

Every `DEFER` entry from the Phase 1 ledger:

- None. `docs/task-planning-harmonization-phase-1-triage-ledger.md` records
  zero `DEFER` entries.

## Known Non-Goals

This harmonization spec does not cover:

- Editing either planning skill or any subagent definition.
- Merging GitHub and Jira skills into one runtime skill.
- Normalizing platform-specific nouns out of the skills.
- Defining critique-step contracts beyond the `DECISIONS_FILE` handoff used by
  reruns.
- Changing artifact lifecycle policy.
- Introducing new validation tooling, schema enforcement, or CI.
- Defining how downstream task-execution or critique skills consume these
  artifacts beyond the documented handoff shape.

## Current-State Summary

The harmonized contract is a five-stage planning pipeline with four sequential
subagent stages, one owned artifact per subagent, shared escalation taxonomy,
targeted rerun rules, and bounded platform-specific terminology differences.
