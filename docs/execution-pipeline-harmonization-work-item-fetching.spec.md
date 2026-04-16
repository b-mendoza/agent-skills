---
title: "Execution Pipeline Harmonization Spec: Work Item Fetching"
skill_group_slug: "work-item-fetching"
slug_derivation: "The shared subject matter of the pair is fetching platform work items (GitHub issues and Jira tickets), so `work-item-fetching` is a short neutral label for the pair."
validated_skills:
  - "skills/fetching-github-issue"
  - "skills/fetching-jira-ticket"
generated_from:
  report: "docs/execution-pipeline-harmonization-work-item-fetching.phase0-report.md"
  triage: "docs/execution-pipeline-harmonization-work-item-fetching.phase1-triage-ledger.md"
  change_summary: "docs/execution-pipeline-harmonization-work-item-fetching.phase2-change-summary.md"
---

# Work-Item Fetching Harmonization Spec

## Purpose

This document is the canonical shape-level harmonization spec for the paired
Phase 1 work-item fetching skills after the fixes recorded in Phase 2.

It covers the post-Phase-2 shared execution contract for:

- coordinator inputs and outputs
- retriever subagent inputs and outputs
- pipeline stage names and ordering
- snapshot artifact shape
- subagent dispatch conventions
- allowed platform-specific divergence boundaries

It does not act as a runtime dependency. The skills remain self-contained and
distributable from their own `SKILL.md`, `subagents/`, and template files.

## Traceability

- Phase 0 report identified `P0-C1`, `P0-D1`, and `P0-V1`.
- Phase 1 ledger classified `P0-C1` and `P0-V1` as `FIX`, and `P0-D1` as
  `DEFER`.
- Phase 2 change summary recorded the applied stage-model and harness-agnostic
  contract wording fixes, with no new findings.

This spec reflects the on-disk state after Phase 2 for:

- `skills/fetching-github-issue`
- `skills/fetching-jira-ticket`

## Canonical Alias Model

This spec uses neutral aliases for comparison only:

- `<WORK_ITEM_URL>`: `ISSUE_URL` or `JIRA_URL`
- `<KEY>`: `ISSUE_SLUG` or `TICKET_KEY`
- `<ARTIFACT_PATH>`: `docs/<KEY>.md`
- `<IDENTITY_LINE>`: `Issue: ...` or `Ticket: ...`
- `<STATE_LINE>`: `State: ...` or `Status: ... | Type: ...`
- `<BREAKDOWN_LINE>`: `Child issues: ...` or `Subtasks: ...`
- `<BREAKDOWN_SECTION>`: `## Child Issues` or `## Subtasks`

These aliases are documentation shorthand only. Runtime contracts keep the
platform-native field names exactly as defined in each skill.

## Pipeline Stages

### Coordinator pipeline

The coordinator stage model is shape-aligned across both skills:

1. Read the retriever subagent definition.
2. Dispatch the retriever with the stage input contract.
3. Interpret the structured summary it returns.
4. Report the file path, counts, warnings, and status to the caller.

### Retriever pipeline

The bundled retriever subagents use the same six-stage execution pipeline and
the same ordering:

1. `Validate the input and establish identifiers`
2. `Establish the tracker read path`
3. `Retrieve the parent issue` / `Retrieve the parent ticket`
4. `Retrieve child issues and linked issues` /
   `Retrieve subtasks and linked issues`
5. `Assemble the document`
6. `Post-write validation gate: validate, repair, and re-check`

Canonical stage interpretation:

- Stage 1 is the identifier and input-normalization gate.
- Stage 2 is the harmonized read-path gate introduced by Phase 2. It confirms
  that the current run has a supported tracker read path before retrieval
  begins.
- Stage 3 retrieves the parent work item and parent-scoped fields.
- Stage 4 retrieves the work-breakdown section and linked issues.
- Stage 5 loads the bundled template and writes the artifact.
- Stage 6 enforces the validation and repair loop before returning the final
  summary.

