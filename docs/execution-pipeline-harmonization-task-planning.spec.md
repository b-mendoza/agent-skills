---
title: "Execution Pipeline Harmonization Spec: Task Planning"
skill_group_slug: "task-planning"
slug_derivation: "Chosen from the shared function of both validated skills: they are Phase 2 task-planning orchestrators for different platforms. `task-planning` is the shortest accurate hyphenated label that covers both without baking in Jira- or GitHub-specific terminology."
validated_skills:
  - "skills/planning-github-issue-tasks"
  - "skills/planning-jira-tasks"
generated_from:
  report: "docs/execution-pipeline-harmonization-task-planning.report.md"
  triage: "docs/execution-pipeline-harmonization-task-planning.triage.md"
  change_summary: "docs/execution-pipeline-harmonization-task-planning.change-summary.md"
---

# Task Planning Harmonization Spec

## Purpose

This document is the canonical shape-level harmonization spec for the Phase 2
task-planning skills after the Phase 2 corrections authorized by the triage
ledger and applied in the change summary.

It covers only shared contract shape:

- field names
- artifact and return schemas
- pipeline stage names and ordering
- subagent dispatch conventions
- validator boundary rules
- allowed platform-specific divergence boundaries

It does not act as a runtime dependency. The validated skills remain
self-contained and executable from their own `SKILL.md`, `subagents/`, and
`references/` files.

## Traceability

- Phase 0 report: established the baseline alignment and identified `F001` and
  `F002`.
- Phase 1 triage ledger: classified `F001` as `FIX` and `F002` as `DEFER`.
- Phase 2 change summary: recorded the implemented Stage 2 validator correction
  for `F001` and confirmed `F002` remained untouched.

This spec reflects the post-Phase-2 file state on disk for:

- `skills/planning-github-issue-tasks`
- `skills/planning-jira-tasks`

## Canonical Alias Model

For shape comparison only, this spec uses these aliases:

- `<KEY>`: the platform-native work-item identifier
- `<SUMMARY_HEADING>`: `## Issue Summary` or `## Ticket Summary`
- `<SNAPSHOT_PATH>`: `docs/<KEY>.md`
- `<STAGE_1_PATH>`: `docs/<KEY>-stage-1-detailed.md`
- `<STAGE_2_PATH>`: `docs/<KEY>-stage-2-prioritized.md`
- `<FINAL_PATH>`: `docs/<KEY>-tasks.md`

Runtime contracts must keep the platform-native field names exactly as defined
by each skill. The aliases above are documentation shorthand only.

## Pipeline Stages

The canonical stage set and ordering are:

1. `preflight`
2. `1`
3. `2`
4. `3`
5. `postpipeline`

The normal execution path is:

`preflight -> stage 1 -> stage 2 -> stage 3 -> postpipeline`

The re-plan path is shape-aligned across both skills:

1. Determine the earliest affected stage from `RE_PLAN` inputs and decisions.
2. Resume from Stage 1, 2, or 3.
3. Rerun every downstream stage.
4. Finish with `postpipeline`.
5. Skip `preflight` unless the snapshot artifact itself changed or must be
   revalidated.

## Shared Contract Shapes

### Skill input shape

Both orchestrators accept the same input structure with a platform-native key
field:

| Canonical slot | GitHub skill | Jira skill | Shape |
| --- | --- | --- | --- |
| Work-item identifier | `ISSUE_SLUG` | `TICKET_KEY` | required scalar string |
| Re-plan flag | `RE_PLAN` | `RE_PLAN` | optional boolean-like flag |
| Revision input | `DECISIONS` | `DECISIONS` | optional freeform string |

### Artifact path shape

Both skills use the same path family with the platform-native identifier:

| Stage | Canonical path pattern | Written by |
| --- | --- | --- |
| Snapshot input | `docs/<KEY>.md` | upstream fetch skill |
| Stage 1 | `docs/<KEY>-stage-1-detailed.md` | `task-planner` |
| Stage 2 | `docs/<KEY>-stage-2-prioritized.md` | `dependency-prioritizer` |
| Stage 3 / final | `docs/<KEY>-tasks.md` | `task-validator` |

