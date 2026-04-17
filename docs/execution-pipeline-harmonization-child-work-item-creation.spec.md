---
title: "Execution Pipeline Harmonization Spec: Child Work-Item Creation"
skill_group_slug: "child-work-item-creation"
slug_derivation: "Derived from the shared subject matter of creating child issues in GitHub and subtasks in Jira under a parent work item."
validated_skills:
  - "skills/creating-github-child-issues"
  - "skills/creating-jira-subtasks"
generated_from:
  report: "docs/child-work-item-creation-phase-0-reconciliation-report.md"
  triage: "docs/child-work-item-creation-phase-1-triage-ledger.md"
  change_summary: "docs/child-work-item-creation-phase-2-change-summary.md"
---

# Child Work-Item Creation Harmonization Spec

## Purpose

This document is the canonical shape-level harmonization reference for the
paired Phase 4 child work-item creation skills after the Phase 1 triage and the
Phase 2 no-op pass.

It defines the shared execution contract for:

- coordinator inputs and outputs
- subagent inputs and outputs
- plan-artifact additions
- pipeline stage names and ordering
- subagent dispatch conventions
- allowed platform-specific divergence boundaries

It does not act as a runtime dependency. The validated skills remain
self-contained in their own `SKILL.md`, `subagents/`, `templates`, and
reference files.

## Traceability

- Phase 0 report identified six shape-level drift findings: `F-001` through
  `F-006`.
- Phase 1 ledger classified `F-003`, `F-004`, and `F-006` as `PRESERVE`, and
  `F-001`, `F-002`, and `F-005` as `DEFER`.
- Phase 2 change summary recorded that zero entries were marked `FIX`, zero
  fixes were applied, and the target skill files were left unchanged.

This spec therefore codifies the current on-disk contract without introducing
new runtime changes.

## Canonical Alias Model

This spec uses neutral aliases for comparison only:

- `<PARENT_URL>`: `ISSUE_URL` or `JIRA_URL`
- `<PARENT_KEY>`: `ISSUE_SLUG` or `TICKET_KEY`
- `<PLAN_PATH>`: `docs/<PARENT_KEY>-tasks.md`
- `<WORK_ITEM_SECTION>`: `## GitHub Task Issues` or `## Jira Subtasks`
- `<INLINE_REF_LINE>`: `GitHub Task Issue: ...` or `Jira Subtask: ...`
- `<VERDICT_KEY>`: the platform-native top-level summary verdict line

These aliases are documentation shorthand only. Runtime contracts keep the
platform-native field names exactly as defined by each skill.

## Pipeline Stages

### Coordinator pipeline

Both top-level skills use the same four-stage coordinator pipeline and the same
ordering:

1. Read the bundled child-item creation subagent definition.
2. Dispatch the subagent with the parent URL input.
3. Interpret the structured summary returned by the subagent.
4. Report only the concise phase summary to the caller.

### Subagent pipeline

Both bundled subagents use the same nine-stage execution pipeline and ordering:

1. `Resolve the parent and load the plan`
2. `Verify the parent work item`
3. `Capture existing linkage before creating anything`
4. `Verify existing refs are safe to reuse`
5. `Prepare task payloads`
6. `Create only the missing child work items`
7. `Update the local plan file idempotently`
8. `Validate and repair the artifact`
9. `Return the structured summary`

Canonical stage interpretation:

- Stage 1 derives stable identifiers and confirms the clarified task plan is
  present and parseable.
- Stage 2 confirms the parent work item can be fetched before any child writes.
- Stage 3 inventories existing per-task inline refs and workflow-table rows.
- Stage 4 enforces idempotent reuse and blocks unsafe cross-parent reuse.
- Stage 5 builds per-task child payloads from the clarified plan. GitHub also
  performs write-path detection here.
- Stage 6 performs sequential child creation and targeted retry on per-item
  rate limits.