## Shared Contract Shapes

### Coordinator input shape

The paired coordinator skills accept the same top-level input structure category
but not the same exact identifier fields:

| Canonical slot | GitHub skill | Jira skill | Shape status |
| --- | --- | --- | --- |
| Primary URL input | `ISSUE_URL` | `JIRA_URL` | shared slot |
| Fallback coordinates | `OWNER`, `REPO`, `ISSUE_NUMBER` | none | deferred divergence |

Shared rules that do align:

- URL input is preferred when available.
- Coordinators may derive direct identifiers needed for dispatch.
- Coordinators pass only stage input values plus directly derived identifiers.

### Retriever input shape

The retriever subagents mirror the coordinator input contract:

- GitHub retriever accepts `ISSUE_URL`, or `OWNER` + `REPO` + `ISSUE_NUMBER`
  when the URL is absent.
- Jira retriever accepts `JIRA_URL` only.

This unresolved difference is preserved exactly as-is and documented under
`Deferred Items`.

### Artifact path shape

Both skills produce a single preserved Markdown artifact:

| Skill | Artifact pattern |
| --- | --- |
| GitHub | `docs/<ISSUE_SLUG>.md` |
| Jira | `docs/<TICKET_KEY>.md` |

Shared shape rules:

- at most one artifact per run
- artifact path is reported in the structured summary as `File written`
- artifact is preserved for resumability
- artifact is written, validated, and left in place, but not staged or committed

### Structured summary shape

Both retrievers return the same 12-line summary schema and line order. Only the
tracker-specific identity, state, and work-breakdown lines differ.

```text
FETCH: <PASS | PARTIAL | FAIL | ERROR>
Validation: <PASS | FAIL | NOT_RUN>
Failure category: <NONE | BAD_INPUT | NOT_FOUND | AUTH | TOOLS_MISSING | RATE_LIMIT | UNEXPECTED>
File written: <docs/<KEY>.md | None>
<IDENTITY_LINE>
<STATE_LINE>
Comments: <retrieved>/<found | N/A>
<BREAKDOWN_LINE>
Linked issues: <retrieved>/<found | UNKNOWN | N/A>
Attachments: <N | N/A>
Warnings: <None | semicolon-separated warnings>
Reason: <None | fatal reason>
```

Platform-native line mappings:

| Canonical slot | GitHub retriever | Jira retriever |
| --- | --- | --- |
| Identity line | `Issue: <owner>/<repo>#<N>: <Title | Unknown>` | `Ticket: <TICKET_KEY>: <Summary/Title | Unknown>` |
| State line | `State: <OPEN | CLOSED | Unknown>` | `Status: <status | Unknown> | Type: <type | Unknown>` |
| Work-breakdown line | `Child issues: <retrieved>/<found | UNKNOWN | N/A>` | `Subtasks: <retrieved>/<found | UNKNOWN | N/A>` |

### Status and count semantics

The paired skills share these state meanings:

- `FETCH: PASS`: retrieval and validation succeeded.
- `FETCH: PARTIAL`: artifact was written and validated, but some comments or
  related items could not be fully retrieved, or discovery of a related section
  could not be verified.
- `FETCH: FAIL`: deterministic failure.
- `FETCH: ERROR`: unexpected tool, environment, or validation-loop failure.

Shared count rules:

- `0/0` means the section was verified empty.
- `<retrieved>/UNKNOWN` means the parent work item was retrieved, but discovery
  for that related section could not be verified.
- `N/A` means the parent work item was never retrieved, so that downstream
  section did not run.
- `Attachments: <N>` counts rendered attachment entries.
- `Attachments: N/A` is used only when the parent work item was not retrieved.

Shared failure categories:

- `NONE`
- `BAD_INPUT`
- `NOT_FOUND`
- `AUTH`
- `TOOLS_MISSING`
- `RATE_LIMIT`
- `UNEXPECTED`

### Snapshot artifact shape

Both templates share the same locked core top-level section order:

1. `## Metadata`
2. `## Description`
3. `## Acceptance Criteria`
4. `## Comments`
5. `## Retrieval Warnings`
6. `<BREAKDOWN_SECTION>`
7. `## Linked Issues`

Both artifacts also share this common framing shape:

- title line: `# <KEY>: <title>`
- retrieval preamble with `Retrieved on`, `Source`, and a tracker context line
  that carries tracker identity plus repository or workspace/project context, as
  applicable
- required `## Metadata` table
- required explicit representation of empty-but-verified sections as `_None_`
- required unknown markers when a related-section discovery state could not be
  verified after parent retrieval
- required placeholder entries for discovered but unretrieved related items
- deterministic ordering for repeated sections

Platform-extension sections remain outside the locked core, but each platform
still keeps a stable top-level order for those extension sections:

| Skill | Ordered extension sections |
| --- | --- |
| GitHub | `## Labels`, `## Assignees`, `## Milestone`, `## Projects`, `## Attachments` |
| Jira | `## Attachments`, `## Custom Fields` |

For GitHub specifically, `## Projects` has a three-way rendered state in the
final on-disk contract:

- `_None_` when absence was verified
- `_Unknown. Project membership not determined: <reason>_` when project
  membership could not be determined
- valid rendered project content when membership was retrieved

The unknown-marker state is explicit and does not collapse to `_None_`.

### Validation-loop shape

The paired retrievers share the same validation-loop contract:

- write the artifact first
- re-read the artifact after writing
- validate against the bundled template's literal fenced Markdown shape
- run a targeted repair loop for missing or mismatched portions only
- stop after a maximum of 3 validation passes
- if validation still fails, return `FETCH: ERROR`, `Validation: FAIL`, and
  `Failure category: UNEXPECTED`

### Coordinator branching and error-handling pattern

Both coordinators branch on the structured summary fields, not on prose.

Shared branching rules:

- `FETCH: PASS` with `Validation: PASS`: report success and continue.
- `FETCH: PARTIAL` with `Validation: PASS`: report success with warnings and
  keep incompleteness explicit.
- `Validation: FAIL`: stop and surface contract failure.
- `FETCH: FAIL`: stop and surface the failure category plus reason.
- `FETCH: ERROR`: stop and surface the unexpected failure plus reason.
- any inconsistent pairing, such as `FETCH: PASS` with `Validation: NOT_RUN`, is
  treated as an error state.

## Subagent Dispatch Conventions

The paired coordinator skills use the same dispatch model:

- dispatch exactly one bundled retriever subagent
- read the retriever definition only when ready to dispatch it
- pass only stage input contract values plus directly derived identifiers
- keep only the retriever's structured summary in coordinator context
- do not inspect raw tracker payloads in the coordinator
- do not rewrite the artifact in the coordinator

The paired retriever subagents use the same boundary rules:

- the retriever is the only runtime unit in the stage that may inspect raw
  tracker payloads or build the snapshot artifact
- the retriever returns only the structured summary in its final reply
- intermediate tool output, payloads, and full artifact contents stay out of the
  final reply
- the bundled template is loaded only at document assembly time

## Platform-Specific Divergence Boundaries

The harmonized model preserves these divergence boundaries as legitimate because
they reflect tracker-native content or transport differences rather than shape
drift.

### Input locator model

- GitHub accepts either `ISSUE_URL` or fallback coordinates.
- Jira accepts `JIRA_URL` only.

Justification:
This difference remains unresolved because the Phase 1 ledger classified the
dispatch-shape convergence question as `DEFER`, not `FIX`.

### Tracker identity and state lines

- GitHub uses `Issue: ...` and `State: ...`.
- Jira uses `Ticket: ...` and `Status: ... | Type: ...`.

Justification:
These are platform-native identity and state representations explicitly allowed
inside an otherwise locked shared summary line order.

### Work-breakdown slot name

- GitHub uses `Child issues` / `## Child Issues`.
- Jira uses `Subtasks` / `## Subtasks`.