### Final plan section shape

The final artifact contract is the same across both skills except for the
platform-native summary heading.

Required top-level sections, in canonical terms:

1. `<SUMMARY_HEADING>`
2. `## Execution Order Summary`
3. `## Problem Framing`
4. `## Assumptions and Constraints`
5. `## Cross-Cutting Open Questions`
6. `## Tasks`
7. one or more numbered `## Task <N>: <Title>` sections
8. `## Dependency Graph`
9. `## Validation Report`

`## Problem Framing` must contain exactly these six subsection headings:

1. `### End User`
2. `### Underlying Need`
3. `### Proposed Solution`
4. `### Solution-Problem Fit`
5. `### Alternative Approaches Not Explored`
6. `### Evidence Basis`

Each numbered task section must include these required field headings:

1. `**Objective:**`
2. `**Relevant requirements and context:**`
3. `**Questions to answer before starting:**`
4. `**Implementation notes:**`
5. `**Definition of done:**`
6. `**Likely files / artifacts affected:**`
7. `**Dependencies / prerequisites:**`
8. `**Priority:**`

Conditional field currently present but not canonically triggered:

- `**Dependency rationale:**`

Its placement is harmonized when used: immediately after
`**Dependencies / prerequisites:**`. Its trigger remains deferred; see
`Deferred Items`.

### Stage 1 artifact shape

Stage 1 produces a detailed draft with this top-level section order:

1. `<SUMMARY_HEADING>`
2. `## Problem Framing`
3. `## Assumptions and Constraints`
4. `## Cross-Cutting Open Questions`
5. `## Tasks`
6. `## Notes`

Stage 1 task headings use the pattern `### Task <LETTER>`.

Each Stage 1 task must include these six fields:

1. `**Objective:**`
2. `**Relevant requirements and context:**`
3. `**Questions to answer before starting:**`
4. `**Implementation notes:**`
5. `**Definition of done:**`
6. `**Likely files / artifacts affected:**`

Each Stage 1 task must also contain a `Traces to` reference inside
`**Relevant requirements and context:**`.

### Stage 2 artifact shape

Stage 2 preserves Stage 1 task content and adds execution-order structure.

Required top-level section order:

1. `<SUMMARY_HEADING>`
2. `## Execution Order Summary`
3. `## Problem Framing`
4. `## Assumptions and Constraints`
5. `## Cross-Cutting Open Questions`
6. `## Tasks`
7. numbered `## Task <N>: <Title>` sections
8. `## Notes`
9. `## Dependency Graph`

Required Stage 2 transformations:

- promote lettered Stage 1 task headings to sequential numbered task headings
- preserve the carried-forward Stage 1 sections and task content
- add `**Dependencies / prerequisites:**` to every task
- add `**Priority:**` to every task
- renumber dependency references to `Task <N>` form while retaining original
  letter traceability in parentheses

Phase 2 correction now makes the validator boundary match this shape. The Stage
2 validator must enforce both of these requirements:

1. `## Execution Order Summary` appears immediately after `<SUMMARY_HEADING>`
2. the carried-forward Stage 1 sections remain present: `## Problem Framing`,
   `## Assumptions and Constraints`, `## Cross-Cutting Open Questions`, and
   `## Notes`

### Validation report shape

`task-validator` appends a report with this fixed section shape:

1. `## Validation Report`
2. `### Summary`
3. `### Check Results`
4. `### Fixes Applied`
5. `### Unresolved Issues`
6. `### Warnings`

The Stage 3 validator checks only for artifact existence and presence of
`## Validation Report`. The `postpipeline` validator checks the full downstream
contract shape.

## Return Schema Definitions

### Orchestrator return handoff

The top-level skill returns a concise line-oriented summary with the same field
order in both skills. The only platform-specific line is the identifier key.

