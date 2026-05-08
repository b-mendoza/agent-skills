# Output Contract

Read this file when checking Phase 2 inputs, final artifact requirements,
branch-name requirements, or the special handling for issues that are already
GitHub child issues or sub-issues.

> **Reminder:** The required sections and per-task fields below are the
> binding output contract. For background on GitHub's parent-issue /
> sub-issue hierarchy or branch-name validity, see `./external-sources.md`
> (`github-sub-issues`, `git-check-ref-format`).

## Optional Source Lookups

Use the local contract first. Fetch external sources only for current platform
behavior or branch-name edge cases:

| Need | Source key in `./external-sources.md` |
| ---- | ------------------------------------- |
| GitHub parent / sub-issue semantics | `github-sub-issues` |
| Git branch-name edge case | `git-check-ref-format` |
| Team branch-prefix convention background | `conventional-branches`, `feature-branch-workflow` |

## Snapshot Contract

Input snapshot path: `docs/<ISSUE_SLUG>.md`

The snapshot must contain these sections before planning starts:

| Section | Purpose |
| ------- | ------- |
| `## Metadata` | Repository, issue number, parent/child state, status, and stable identifiers |
| `## Description` | Primary source for requirements |
| `## Acceptance Criteria` | Definition-of-done source material |
| `## Comments` | Scope changes, decisions, and clarifications |
| `## Retrieval Warnings` | Known gaps in fetched data |
| `## Child Issues` | Existing child work that should not be duplicated |
| `## Linked Issues` | Dependency and related-work context |
| `## Labels` | Classification and scope clues |
| `## Assignees` | Ownership context |
| `## Milestone` | Release or timebox context |
| `## Projects` | Planning context |
| `## Attachments` | Referenced supporting material |

If any required section is missing, treat Phase 1 as incomplete and stop at the
preflight gate.

## Final Plan Contract

Final artifact path: `docs/<ISSUE_SLUG>-tasks.md`

The final plan must preserve this top-level order:

1. `## Issue Summary`
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

Default parent-issue branch format:

```text
feature/<issue-slug-lower>-task-<n>-<short-task-slug>
```

Example:

```text
feature/acme-app-42-task-1-auth-schema
```

Use a team-provided branch prefix when one is explicit in the snapshot or
`DECISIONS`; otherwise use `feature/`. Keep the rest of the branch deterministic:
lowercase issue slug, `task-<n>`, and a short kebab-case task-title slug.

## Current-Child-Issue Mode

If `## Metadata` indicates the current work item is a GitHub child issue or
sub-issue, or the snapshot otherwise shows this is already child work, keep
implementation scoped to the current issue:

- Use one branch for all numbered task sections.
- Repeat that same `**Branch name:**` under each task.
- State in `## Execution Order Summary` that downstream GitHub child-issue
  creation should be skipped because the current issue is already child work.
- Keep the plan execution-oriented; do not create or recommend child issues of
  the child issue.

Default current-child-issue branch:

```text
feature/<issue-slug-lower>-<short-issue-slug>
```

## Return Handoff

The orchestrator returns only this summary:

```text
PLANNING: PASS | FAIL
ISSUE_SLUG: <ISSUE_SLUG>
File: <final file path or "not written">
Tasks: <N>
Branches: <N unique branch names>
Cross-cutting questions: <N>
Validation warnings: <N>
Failure category: PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE
Reason: <one line>
Artifacts preserved: <comma-separated paths>
```