Justification:
The slot position is locked across both skills, but the section name remains
tracker-native because the underlying work-breakdown concepts and terminology
already differ between platforms.

### Read-path implementation details

- GitHub Stage 2 still uses `gh` command-level procedures inside the stage body.
- Jira Stage 2 still performs capability discovery across Jira-capable tools.

Justification:
Phase 1 authorized only a contract-level harmonization for GitHub, not removal
of `gh` as a lower-level implementation detail. The shared stage name and stage
purpose now align, while execution details remain platform-specific.

### Platform-extension snapshot sections

- GitHub includes labels, assignees, milestone, projects, and attachment URL
  references.
- Jira includes attachment metadata tables and custom fields.

Justification:
These sections are tracker-native extensions appended after the locked core
sections. They preserve platform-specific planning context without changing the
shared core artifact shape, while still keeping the stable per-platform top-
level order defined in the on-disk templates.

### Partial-state triggers beyond shared related-item rules

- GitHub treats indeterminate `## Projects` membership as a `PARTIAL` condition.
- Jira does not define a parallel unknown-discovery state for attachments or
  custom fields because those are populated from the parent ticket payload.

Justification:
This is a content-source difference, not a pipeline or summary-shape drift.
On GitHub, the corresponding artifact state is the explicit marker
`_Unknown. Project membership not determined: <reason>_`, not `_None_`.

## Decisions From This Pass

### `P0-C1` - Fixed

Decision:
Stage 2 is canonicalized across the paired retrievers as
`Establish the tracker read path`.

Rationale from Phase 1 ledger:
The ledger classified the finding as a pure paired-stage contract drift at the
same ordinal position and authorized harmonizing only the stage name and stage
purpose sentence, without changing tool-specific instructions inside the stage
body.

Result in final files:
Both retrievers now use the same stage-2 name and the same contract-level
purpose: confirm that the supported read path for the current run can perform
the required retrieval steps before retrieval begins.

### `P0-V1` - Fixed

Decision:
The GitHub retriever's contract layer now describes a supported GitHub read path
for the current run rather than naming `gh` as the contract itself.

Rationale from Phase 1 ledger:
The ledger authorized a contract-level wording fix only, to satisfy
harness-agnostic framing and dual-runtime expectations, while keeping `gh`
instructions available as lower-level execution detail.

Result in final files:
The GitHub retriever description, role statement, Stage 2 contract framing,
scope, and `TOOLS_MISSING` language are now harness-agnostic at the contract
layer, while the procedural read instructions still use `gh`.

### `P0-D1` - Deferred

Decision:
The input-contract divergence remains unchanged in the canonical spec.

Rationale from Phase 1 ledger:
The ledger states that the missing information is the intended cross-workflow
coordinator handoff contract: whether paired Phase 1 skills must accept the same
identifier forms, or whether tracker-specific locator shapes are allowed.

Result in final files:
GitHub still accepts `ISSUE_URL` or fallback coordinates, and Jira remains
`JIRA_URL`-only.

## Deferred Items

### `P0-D1`

- category: `DEFER`
- finding: The stage input contract shape differs between the paired skills.
- current state:
  GitHub accepts `ISSUE_URL` or `OWNER` + `REPO` + `ISSUE_NUMBER`; Jira accepts
  only `JIRA_URL`.
- reason deferred:
  The repository guidance does not establish whether Phase 1 retrieval
  coordinators must converge on one shared dispatch shape or preserve
  tracker-native locator models.
- blocking ambiguity:
  The intended cross-workflow coordinator handoff contract is unspecified.

## Known Non-Goals

This harmonization does not cover:

- making the GitHub and Jira workflows functionally identical
- removing tracker-native content differences from identity, state, work
  breakdown, or extension sections
- redesigning the input contract beyond what the final files already support
- changing tool-level implementation procedures beyond the contract-layer fixes
  authorized in the ledger
- adding references from the skills back to this spec
- turning this spec into a required runtime file for either skill
