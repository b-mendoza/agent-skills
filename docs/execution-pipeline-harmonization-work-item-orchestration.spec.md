---
title: "Execution Pipeline Harmonization Spec: Work Item Orchestration"
slug: "work-item-orchestration"
slug_derivation: "Chosen from the shared function of the paired skills: orchestrating a single work item from initial fetch through work-item task planning, child-item creation, per-task execution handoff, resumability, and orchestration-layer dispatch decisions. 'Work item' is the cross-platform umbrella over Jira ticket and GitHub issue, and 'orchestration' distinguishes this coordinator contract from downstream execution or planning skills."
applies_to:
  - "skills/orchestrating-jira-workflow"
  - "skills/orchestrating-github-workflow"
source_inputs:
  - "docs/execution-pipeline-harmonization-work-item-orchestration.reconciliation.md"
  - "docs/execution-pipeline-harmonization-work-item-orchestration.triage-ledger.md"
  - "docs/execution-pipeline-harmonization-work-item-orchestration.change-summary.md"
  - "skills/orchestrating-jira-workflow"
  - "skills/orchestrating-github-workflow"
  - "CLAUDE.md"
status: "canonical"
phase: 3
---

# Execution Pipeline Harmonization Spec: Work Item Orchestration

## Purpose

This document is the canonical shape reference for the harmonized orchestration
contract shared by `skills/orchestrating-jira-workflow` and
`skills/orchestrating-github-workflow`.

It captures the shared contract shape for naming, ordering, dispatch, and
resumability after the Phase 2 fixes recorded in the triage ledger and change
summary. The skills remain self-contained and must not depend on this file at
runtime.

## Scope

This spec covers:

- shared contract field names, record shapes, and derivation patterns
- pipeline stage names and required ordering
- subagent dispatch conventions and phase-boundary contracts
- platform-specific divergence boundaries that are intentionally preserved
- decisions made during this harmonization pass

This spec does not introduce new phases, tools, dependencies, or runtime
behavior.

## Canonical Shared Contract Shape

### Top-level orchestrator identity

Both skills retain the same top-level coordinator shape:

- one work item per workflow run
- one stable local workflow key used for artifact naming and progress tracking
- one remote locator family used when platform reads or writes require canonical
  platform context
- resumable execution across phases 1-7
- all execution-heavy work delegated to downstream skills or co-located utility
  subagents

### Identity and locator fields

The shared input family is:

| Contract role | Jira slot | GitHub slot | Shared rule |
| ------------- | --------- | ----------- | ----------- |
| workflow key | `TICKET_KEY` | `ISSUE_SLUG` | Stable local identifier used for `docs/<WORK_KEY>*` artifacts and progress files |
| preferred remote locator | `JIRA_URL` | `ISSUE_URL` | Full platform URL is preferred when available |
| fallback remote locator | none beyond `TICKET_KEY` resume-only usage | `OWNER`, `REPO`, `ISSUE_NUMBER` | Fallback locator family may support resume or platform lookup when URL is absent |
| per-task selector | `TASK_NUMBER` | `TASK_NUMBER` | Selects exactly one task in phases 5-7 |

Shared rules:

- `<WORK_KEY>` means `TICKET_KEY` for Jira and `ISSUE_SLUG` for GitHub
- platform-specific remote locator fields may differ, but the stable local
  workflow key pattern is mandatory in both skills
- the orchestrator may resume local progress from the workflow key alone
- before dispatching any downstream skill or subagent that performs platform
  reads or writes against the remote system, the orchestrator must supply the
  full locator family accepted by that callee's declared input contract
- Jira remote-locator rule: the orchestrator must include `JIRA_URL` when
  dispatching a Jira callee whose declared contract requires workspace context,
  including workflow-level Phase 1 fetch and later Jira-dependent downstream
  phase skills that require the full Jira URL; `TICKET_KEY` alone is allowed
  only for Jira status-checker queries whose declared input contract accepts
  `TICKET_KEY` as the remote lookup key
