# Output Contract

Read this file when checking Phase 2 inputs, final artifact requirements,
branch-name requirements, or the special handling for tickets that are already
Jira subtasks.

> **Reminder:** The required sections and per-task fields below are the
> binding output contract. For background on Jira's parent-ticket / subtask
> hierarchy or branch-name validity, see `./external-sources.md`
> (`jira-subtasks`, `git-check-ref-format`).

## Snapshot Contract

Input snapshot path: `docs/<TICKET_KEY>.md`

The snapshot must contain these sections before planning starts:

| Section | Purpose |
| ------- | ------- |
| `## Metadata` | Work-item type, status, parent, project, and other stable identifiers |
| `## Description` | Primary source for requirements |
| `## Acceptance Criteria` | Definition-of-done source material |
| `## Comments` | Scope changes, decisions, and clarifications |
| `## Retrieval Warnings` | Known gaps in fetched data |
| `## Subtasks` | Existing child work that should not be duplicated |
| `## Linked Issues` | Dependency and related-work context |
| `## Attachments` | Referenced supporting material |
| `## Custom Fields` | Additional requirements or constraints |

If any required section is missing, treat Phase 1 as incomplete and stop at the
preflight gate.

## Final Plan Contract

Final artifact path: `docs/<TICKET_KEY>-tasks.md`

The final plan must preserve this top-level order:

1. `## Ticket Summary`
2. `## Execution Order Summary`
3. `## Problem Framing`
4. `## Assumptions and Constraints`
5. `## Cross-Cutting Open Questions`
6. `## Tasks`
7. `## Task N: <Title>` sections
8. `## Dependency Graph`
9. `## Validation Report`

`## Problem Framing` must contain:

- `### End User`
- `### Underlying Need`
- `### Proposed Solution`
- `### Solution-Problem Fit`
- `### Alternative Approaches Not Explored`
- `### Evidence Basis`

Each numbered task must include:

- `**Priority:**`
- `**Branch name:**`
- `**Objective:**`
- `**Relevant requirements and context:**`
- `**Questions to answer before starting:**`
- `**Implementation notes:**`
- `**Definition of done:**`
- `**Likely files / artifacts affected:**`
- `**Dependencies / prerequisites:**`

Add `**Dependency rationale:**` immediately after
`**Dependencies / prerequisites:**` when a relationship needs explanation for
execution or review.

Phase 2 does not add `## Decisions Log`; Phase 3 appends that later.

## Branch Names

Branch names are generated after task numbering is stable in Stage 2.

Default parent-ticket mode:

```text
feature/<ticket-key-lower>-task-<n>-<short-task-slug>
```

Example:

```text
feature/jns-6065-task-1-auth-schema
```

Use a team-provided branch prefix when one is explicit in the snapshot or
`DECISIONS`; otherwise use `feature/`. Keep the rest of the branch deterministic:
lowercase work-item key, `task-<n>`, and a short kebab-case task-title slug.

## Current-Subtask Mode

If `## Metadata` indicates the current work item is a Jira subtask, or the
snapshot otherwise shows this is already child work, keep implementation scoped
to the current subtask:

- Use one branch for all numbered task sections.
- Repeat that same `**Branch name:**` under each task.
- State in `## Execution Order Summary` that downstream Jira subtask creation
  should be skipped because the current ticket is already a subtask.
- Keep the plan execution-oriented; do not create or recommend subtasks of the
  subtask.

Default current-subtask branch:

```text
feature/<ticket-key-lower>-<short-ticket-slug>
```

## Return Handoff

The orchestrator returns only this summary:

```text
PLANNING: PASS | FAIL
TICKET_KEY: <TICKET_KEY>
File: <final file path or "not written">
Tasks: <N>
Branches: <N unique branch names>
Cross-cutting questions: <N>
Validation warnings: <N>
Failure category: PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE
Reason: <one line>
Artifacts preserved: <comma-separated paths>
```
