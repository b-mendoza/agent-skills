# Validation Checks

Read this file only from `stage-validator` or `task-validator`.

> **Reminder:** These check lists are the structural contract. Apply them
> exactly. For background or definitions (for example branch validity edge
> cases via `git-check-ref-format`, or dependency-cycle / topological-sort
> definitions), see `./external-sources.md`.

## Stage Validator Checks

### Stage `preflight`

Validate `docs/<TICKET_KEY>.md`.

- File exists at `FILE_PATH`.
- Contains `## Metadata`.
- Contains `## Description`.
- Contains `## Acceptance Criteria`.
- Contains `## Comments`.
- Contains `## Retrieval Warnings`.
- Contains `## Subtasks`.
- Contains `## Linked Issues`.
- Contains `## Attachments`.
- Contains `## Custom Fields`.

### Stage `1`

Validate `docs/<TICKET_KEY>-stage-1-detailed.md`.

- File exists at `FILE_PATH`.
- Contains `## Ticket Summary`.
- Contains `## Problem Framing` with all six required subsections.
- Contains `## Assumptions and Constraints`.
- Contains `## Cross-Cutting Open Questions`.
- Contains `## Notes`.
- Contains at least 2 task sections using `### Task ...` headings, unless
  `## Assumptions and Constraints` or `## Notes` records the internal
  current-subtask exception for a single execution task.
- Every task has `**Objective:**`.
- Every task has `**Relevant requirements and context:**`.
- Every task has `**Questions to answer before starting:**`.
- Every task has `**Implementation notes:**`.
- Every task has `**Definition of done:**`.
- Every task has `**Likely files / artifacts affected:**`.
- Every task has a `Traces to` reference.

### Stage `2`

Validate `docs/<TICKET_KEY>-stage-2-prioritized.md`.

- File exists at `FILE_PATH`.
- Contains `## Ticket Summary`.
- Contains `## Execution Order Summary` immediately after `## Ticket Summary` and before `## Problem Framing`.
- `## Execution Order Summary` includes branch names for task rows.
- Contains `## Problem Framing` with all six required subsections.
- Contains `## Assumptions and Constraints`.
- Contains `## Cross-Cutting Open Questions`.
- Contains `## Notes`.
- Contains `## Tasks`.
- Numbered tasks use `## Task <N>: <Title>` with no gaps.
- Every numbered task has `**Priority:**`.
- Every numbered task has `**Branch name:**`.
- Every branch name satisfies the deterministic branch contract from
  `./output-contract.md`: default parent-ticket
  `feature/<ticket-key-lower>-task-<n>-<short-task-slug>`, current-subtask
  `feature/<ticket-key-lower>-<short-ticket-slug>`, or a clearly stated team
  prefix with the same deterministic suffix.
- Every numbered task preserves the carried-forward Stage 1 fields:
  `**Objective:**`, `**Relevant requirements and context:**`,
  `**Questions to answer before starting:**`, `**Implementation notes:**`,
  `**Definition of done:**`, and `**Likely files / artifacts affected:**`.
- Every numbered task preserves a `Traces to` reference.
- Every numbered task has `**Dependencies / prerequisites:**`.
- Contains `## Dependency Graph`.
- Hard dependency references point to valid renumbered tasks.
- No numbered task appears before one of its hard dependencies.
- If current-subtask mode is stated, all task branch names are identical.

### Stage `3`

Validate `docs/<TICKET_KEY>-tasks.md`.

- File exists at `FILE_PATH`.
- Contains `## Validation Report`.

### Stage `postpipeline`

Validate the final downstream contract of `docs/<TICKET_KEY>-tasks.md`.

- `## Ticket Summary` exists.
- `## Execution Order Summary` exists and includes branch names.
- `## Problem Framing` exists with all six required subsections.
- `## Assumptions and Constraints` exists.
- `## Cross-Cutting Open Questions` exists.
- `## Tasks` exists.
- `## Notes` exists.
- `## Dependency Graph` exists.
- `## Validation Report` exists.
- Top-level headings preserve the final order from `./output-contract.md`:
  `## Ticket Summary`, `## Execution Order Summary`, `## Problem Framing`,
  `## Assumptions and Constraints`, `## Cross-Cutting Open Questions`,
  `## Tasks`, numbered `## Task N: <Title>` sections, `## Notes`,
  `## Dependency Graph`, then `## Validation Report`.