- GitHub remote-locator rule: a dispatch that performs remote GitHub reads or
  writes must include either `ISSUE_URL` or the tuple `OWNER` + `REPO` +
  `ISSUE_NUMBER`; `ISSUE_SLUG` alone is insufficient for remote GitHub lookup

### Artifact path family

Both skills use the same artifact derivation pattern with a platform-specific
workflow key:

| Artifact role | Canonical pattern |
| ------------- | ----------------- |
| Phase 1 snapshot | `docs/<WORK_KEY>.md` |
| workflow progress | `docs/<WORK_KEY>-progress.md` |
| Phase 2 task plan | `docs/<WORK_KEY>-tasks.md` |
| Phase 2 intermediate 1 | `docs/<WORK_KEY>-stage-1-detailed.md` |
| Phase 2 intermediate 2 | `docs/<WORK_KEY>-stage-2-prioritized.md` |
| Phase 3 critique | `docs/<WORK_KEY>-upfront-critique.md` |
| task progress | `docs/<WORK_KEY>-task-<N>-progress.md` |
| Phase 5 brief | `docs/<WORK_KEY>-task-<N>-brief.md` |
| Phase 5 execution plan | `docs/<WORK_KEY>-task-<N>-execution-plan.md` |
| Phase 5 test spec | `docs/<WORK_KEY>-task-<N>-test-spec.md` |
| Phase 5 refactoring plan | `docs/<WORK_KEY>-task-<N>-refactoring-plan.md` |
| Phase 6 critique | `docs/<WORK_KEY>-task-<N>-critique.md` |
| Phase 6 decisions | `docs/<WORK_KEY>-task-<N>-decisions.md` |

Shape rules:

- phases 1-4 operate on the workflow-level artifact family
- phases 5-7 operate on the per-task artifact family plus the preserved
  workflow-level artifacts
- the orchestrator treats downstream skills as authoritative for internal file
  section structure, but the file-family presence and naming pattern above are
  shared orchestration contract

Required-presence rules on the normal path:

- always required after successful Phase 1: Phase 1 snapshot, workflow progress
- always required after successful Phase 2: Phase 2 task plan and both Phase 2
  intermediates, plus previously required artifacts
- always required after successful Phase 3: Phase 3 critique, updated Phase 2
  task plan, plus previously required artifacts
- always required after successful Phase 4: updated Phase 2 task plan carrying
  the Phase 4 handoff shape, plus previously required artifacts
- always required after successful Phase 5 for task `<N>`: task progress for
  `<N>` and all four Phase 5 task-planning artifacts, plus previously required
  workflow-level artifacts
- always required after successful Phase 6 for task `<N>`: both Phase 6
  critique artifacts for `<N>`, all required Phase 5 artifacts for `<N>`, plus
  previously required workflow-level artifacts
- always required before entering Phase 7 for task `<N>`: every artifact listed
  above through Phase 6 for the same task

Conditional-presence rules:

- `docs/<WORK_KEY>-task-<N>-progress.md` is required only for tasks that have
  entered Phase 5 or later
- per-task artifacts for task `<N>` are never required for task `<M>` where
  `M != N`
- artifacts for future unstarted tasks are not required

### Standard phase-boundary record shape

Both orchestrators share the same boundary-control model:

- `artifact-validator` handles explicit precondition and postcondition checks
- `progress-tracker` records workflow progress for phases 1-4 and per-task
  progress for phases 5-7
- clarification phases add summary flags that are separate from validation
  verdicts
- phase advancement occurs one boundary at a time

Shared field family:

| Contract | Shared fields |
| -------- | ------------- |
| artifact validation dispatch | workflow key, `PHASE`, `DIRECTION`, optional `TASK_NUMBER` |
| artifact validation result | `VALIDATION`, `Phase`, `Direction`, `File` or `Reason`, `Checks` |
| progress dispatch | workflow key, `ACTION`, plus action-specific fields |
| progress update fields | `PHASE`, `STATUS`, `SUMMARY`, optional `TASKS`, optional `TASK_NUMBER`, optional `TASK_TITLE` |
| clarification gate fields | `RE_PLAN_NEEDED`, `BLOCKERS_PRESENT` |

Allowed progress status values for updates are shared:

- `complete`
- `active`
- `failed`
- `skipped`

`pending` is a derived read-only summary state in both workflows.

### Validation-result contract shape

The validation result is a locked record shape.

Allowed `VALIDATION` values:

- `PASS`
- `FAIL`
- `ERROR`

Required fields for every validation result:

| Field | Required | Allowed values / shape |
| ----- | -------- | ---------------------- |
| `VALIDATION` | yes | `PASS`, `FAIL`, or `ERROR` |
| `Phase` | yes | `1` through `7`, emitted in the line `Phase: <N> | Direction: <...>` |
| `Direction` | yes | `precondition` or `postcondition`, emitted in the line `Phase: <N> | Direction: <...>` |

Conditional fields:

| Field | Required when | Forbidden when | Shape |
| ----- | ------------- | -------------- | ----- |
| `File` | `VALIDATION=PASS` or `VALIDATION=FAIL` | `VALIDATION=ERROR` | one path or path-family description naming the validated boundary target |
| `Checks` | `VALIDATION=PASS` or `VALIDATION=FAIL` | `VALIDATION=ERROR` | one or more check lines prefixed by `- ` |
| `Reason` | `VALIDATION=ERROR` | `VALIDATION=PASS` or `VALIDATION=FAIL` | one sentence naming what prevented validation |

Audit rules:

- a `PASS` or `FAIL` validation result is invalid if it omits `File`
- a `PASS` or `FAIL` validation result is invalid if it omits `Checks`
- an `ERROR` validation result is invalid if it includes `File` or `Checks`
- an `ERROR` validation result is invalid if it omits `Reason`
- `TASK_NUMBER` is required in the dispatch for task-specific boundaries only:
  Phase 5 precondition, Phase 5 postcondition, Phase 6 precondition, Phase 6
  postcondition, and Phase 7 precondition

### Progress-tracker contract shape

Both progress trackers expose the same action set:

- `read`
- `initialize`
- `update`
- `initialize_task`
- `update_task`

Shared action requirements:

| Action | Required additional fields |
| ------ | -------------------------- |
| `read` | none |
| `initialize` | none |
| `update` | `PHASE`, `STATUS`, `SUMMARY`; add `TASKS` only for Phase 4 completion |
| `initialize_task` | `TASK_NUMBER`, `TASK_TITLE` |
| `update_task` | `TASK_NUMBER`, `PHASE`, `STATUS`, `SUMMARY` |

Shared output skeleton:

```text
PROGRESS: OK | ERROR
Ticket|Issue: <workflow key>
Phases: 1 <state> | 2 <state> | 3 <state> | 4 <state>
Tasks: <summary when applicable>
Remaining:
  - Task <N> | <title> | Depends on: <dependencies> | Priority: <priority> | Status: <status>
Last activity: <timestamp or none> - <summary>
Resume from: <phase and optional task number>
```

Shape rules:

- output label differs by platform only at `Ticket:` vs `Issue:`
- workflow progress covers phases 1-4; per-task progress covers phases 5-7
- task metadata always preserves dependencies and priority when known
- Phase 4 completion is the handoff point where the workflow-level task table is
  populated or refreshed from downstream summary data

Required field rules for `PROGRESS: OK`:

| Field | Fresh start before tasks exist | Workflow has entered phases 1-4 only | Workflow has entered phases 5-7 |
| ----- | ------------------------------ | ------------------------------------ | ------------------------------- |
| `Ticket:` or `Issue:` | required | required | required |
| `Summary:` | required | forbidden | forbidden |
| `Phases:` | forbidden | required | required |
| `Tasks:` | forbidden | forbidden | required |
| `Remaining:` | forbidden | forbidden | required |
| `Last activity:` | forbidden | required | required |
| `Resume from:` | required | required | required |