- Stage 7 rewrites only the local Phase 4 plan artifact.
- Stage 8 re-reads, validates, repairs once, and re-checks without new child
  writes.
- Stage 9 emits only the contract-defined structured summary.

## Shared Contract Shapes

### Coordinator input shape

The paired coordinator skills accept the same input category with
platform-native field names:

| Canonical slot | GitHub skill | Jira skill | Shape |
| --- | --- | --- | --- |
| Parent URL input | `ISSUE_URL` | `JIRA_URL` | required scalar string |

Shared rules:

- the full parent URL is the authoritative downstream dispatch input
- the coordinator may derive stable identifiers for reporting only
- the coordinator dispatches the subagent with the parent URL rather than a
  rewritten reduced payload

### Derived identifier shape

Both skills derive stable parent identifiers from the parent URL, but keep
platform-native names:

| Canonical slot | GitHub skill | Jira skill | Notes |
| --- | --- | --- | --- |
| Parent reference | `OWNER/REPO#PARENT_NUMBER` | `TICKET_KEY` | caller-facing identity line |
| Stable artifact key | `ISSUE_SLUG` | `TICKET_KEY` | used in plan-file path |
| Plan artifact path | `docs/<ISSUE_SLUG>-tasks.md` | `docs/<TICKET_KEY>-tasks.md` | fixed Phase 4 artifact |

### Plan precondition shape

For normal Phase 4 execution, both skills expect the clarified plan to contain:

1. `## Tasks`
2. one or more numbered `## Task <N>:` headings
3. `## Execution Order Summary`
4. `## Decisions Log`

Shared precondition semantics:

- missing or malformed task sections produce the blocked outcome
- missing `## Decisions Log` is warning-eligible rather than blocking
- numbered task sections are the parse boundary for Phase 4
- `## Execution Order Summary` is preserved when present but is not the parse
  unit for child-item creation

### Per-task parse shape

Both subagents parse the same task subsection family when present:

1. `Objective`
2. `Relevant requirements and context`
3. `Dependencies / prerequisites`
4. `Questions to answer before starting`
5. `Implementation notes`
6. `Definition of done`
7. `Likely files / artifacts affected`
8. `Priority`

Shared rules:

- each numbered task maps to exactly one workflow-table row
- dependencies are normalized as plan values such as `None`, `1`, or `1,2`
- priority is preserved from the plan or rendered as `Unknown`

### Output artifact shape

Both skills update exactly one plan artifact in place:

| Skill | Artifact path |
| --- | --- |
| GitHub | `docs/<ISSUE_SLUG>-tasks.md` |
| Jira | `docs/<TICKET_KEY>-tasks.md` |

Shared artifact rules:

- update only the Phase 4 plan artifact for the current parent
- insert or refresh one workflow section for child work-item linkage
- place the workflow section after the platform summary section when present;
  otherwise after the first top-level heading
- ensure exactly one per-task inline reference line immediately after each
  numbered task heading
- ensure exactly one workflow row per parsed task
- keep artifact repair local; do not create new child items during repair

### Workflow section shape

Both platforms add a single top-level workflow section with this shared shape:

1. platform-native section heading
2. optional platform metadata layer immediately below the heading
3. one fixed-column Markdown table with exactly one row per parsed task

Shared workflow-row slots:

| Canonical slot | GitHub artifact | Jira artifact |
| --- | --- | --- |
| Task index | `Task` | `Task` |
| Child reference | `Issue ref` | `Subtask Key` |
| Title | `Title` | `Title` |
| Platform status | `Status` | `Status` |
| Dependencies | `Dependencies` | `Dependencies` |
| Priority | `Priority` | `Priority` |

Shared row semantics:

- one row per parsed `## Task <N>:` section
- `Title` mirrors the numbered task title, typically `Task <N>: <Short title>`
- `Dependencies` and `Priority` mirror the plan rather than derived runtime
  guesses
- concrete child references must match the per-task inline reference line
- failed creates use `Not Created` in the child-reference column and in the
  platform status slot

