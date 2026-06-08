# Output Contract

Read this file when checking Phase 2 inputs, final artifact requirements,
branch-name requirements, or the special handling for work items that are
already child work. Platform tokens (`<SUMMARY_HEADING>`, child-item noun,
consumed snapshot sections, branch identifier slug) come from the active
playbook (`PLAYBOOK_PATH`).

> **Reminder:** The required sections and per-task fields below are the
> binding output contract. For background on the platform's parent / child
> hierarchy or branch-name validity, see `./external-sources.md` (the active
> playbook's `External-Source Routing` key, `git-check-ref-format`).

## Optional Source Lookups

Use the local contract first. Fetch external sources only for current platform
behavior or branch-name edge cases:

| Need | Source key in `./external-sources.md` |
| ---- | ------------------------------------- |
| Platform parent / child semantics | the active playbook's `External-Source Routing` key |
| Git branch-name edge case | `git-check-ref-format` |
| Team branch-prefix convention background | `conventional-branches`, `feature-branch-workflow` |

## Snapshot Contract

Input snapshot path: `docs/<KEY>.md`

The snapshot must contain these always-present sections before planning starts:

| Section | Purpose |
| ------- | ------- |
| `## Metadata` | Work-item identity, status, parent/child state, and stable identifiers |
| `## Description` | Primary source for requirements |
| `## Acceptance Criteria` | Definition-of-done source material |
| `## Comments` | Scope changes, decisions, and clarifications |
| `## Retrieval Warnings` | Known gaps in fetched data |
| `## Linked Issues` | Dependency and related-work context |
| `## Attachments` | Referenced supporting material |

In addition, the snapshot must contain every section listed in the active
playbook's `Consumed Snapshot Sections` (for example the child-work section
that should not be duplicated, plus any platform-specific planning-context
sections). If any required section is missing, treat Phase 1 as incomplete and
stop at the preflight gate.

## Final Plan Contract

Final artifact path: `docs/<KEY>-tasks.md`

The final plan must preserve this top-level order. `<SUMMARY_HEADING>` is the
active playbook's task-plan summary heading (for example `## Ticket Summary` or
`## Issue Summary`):

1. `<SUMMARY_HEADING>`
2. `## Execution Order Summary`
3. `## Problem Framing`
4. `## Assumptions and Constraints`
5. `## Cross-Cutting Open Questions`
6. `## Tasks`
7. `## Task N: <Title>` sections
8. `## Notes`
9. `## Dependency Graph`
10. `## Validation Report`

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

Branch names are generated after task numbering is stable in Stage 2. The
active playbook's `Branch Identifier` section supplies the lowercase slug.

Default parent-work-item mode:

```text
feature/<id-lower>-task-<n>-<short-task-slug>
```

Use a team-provided branch prefix when one is explicit in the snapshot or
`DECISIONS`; otherwise use `feature/`. Keep the rest of the branch
deterministic: lowercase identifier slug, `task-<n>`, and a short kebab-case
task-title slug. Validators must check both Git ref legality and this
deterministic branch shape. When a team-provided prefix is used, the prefix may
replace `feature/`, but the identifier slug, task number, and task-title slug
remain deterministic.

## Current-Child-Item Mode

If `## Metadata` indicates the current work item is already child work (per the
active playbook's `Current-Item Detection` cue), or the snapshot otherwise
shows this is already child work, keep implementation scoped to the current
work item:

- Use one branch for all numbered task sections.
- Repeat that same `**Branch name:**` under each task.
- State in `## Execution Order Summary` that downstream child-item creation
  should be skipped because the current work item is already child work (use
  the playbook's child-item noun).
- Keep the plan execution-oriented; do not create or recommend child items of
  the child item.

Default current-child-item branch:

```text
feature/<id-lower>-<short-work-item-slug>
```

When a team-provided prefix is used in Current-Child-Item Mode, the prefix may
replace `feature/`, but the identifier slug and short work-item slug remain
deterministic.

## Return Handoff

The orchestrator returns only this summary:

```text
PLANNING: PASS | FAIL
WORK_ITEM: <KEY>
File: <final file path or "not written">
Tasks: <N>
Branches: <N unique branch names>
Cross-cutting questions: <N>
Validation warnings: <N>
Failure category: PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE
Reason: <one line>
Artifacts preserved: <comma-separated paths>
```