```text
PLANNING: PASS | FAIL
<KEY_FIELD>: <KEY>
File: <final file path or "not written">
Tasks: <N>
Cross-cutting questions: <N>
Validation warnings: <N>
Failure category: PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE
Reason: <one line>
Artifacts preserved: <comma-separated paths>
```

Where `<KEY_FIELD>` is `ISSUE_SLUG` or `TICKET_KEY`.

### `task-planner` return shape

```text
PLAN: PASS | FAIL | BLOCKED | ERROR
<KEY_FIELD>: <KEY>
File: <OUTPUT_PATH or "not written">
Tasks: <N>
Cross-cutting questions: <N>
Assumptions: <N>
Reason: <one line>
```

### `dependency-prioritizer` return shape

```text
PRIORITIZATION: PASS | FAIL | BLOCKED | ERROR
<KEY_FIELD>: <KEY>
File: <OUTPUT_PATH or "not written">
Tasks: <N>
Critical path length: <N>
Parallel groups: <N>
Reason: <one line>
```

### `task-validator` return shape

```text
TASK_VALIDATION: PASS | FAIL | BLOCKED | ERROR
<KEY_FIELD>: <KEY>
File: <OUTPUT_PATH or "not written">
PASS: <N>
WARN: <N>
FAIL: <N>
Reason: <one line>
```

Additional invariant:

- `PASS + WARN + FAIL = 19`

### `stage-validator` return shape

```text
STAGE_VALIDATION: PASS | FAIL | ERROR
Stage: <STAGE>
File: <FILE_PATH>
Checks passed: <N> / <total> | n/a
Issues: None | <semicolon-separated list of failures>
Reason: <one line>
```

## Subagent Dispatch Conventions

The shared dispatch contract is:

1. Read a subagent definition only when about to dispatch that subagent.
2. Keep only decision-relevant handoff data between stages:
   stage status, validator verdict, passing file path, failing issues list, and
   retry count.
3. Do not carry raw plan content forward in orchestrator context.
4. Pass `DECISIONS` only to stages affected during re-plan.
5. Pass `VALIDATION_ISSUES` only when retrying the stage that produced the
   failing artifact.
6. On validator `FAIL`, retry only the producing stage and then rerun only the
   failing gate.
7. On validator `ERROR`, stop immediately at that gate and surface a phase
   failure with the matching failure category.
8. For `postpipeline` failure, redispatch Stage 3 with `VALIDATION_ISSUES`, then
   rerun Stage 3 validation and `postpipeline`.
9. Keep re-plan iterations and per-gate retry cycles separate.
10. Stop after 3 retry cycles for the same gate.

Canonical dispatch order by stage:

1. `preflight`: `stage-validator`
2. `1`: `task-planner` then `stage-validator`
3. `2`: `dependency-prioritizer` then `stage-validator`
4. `3`: `task-validator` then `stage-validator`
5. `postpipeline`: `stage-validator`

## Validator Boundary Rules

### Preflight boundary

The snapshot validator checks only structural entry requirements, not planning
quality.

### Stage 1 boundary

The validator enforces the Stage 1 draft shape:

- summary heading present
- full Problem Framing subsection set present
- assumptions, open questions, and notes present
- at least two `### Task ...` sections
- all six Stage 1 task fields present
- `Traces to` present in every task

### Stage 2 boundary

The validator enforces the Stage 2 prioritized-plan shape, including the Phase 2
`F001` correction:

- summary heading present
- `## Execution Order Summary` immediately after the summary heading
- carried-forward Stage 1 sections preserved
- `## Tasks` marker present
- numbered task headings sequential
- every task has dependencies and priority
- `## Dependency Graph` present

### Stage 3 boundary

The validator is intentionally minimal at Stage 3:

- final file exists
- `## Validation Report` exists

### Postpipeline boundary

The validator enforces the complete downstream structural contract of the final
artifact.

## Platform-Specific Divergence Boundaries

The following differences are legitimate content-level or platform-native
divergences and are not shape drift.

### Identifier field name

- GitHub: `ISSUE_SLUG`
- Jira: `TICKET_KEY`