### Per-task inline reference shape

Both platforms require exactly one inline child-reference line on the first line
after each numbered task heading:

| Skill | Required line shape |
| --- | --- |
| GitHub | `GitHub Task Issue: <owner/repo#number | Not Created | task-list>` |
| Jira | `Jira Subtask: <KEY | Not Created>` |

Shared semantics:

- the prefix is fixed and validator-consumed
- the value must match the workflow-table row for the same task
- duplicate inline lines are repaired down to exactly one

### Structured summary shape

Both subagents return a line-oriented summary with the same overall structure:

1. top-level verdict line
2. `Validation: PASS | FAIL | NOT_RUN`
3. `Parent: ...`
4. explicit stable identifier line
5. `Plan file: <path | not updated>`
6. count lines for tasks in plan, already linked, created now, failed creates
7. `Decisions Log: PRESENT | MISSING`
8. `Reason: <one line>`
9. created/linked child-items table
10. explicit `Warnings:` section
11. explicit `Failures:` section

Shared summary status set:

- `PASS`
- `WARN`
- `FAIL`
- `BLOCKED`
- `ERROR`

Shared validation semantics:

- `Validation: PASS` means the local artifact passed post-write validation
- `Validation: FAIL` means the local artifact still violated the Phase 4
  contract after one repair pass
- `Validation: NOT_RUN` is used only when the run failed before plan-file update
  or post-write validation could occur

Shared early-exit behavior:

- the explicit identifier line remains required on every summary, including
  early exits
- the created/linked table may be header-only only for early `BLOCKED`, `FAIL`,
  or `ERROR` exits before complete plan update / create summary generation
- `Warnings:` and `Failures:` are always present, even when they contain only
  `None`

## Subagent Dispatch Conventions

Both coordinator skills follow the same dispatch rules:

- read the subagent definition only when about to dispatch it
- dispatch exactly one bundled subagent per run
- pass the parent URL input unchanged as the authoritative context value
- keep plan parsing, platform operations, and plan-file edits inside the
  subagent
- use only the structured summary as routing input in the coordinator
- if subagent dispatch is unavailable, report the phase as blocked rather than
  reproducing the subagent inline

Canonical dispatch mapping:

| Coordinator skill | Subagent | Dispatch input |
| --- | --- | --- |
| `creating-github-child-issues` | `task-issue-creator` | `ISSUE_URL` |
| `creating-jira-subtasks` | `subtask-creator` | `JIRA_URL` |

## Platform-Specific Divergence Boundaries

The following divergences are intentional contract boundaries and must not be
flattened away without a new harmonization decision.

### 1. GitHub machine handoff comment vs. Jira no-comment path

- GitHub artifact requires a `<!-- phase4-handoff ... -->` comment immediately
  under `## GitHub Task Issues`.
- Jira artifact has no equivalent metadata-comment layer.
- Justification: Phase 1 classified `F-003` as `PRESERVE` because GitHub must
  serialize detected `model` and `capability` state across multiple write paths,
  while Jira has no corresponding write-model matrix.

### 2. Workflow table schema extensions

- GitHub artifact table includes `Issue ref`, `Write model`, and `Status`.
- Jira artifact table includes `Subtask Key` and `Status`, with no `Write model`
  column.
- Justification: Phase 1 classified `F-004` as `PRESERVE` because GitHub can
  produce native sub-issues, linked issues, or task-list-only traceability,
  while Jira uses a single native subtask path.

### 3. Structured summary metadata extensions

- GitHub summary requires `ISSUE_SLUG:`, `Write model:`, and `Capability:`.
- Jira summary requires `TICKET_KEY:` and explicitly omits write-model and
  capability lines.
- Justification: the stable explicit identifier line is shared, but GitHub's
  extra metadata is operationally required to explain which Phase 4 write path
  actually ran.

### 4. Created/linked summary table schema extensions