Required field rules for `PROGRESS: ERROR`:

- exactly one identifier line: `Ticket:` or `Issue:`
- exactly one `Reason:` line
- no `Phases:`, `Tasks:`, `Remaining:`, `Last activity:`, `Summary:`, or
  `Resume from:` lines

Task-summary rules when phases 5-7 have been entered:

- `Tasks:` is required and must summarize task completion or active state
- `Remaining:` is required and must appear even if only one task remains
- every remaining task line must include task number, title, dependency summary,
  priority summary, and status summary
- the workflow-level task table is authoritative for dependency and priority
  metadata; per-task progress files may refine current phase/state only

Audit rules:

- a fresh-start `PROGRESS: OK` result is invalid if it includes `Phases:`
- a non-fresh-start `PROGRESS: OK` result is invalid if it omits `Phases:`
- a workflow that has entered phases 5-7 is invalid if `Tasks:` or `Remaining:`
  is omitted from `PROGRESS: OK`
- a `PROGRESS: ERROR` result is invalid if it includes resume-state fields

### Preflight contract shape

Both preflight checkers share the same contract family:

| Field | Shared meaning |
| ----- | -------------- |
| workflow key | labels the preflight report |
| `PHASES` | optional phase subset, accepts comma lists or inclusive ranges |
| optional platform locator context | supplied when later phases need platform-specific URL or repo/workspace context |

Shared output skeleton:

```text
PREFLIGHT: PASS | FAIL | ERROR
Ticket|Issue: <workflow key>
Phases: <checked phases>
Summary: <one sentence>
Available: <N> | Missing: <N> | Unknown: <N>

Missing:
- <dependency> (Phase <range>, used by <consumer>) - <install/configure action>

Unknown:
- <dependency> - <why it could not be verified>
```

Shared rules:

- `FAIL` means at least one requested required dependency is confirmed missing
- recommended-only dependencies are reportable but non-failing when unavailable
- `UNKNOWN` is for ambiguous checks; `ERROR` is for inability to complete the
  preflight itself
- dependency manifests declare the phase-owning downstream skill explicitly for
  equivalent phases in both workflows

Allowed top-level `PREFLIGHT` values:

- `PASS`
- `FAIL`
- `ERROR`

Required fields for `PREFLIGHT: PASS` or `PREFLIGHT: FAIL`:

- identifier line: `Ticket:` or `Issue:`
- `Phases:` line naming the checked phase set
- `Summary:` line
- `Available: <N> | Missing: <N> | Unknown: <N>` line

Conditional sections for `PREFLIGHT: PASS` or `PREFLIGHT: FAIL`:

- `Missing:` section is required when `Missing > 0`; forbidden when `Missing = 0`
- `Unknown:` section is required when `Unknown > 0`; forbidden when `Unknown = 0`

Required dependency-item reporting shape:

| Section | Required item shape | Required semantics |
| ------- | ------------------- | ------------------ |
| `Missing:` | `- <dependency> (Phase <range>, used by <consumer>) - <install/configure action>` | each item is a requested dependency with status `MISSING` |
| `Unknown:` | `- <dependency> - <verification ambiguity>` | each item is a requested dependency with status `UNKNOWN` |

Dependency-status semantics are locked:

| Dependency status | Meaning | Effect on top-level verdict |
| ----------------- | ------- | --------------------------- |
| `AVAILABLE` | dependency was checked and confirmed usable for the requested phase set | contributes only to `Available` count |
| `MISSING` | dependency was checked and confirmed unavailable or unusable | if dependency is required for any requested phase, top-level verdict must be `FAIL`; if dependency is recommended-only, top-level verdict must remain based on required dependencies only |
| `UNKNOWN` | checker could not verify availability reliably | contributes only to `Unknown` count; does not by itself force `FAIL` |