Justification: these are the platform-native work-item identifiers already used
throughout each workflow and downstream handoff chain.

### Summary heading text

- GitHub: `## Issue Summary`
- Jira: `## Ticket Summary`

Justification: the heading mirrors the platform noun while preserving identical
position and function in every stage artifact.

### Snapshot section names required at preflight

- GitHub-specific headings include `## Child Issues`, `## Labels`,
  `## Assignees`, `## Milestone`, and `## Projects`.
- Jira-specific headings include `## Subtasks` and `## Custom Fields`.

Justification: these reflect differences in upstream snapshot shape produced by
`fetching-github-issue` and `fetching-jira-ticket`. The divergence is limited to
source artifact content, not to pipeline stage structure.

### Coverage wording inside `task-validator`

- GitHub coverage check refers to retrieved child issues.
- Jira coverage check refers to retrieved subtasks.

Justification: the check targets platform-native snapshot entities while keeping
the same check slot, severity, and role in the 19-check validator contract.

### Downstream consumer naming

- GitHub references `creating-github-child-issues`.
- Jira references `creating-jira-subtasks`.

Justification: downstream phase names differ because the execution systems do.
The upstream Phase 2 artifact shape consumed by those phases remains aligned.

## Decisions Recorded In This Pass

### D001

- Decision: The canonical harmonization slug is `task-planning`.
- Rationale: both validated skills are Phase 2 task-planning orchestrators with
  the same three-stage planning pipeline. No narrower shared label from the
  current file set is more accurate without introducing platform-specific terms.

### D002

- Decision: The canonical Stage 2 shape now explicitly requires preservation of
  the carried-forward Stage 1 sections and immediate placement of
  `## Execution Order Summary` after the summary heading.
- Rationale: Phase 1 triage classified `F001` as `FIX`, and Phase 2 implemented
  that validator correction in both `stage-validator.md` files.

### D003

- Decision: `**Dependency rationale:**` remains part of the documented Stage 2
  and final-plan shape when used, but this spec does not define a new trigger
  for when it becomes mandatory.
- Rationale: Phase 1 triage classified `F002` as `DEFER` because the current
  sources do not define a validator-observable trigger with enough precision to
  standardize confidently.

### D004

- Decision: This spec normalizes shape-level aliases such as `<KEY>` and
  `<SUMMARY_HEADING>` for documentation only and does not change runtime field
  names.
- Rationale: the report explicitly treated platform identifier and summary-name
  differences as legitimate to preserve, while still needing a self-contained
  comparison vocabulary.

## Deferred Items

### F002

- Ledger category: `DEFER`
- Short description: the contract includes conditional
  `**Dependency rationale:**` output, but the trigger for when it becomes
  required is still underspecified.
- Blocking ambiguity: the current sources do not define what kind of dependency
  relationship "needs explanation" or what observable condition should require
  the field.
- Spec treatment: preserve the field's placement and existence in examples, but
  do not encode a mandatory trigger or validator rule.

## Known Non-Goals

This harmonization spec does not cover:

1. content quality of plans, such as whether a task split is strategically good
2. semantic judgment for requirement coverage beyond the documented validator
   slots
3. upstream fetch-skill contract design beyond the snapshot headings consumed by
   preflight
4. downstream critique or execution behavior beyond the final artifact sections
   they consume
5. whether `**Dependency rationale:**` should become unconditional or what exact
   heuristic should trigger it
6. rewording platform-native nouns like issue, ticket, child issue, or subtask
7. runtime coupling that would require these skills to import or read this spec

## Canonical Summary

After the Phase 2 correction, the GitHub and Jira Phase 2 task-planning skills
share one canonical shape-level contract:

- the same five pipeline gates
- the same three planning subagents plus one structural validator
- the same artifact path family
- the same return-schema families
- the same retry and re-plan conventions
- the same Stage 1, Stage 2, Stage 3, and postpipeline boundary intent

The remaining differences are platform-native naming and snapshot-content
differences, not pipeline-shape divergence.