- At least 2 numbered task sections exist, unless the plan records the internal
  current-subtask exception for a smaller execution plan.
- Every numbered task has `**Priority:**`.
- Every numbered task has `**Branch name:**`.
- Every branch name satisfies the deterministic branch contract from
  `./output-contract.md`: default parent-ticket
  `feature/<ticket-key-lower>-task-<n>-<short-task-slug>`, current-subtask
  `feature/<ticket-key-lower>-<short-ticket-slug>`, or a clearly stated team
  prefix with the same deterministic suffix.
- Every numbered task has `**Objective:**`.
- Every numbered task has `**Relevant requirements and context:**`.
- Every numbered task has `**Questions to answer before starting:**`.
- Every numbered task has `**Implementation notes:**`.
- Every numbered task has `**Definition of done:**`.
- Every numbered task has `**Likely files / artifacts affected:**`.
- Every numbered task has `**Dependencies / prerequisites:**`.
- If current-subtask mode is stated, every numbered task uses the same branch
  name and that branch follows the current-subtask branch contract from
  `./output-contract.md`.

## Task Validator Checks

Run these checks against the original snapshot and the stage 2 prioritized plan.

| # | Check | Severity |
| - | ----- | -------- |
| 1 | Every requirement in `## Description` is addressed | FAIL |
| 2 | Every acceptance criterion maps to at least one task's definition of done | FAIL |
| 3 | Every retrieved subtask in `## Subtasks` is accounted for, merged, referenced, or explicitly out of scope | WARN |
| 4 | Actionable comments are reflected | WARN |
| 5 | Every task has all carried-forward stage 1 subsections | FAIL |
| 6 | Every task has a dependencies annotation | FAIL |
| 7 | Every task has a priority annotation | FAIL |
| 8 | Every task has a branch name | FAIL |
| 9 | Task numbering is sequential with no gaps | FAIL |
| 10 | Execution Order Summary table is present, complete, and includes branch names | WARN |
| 11 | Dependency Graph section is present | WARN |
| 12 | No circular dependencies exist | FAIL |
| 13 | Hard dependency references point to valid task numbers | FAIL |
| 14 | No task is ordered before its hard dependency | FAIL |
| 15 | No two tasks have identical objectives | WARN |
| 16 | Cross-cutting questions do not duplicate per-task questions | WARN |
| 17 | No vague definition-of-done items such as `works`, `is complete`, or `functions properly` | WARN |
| 18 | Task count is appropriate for scope | WARN |
| 19 | No empty or `TBD` implementation notes remain | WARN |
| 20 | Branch names are valid Git ref-style names, follow the deterministic branch contract from `./output-contract.md`, and respect current-subtask single-branch mode when applicable | FAIL |

## Result Handling

- Fix `FAIL` items directly only when they are mechanical, such as numbering
  gaps, missing headings, missing branch-name fields, or broken references.
- Record judgment-heavy failures in `### Unresolved Issues` instead of inventing
  tasks or requirements.
- Record `WARN` items for downstream awareness. Do not block the artifact unless
  they imply a structural `FAIL`.

## Validation Report Template

Append this report to the final plan:

```markdown
---

## Validation Report

> Validated on: <YYYY-MM-DD HH:MM UTC>
> TICKET_KEY: <TICKET_KEY>

### Summary

| Result | Count |
| ------ | ----- |
| PASS | <N> |
| WARN | <N> |
| FAIL | <N> |

### Check Results

| # | Check | Result | Notes |
| - | ----- | ------ | ----- |
| 1 | Requirement coverage | PASS | |
| 2 | Acceptance criteria mapping | PASS | |
| 3 | Subtask coverage | WARN | |

### Fixes Applied

<List mechanical fixes applied during validation, or "None".>

### Unresolved Issues

<FAIL items that could not be auto-fixed, or "None".>

### Warnings

<All WARN items for awareness, or "None".>
```