Rules for `PREFLIGHT: ERROR`:

- required fields: identifier line, `Phases:` line using checked phases or
  `unknown`, and `Summary:` line
- forbidden fields: `Available:`, `Missing:`, `Unknown:` count line, `Missing:`
  section, and `Unknown:` section

Audit rules:

- `Available + Missing + Unknown` must equal the number of requested manifest
  dependency entries after phase filtering and logical de-duplication rules
  stated by the manifest
- every requested dependency with status `MISSING` or `UNKNOWN` must appear in
  the matching section exactly once
- a preflight result is invalid if it reports a recommended-only missing
  dependency as the sole reason for top-level `FAIL`
- a preflight result is invalid if it omits the phase-owning downstream skill
  dependency from an equivalent phase manifest table

### Status-checker contract shape

The platform-query utility subagents share the same role shape but preserve
platform naming:

| Contract role | Jira | GitHub |
| ------------- | ---- | ------ |
| subagent name | `ticket-status-checker` | `issue-status-checker` |
| primary query key | `TICKET_KEY` | `ISSUE_SLUG` plus either `ISSUE_URL` or `OWNER` + `REPO` + `ISSUE_NUMBER` |
| default query type | `status` | `status` |
| extended query type | `full` | `full` |
| child-item query type | `subtasks` | `task-issues` with `subtasks` alias accepted |

Shared output pattern:

- top-level result token with `OK`, `PARTIAL`, or `ERROR`
- identifier line
- compact state summary lines
- no raw platform payloads

Shape rule:

- these checkers are critical when used in the main phase cycle where the skill
  says they are required, and non-critical when used only for pre-task context

### Error taxonomy shape

Both orchestrators preserve the same error-table slots for orchestration-level
recovery:

- skill failure
- missing artifact
- platform unavailable
- Phase 1 fetch failure category
- Phase 1 partial retrieval
- Phase 1 contract or unexpected failure
- subagent failure (non-critical)
- subagent failure (critical)
- user interruption
- quality gate failure
- execution kickoff blocker
- Phase 7 capability blocker
- task-executor ambiguity
- re-plan cycle exhausted

The canonical ambiguity slot name is `Task-executor ambiguity` in both skills.

Audit rule:

- future audits must treat any different label for the execution-ambiguity slot
  at the orchestration layer as a shape regression

## Canonical Pipeline Stages

### Workflow phase order

The canonical top-level phase order is:

| Order | Phase | Canonical name |
| ----- | ----- | -------------- |
| 1 | Phase 1 | Fetch Work Item |
| 2 | Phase 2 | Plan Tasks |
| 3 | Phase 3 | Clarify + Critique |
| 4 | Phase 4 | Create Child Items |
| 5 | Phase 5 | Plan Task Execution |
| 6 | Phase 6 | Clarify + Critique |
| 7 | Phase 7 | Readiness -> Kickoff -> Execution -> Documentation -> Requirements Verification -> Quality Gates -> Targeted Fix Cycle -> Final Report |

Ordering rules:

- phases 1-4 run once per workflow
- phases 5-7 repeat per selected task
- task selection occurs only after Phase 4 completes
- the orchestrator never auto-selects a task; the user chooses from the
  remaining tasks
- progression is boundary-driven: validator when applicable -> downstream skill
  -> validator when applicable -> progress update -> gate decision

Phase-cycle lock rules:

- Phases 1-4 use the full cycle `precondition validator if defined -> phase
  owner -> postcondition validator -> progress update -> gate decision`
- Phase 5 uses `precondition validator -> task-progress initialization if task
  file does not yet exist -> phase owner -> postcondition validator -> progress
  update -> automatic advance`
- Phase 6 uses `precondition validator -> phase owner -> postcondition
  validator -> progress update -> clarification gate decision`