- GitHub summary table is `Created/Linked Task Issues:` with `Issue ref` and
  `Write model` columns.
- Jira summary table is `Created/Linked Subtasks:` with `Subtask Key` and no
  `Write model` column.
- Justification: Phase 1 classified `F-006` as `PRESERVE` because the two
  platforms expose different child-linkage outcome models.

### 5. GitHub-only `task-list` traceability outcome

- GitHub permits `task-list` as a deliberate plan-only linkage outcome in both
  the artifact and the summary.
- Jira has no equivalent plan-only child-linkage mode in this Phase 4 contract.
- Justification: GitHub's contract explicitly supports fallback traceability
  when concrete issue creation is not possible for a task; Jira Phase 4 is
  defined around concrete subtasks or `Not Created`.

## Decisions Recorded In This Pass

### Documentation-only canonicalization

No Phase 2 fixes were applied. The Phase 2 change summary records:

- `FIX` entries: `0`
- applied fixes: `0`
- target skill files changed: `No`

This Phase 3 spec therefore records the canonical harmonization boundary from
the current files rather than describing any post-Phase-2 code or contract edit.

### Preserved decisions from the Phase 1 ledger

1. `F-003` remains preserved.
   Rationale: GitHub's machine handoff comment is required by its multi-path
   write-model contract; Jira has no equivalent metadata need.

2. `F-004` remains preserved.
   Rationale: workflow-table columns differ because GitHub supports multiple
   linkage modes and Jira does not.

3. `F-006` remains preserved.
   Rationale: downstream created/linked summary rows must reflect each
   platform's real linkage outcomes, so a forced common table would either drop
   GitHub data or invent Jira-only placeholders.

### Deferred naming decisions from the Phase 1 ledger

1. `F-001` was not resolved.
   Rationale: no prompt-anchored neutral top-level verdict key was specified.

2. `F-002` was not resolved.
   Rationale: no canonical neutral plan-artifact section heading was specified.

3. `F-005` was not resolved as a single change.
   Rationale: the finding bundled unresolved naming drift together with valid
   platform-specific metadata differences, so Phase 1 treated it as an ambiguous
   mixed finding.

## Deferred Items

Every Phase 1 `DEFER` entry remains unresolved and is listed here verbatim in
decision terms.

### F-001

- finding reference: `F-001`
- unresolved drift: top-level structured verdict key drift between
  `TASK_ISSUES:` and `SUBTASKS:`
- why deferred: no canonical neutral verdict key was specified, so choosing a
  shared replacement would be stylistic rather than rule-driven
- current outcome: the naming drift remains intentionally unresolved in the
  runtime contracts

### F-002

- finding reference: `F-002`
- unresolved drift: plan-artifact section heading drift between
  `## GitHub Task Issues` and `## Jira Subtasks`
- why deferred: no neutral shared heading was specified, so choosing one would
  be a stylistic coin-flip
- current outcome: the platform-native headings remain intentionally unresolved

### F-005

- finding reference: `F-005`
- unresolved drift: bundled structured summary line/key drift combining naming
  differences with legitimate GitHub-only metadata lines
- why deferred: the report item mixed naming drift with valid platform-specific
  fields, so there was no prompt-anchored way to resolve it as one change
- current outcome: the summary envelopes remain platform-native, with GitHub's
  extra metadata preserved and the naming-level harmonization left unresolved

## Known Non-Goals

This harmonization spec does not cover:

- how the parent workflow obtains user approval before Phase 4 writes
- how upstream planning or clarification phases generate `docs/<KEY>-tasks.md`
- concrete `gh` command syntax, Jira tool syntax, auth setup, or API payload
  details beyond contract shape
- runtime implementation details for creating child items, probing capability,
  or parsing plan content
- any change that makes either skill depend on this spec file at runtime
- unifying platform-native nouns where Phase 1 explicitly deferred the naming
  choice
- validating or changing vendored skills, lockfiles, or unrelated workflow docs