- Phase 7 uses `precondition validator -> phase owner -> progress update ->
  execution-owned gate handling`; there is no orchestrator-level Phase 7
  postcondition validator

### Phase 7 internal ordering

The canonical Phase 7 stage order is:

| Order | Stage |
| ----- | ----- |
| 1 | Readiness |
| 2 | Kickoff |
| 3 | Execution |
| 4 | Documentation |
| 5 | Requirements Verification |
| 6 | Quality Gates |
| 7 | Targeted Fix Cycle |
| 8 | Final Report |

Ordering rules:

- readiness completes before kickoff
- kickoff is the first execution mutation boundary after Phase 6 approval
- requirements verification completes before any review gate runs
- quality gates are ordered, not parallelized, inside the downstream execution
  skill
- targeted fix cycles re-run only the failing path

## Subagent Dispatch Conventions

Both orchestrators share these dispatch conventions:

- read exactly one subagent definition before dispatching that subagent
- pass only the subagent's explicit input fields
- retain only the structured verdict and next-step-relevant details at
  orchestration level
- prefer stable identifiers, file paths, task numbers, and compact summaries
  over pasted artifact contents
- keep dependent operations sequential
- allow parallel dispatch only for independent summary-only work, especially
  pre-task context gathering

### Shared utility subagent roles

The common orchestration utility family is:

| Role | Jira subagent | GitHub subagent |
| ---- | ------------- | --------------- |
| dependency check | `preflight-checker` | `preflight-checker` |
| artifact boundary check | `artifact-validator` | `artifact-validator` |
| progress management | `progress-tracker` | `progress-tracker` |
| platform status lookup | `ticket-status-checker` | `issue-status-checker` |
| codebase summary | `codebase-inspector` | `codebase-inspector` |
| code lookup | `code-reference-finder` | `code-reference-finder` |
| docs lookup | `documentation-finder` | `documentation-finder` |

Criticality rules:

- always critical at orchestration boundary: `preflight-checker`,
  `artifact-validator`, `progress-tracker`
- conditionally critical: status checker is critical only when the workflow
  phase contract explicitly requires it for phase advancement; it is
  non-critical when dispatched only for pre-task context
- always non-critical as pre-task context helpers: `codebase-inspector`,
  `code-reference-finder`, `documentation-finder`

### Downstream phase-owner mapping

The phase-owner slot is shared and mandatory for future harmonization:

| Phase | Jira skill | GitHub skill |
| ----- | ---------- | ------------ |
| 1 | `fetching-jira-ticket` | `fetching-github-issue` |
| 2 | `planning-jira-tasks` | `planning-github-issue-tasks` |
| 3 | `clarifying-assumptions` | `clarifying-assumptions` |
| 4 | `creating-jira-subtasks` | `creating-github-child-issues` |
| 5 | `planning-jira-task` | `planning-github-task` |
| 6 | `clarifying-assumptions` | `clarifying-assumptions` |
| 7 | `executing-jira-task` | `executing-github-task` |

Shape rules:

- every equivalent phase has an explicit owner skill in the skill table and in
  the preflight manifest
- the clarification phase owner is the same skill in both workflows; only the
  workflow identity mapping differs
- GitHub Phase 3 and Phase 6 still map `ISSUE_SLUG` into `TICKET_KEY` for the
  shared downstream clarification skill; this is a dispatch adapter, not a shape
  divergence

## Platform-Specific Divergence Boundaries

These divergences are intentionally preserved and are not harmonization defects.

### Work-item identity and transport

- Jira uses `JIRA_URL` and `TICKET_KEY`
- GitHub uses `ISSUE_URL` or `OWNER` + `REPO` + `ISSUE_NUMBER`, plus derived
  `ISSUE_SLUG`

Justification: the platforms expose different canonical locators and local key
derivation needs.

Shape-locked despite divergence:

- each workflow must expose exactly one stable local workflow key used across
  artifact naming and progress tracking
- each workflow must define one preferred canonical remote locator and the rules
  for any fallback locator family
- the local workflow key alone must never be treated as sufficient for remote
  platform lookup unless the relevant subagent contract explicitly says so

### Platform query and mutation transport

- Jira orchestration relies on Jira MCP
- GitHub orchestration relies on `gh`

Justification: transport differences are runtime-platform concerns, not shape
contract defects.

Shape-locked despite divergence:

- one named transport family must be stated for each platform
- preflight must check transport availability for the phases whose manifest rows
  declare that transport dependency
- transport divergence must not change the shared phase order, dispatch
  sequencing, or report skeletons

### Child-item naming and handoff labels

- Jira uses `## Jira Subtasks` and inline `Jira Subtask:` markers
- GitHub uses `## GitHub Task Issues`, a machine handoff comment, and inline
  `GitHub Task Issue:` markers

Justification: the downstream child-item creation skills encode different
platform object models and resumable references.

Shape-locked despite divergence:

- Phase 4 postcondition must still produce one workflow-level table and exactly
  one inline child-item reference per numbered task section
- the workflow-level handoff must remain resumable and machine-readable

### Phase 1 snapshot section details

- Jira snapshot headings are Jira-ticket-specific
- GitHub snapshot headings are GitHub-issue-specific and include GitHub-only
  concepts such as labels, assignees, milestone, and projects

Justification: snapshot content reflects platform data models even though the
orchestration phase ordering is shared.

Shape-locked despite divergence:

- Phase 1 remains a single snapshot artifact at `docs/<WORK_KEY>.md`
- the snapshot must preserve a locked top-level heading order defined by the
  downstream fetch skill for that platform
- the fetch summary remains a locked 12-line structured report interpreted by
  the orchestrator before postcondition validation
- `FETCH: PARTIAL` with `Validation: PASS` remains a success path, not a failure

### Phase 4 write-model flexibility

- Jira Phase 4 assumes Jira subtask creation semantics
- GitHub Phase 4 supports native child issues, linked issues, or task-list
  references, but still must emit a uniform resumable handoff table and inline
  per-task references

Justification: GitHub capabilities vary by environment and CLI/API support,
while Jira subtask behavior is narrower.

Shape-locked despite divergence:

- the orchestration contract still requires a workflow-level Phase 4 handoff in
  `docs/<WORK_KEY>-tasks.md`
- the per-task inline reference line is mandatory for every numbered task in
  both workflows
- the workflow-level task metadata produced at Phase 4 must be sufficient to
  initialize or refresh progress tracking

### Status-checker locator requirements

- Jira status checks resolve directly from `TICKET_KEY`
- GitHub status checks require `ISSUE_URL` or `OWNER` + `REPO` + `ISSUE_NUMBER`
  in addition to `ISSUE_SLUG`

Justification: `ISSUE_SLUG` is a local artifact key, not a sufficient remote
locator on GitHub.

Shape-locked despite divergence:

- both workflows must provide one status-checker subagent for orchestration
  status reads
- both workflows must support `status` and `full` query modes
- child-item query mode name may diverge, but the checker must return the same
  `OK` / `PARTIAL` / `ERROR` result family and compact summary shape

## Decisions From This Harmonization Pass

### P0-CONSISTENCY-1

Canonical rule: equivalent preflight phase tables must declare the phase-owning
downstream skill explicitly in both workflows.

Ledger history: the triage ledger classified this as `FIX` because equivalent
phase tables should declare the owner skill consistently rather than relying on
partial or inferred contracts.

Applied outcome: the Jira preflight manifest now includes explicit owner-skill
rows for phases 1, 2, 4, 5, and 7, matching the GitHub table pattern.

### P0-CONSISTENCY-2

Canonical rule: the orchestration ambiguity slot is
`Task-executor ambiguity`.

Ledger history: the triage ledger tied the naming decision to repo naming
guidance and the existing task-execution canonical spec, which both use
`task-executor` as the shared execution-stage role noun.

Applied outcome: the GitHub error taxonomy now uses `Task-executor ambiguity`.

### P0-CONTRACT-1

Canonical rule: the GitHub preflight checker must explicitly accept optional
`ISSUE_URL`, `OWNER`, and `REPO` context alongside `ISSUE_SLUG` and `PHASES`.

Ledger history: the triage ledger classified the earlier mismatch as a direct
input-contract violation between orchestrator dispatch text and subagent input
table.

Applied outcome: the GitHub preflight checker input contract now matches the
orchestrator's documented URL or owner/repo context handoff.

### P0-CONTRACT-2

Canonical rule: GitHub pre-task dispatch to `issue-status-checker` must name the full
locator requirement, preferring `ISSUE_URL` and otherwise requiring `OWNER` +
`REPO` + `ISSUE_NUMBER` with `ISSUE_SLUG`.

Ledger history: the triage ledger classified the earlier omission as an
under-specified handoff between the task-loop playbook and a co-located
subagent.

Applied outcome: the GitHub task-loop dispatch guidance now states the locator
inputs explicitly.

### P0-DRIFT-1

Canonical rule: recommended-only dependencies are reportable but non-failing in
preflight.

Ledger history: the triage ledger identified a contradiction between checker text and
manifest classification and resolved it in favor of the manifest's
recommended-only rule.

Applied outcome: both preflight checker subagents now keep the overall verdict
based on required dependencies only.

### P2-ADDENDUM-1

Canonical rule: when a manifest classification rule says recommended-only status must
be marked explicitly in phase tables, the row itself must carry that marking.

Ledger history: the Phase 2 addendum classified the Jira Phase 7 `context7` row
as a shape-level inconsistency inside the manifest, not a platform difference.

Applied outcome: the Jira Phase 7 manifest row explicitly labels
`context7 MCP (recommended-only)`.

## Deferred Items

None. The triage ledger does not contain any entries classified as `DEFER`.

Canonical statement: this harmonization pass leaves no unresolved deferred
shape-level questions for the shared work-item orchestration contract.

## Known Non-Goals

This harmonization explicitly does not cover:

- changing downstream skill behavior or artifact internals beyond the
  orchestration boundary shape
- unifying Jira and GitHub platform data models into one runtime schema
- changing transport choices such as Jira MCP or `gh`
- making the skills depend on this spec file at runtime
- adding new workflow phases, new utility subagents, or new review gates
- changing platform-specific child-item creation semantics beyond the shared
  resumable handoff shape
- redefining the downstream execution pipeline already covered by the canonical
  task-execution spec

## Audit Rules For Future Harmonization

Future audits should treat the following as shape regressions unless a later
canonical spec supersedes this one:

- removing or renaming an equivalent workflow phase without parallel change in
  the sibling skill
- changing the standard phase order or the embedded Phase 7 stage order
- omitting explicit phase-owner skill rows from equivalent preflight manifests
- introducing orchestrator-to-subagent input mismatches for declared dispatches
- changing the ambiguity taxonomy away from `Task-executor ambiguity`
- treating recommended-only dependencies as preflight-failing requirements
- making either workflow depend on this spec file instead of remaining
  self-contained

Core audit hooks:

- verify the validation-result record shape against the locked `PASS` / `FAIL` /
  `ERROR` field rules in this spec
- verify progress output against the locked fresh-start, workflow-only, and
  task-entered output shapes in this spec
- verify preflight output counts and dependency-item sections against the locked
  `AVAILABLE` / `MISSING` / `UNKNOWN` semantics in this spec
- verify artifact presence claims against the always-required versus conditional
  artifact rules in this spec
- verify every allowed platform divergence against its explicit stop-line in the
  divergence section; anything outside those stop-lines is drift, not allowed
  variance

## Self-Containment Note

This spec is an auditing and harmonization artifact only. The authoritative
runtime contracts remain inside the two skills and their co-located references
and subagents.
