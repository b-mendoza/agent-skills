---
title: "Execution Pipeline Harmonization Spec: Clarifying Assumptions"
status: "validated-canonical-spec"
skill_group_slug: "clarifying-assumptions"
slug_derivation: "Derived from the shared subject matter of the compared Jira-side and GitHub-side clarification workflows: both Phase 3 and Phase 6 flows dispatch the same `clarifying-assumptions` skill for plan-wide and task-level clarification-and-critique, while platform differences are limited to identifier shape and a small set of upstream artifact headings."
target_skill: "skills/clarifying-assumptions"
comparison_inputs:
  - "skills/orchestrating-jira-workflow/SKILL.md"
  - "skills/planning-jira-tasks/SKILL.md"
  - "skills/orchestrating-github-workflow/SKILL.md"
  - "skills/planning-github-issue-tasks/SKILL.md"
phase_inputs:
  - "docs/clarifying-assumptions-harmonization-report.md"
  - "docs/clarifying-assumptions-harmonization-triage-ledger.md"
  - "docs/clarifying-assumptions-harmonization-change-summary.md"
---

# Canonical Harmonization Spec

## Purpose

This specification defines the canonical execution pipeline contract for the
shared clarification layer used by the Jira-side and GitHub-side workflows.
It is the standalone harmonization target for `skills/clarifying-assumptions`
after Phase 2 validation.

The canonical subject is one workflow concept with two runtime entry points:

- plan-wide clarification before implementation starts (`MODE=upfront`)
- task-level clarification immediately before task execution (`MODE=critique`)

The pipeline, contract shapes, and subagent handoffs are shared. Platform
differences remain bounded to upstream identifier forms and a narrow set of
artifact-heading aliases.

## Shared Contract Shape Definitions

### Canonical identity

- Canonical work-item placeholder: `<KEY>`
- Runtime input name accepted by `clarifying-assumptions`: `TICKET_KEY`
- Jira runtime meaning: `TICKET_KEY=<JIRA ticket key>`
- GitHub runtime meaning: `TICKET_KEY=<ISSUE_SLUG>`

This alias is canonical because the clarification skill is shared across both
workflow families, while the parent workflows retain their platform-native
inputs.

### Top-level inputs

| Input | Required | Canonical meaning |
| --- | --- | --- |
| `TICKET_KEY` | Yes | Shared work-item key used in all clarification artifact paths |
| `MODE` | Yes | `upfront` or `critique` |
| `TASK_NUMBER` | Required for `MODE=critique` | Current task ordinal |
| `ITERATION` | No | Clarification pass count; default `1` |

### Required main-plan sections

The main plan file at `docs/<KEY>-tasks.md` must expose this downstream
contract shape:

| Canonical section contract | Accepted runtime shape |
| --- | --- |
| Platform-native summary section | `## Ticket Summary` or `## Issue Summary` |
| Problem framing | `## Problem Framing` |
| Assumptions | `## Assumptions and Constraints` |
| Cross-cutting questions | `## Cross-Cutting Open Questions` |
| Task inventory | `## Tasks` plus separate task headings |
| Validation surface | `## Validation Report` |
| Dependency surface | `## Dependency Graph` |

### Mode-specific upstream artifact sets

| Mode | Required artifacts |
| --- | --- |
| `upfront` | `docs/<KEY>-stage-1-detailed.md`, `docs/<KEY>-stage-2-prioritized.md` |
| `critique` | `docs/<KEY>-task-<N>-brief.md`, `docs/<KEY>-task-<N>-execution-plan.md`, `docs/<KEY>-task-<N>-test-spec.md`, `docs/<KEY>-task-<N>-refactoring-plan.md` |

### Shared subagent handoff shapes

| Dispatch target | Required inputs | Conditional inputs |
| --- | --- | --- |
| `critique-analyzer` | `MODE`, `TICKET_KEY`, `MAIN_PLAN_FILE`, `ARTIFACTS`, `CRITIQUE_REPORT_FILE` | `TASK_NUMBER` in `critique`; `PRIOR_DECISIONS_FILE` plus `PRIOR_DECISIONS_KIND` when `ITERATION > 1` |
| `question-manifest-builder` | `MODE`, `TICKET_KEY`, `PLAN_FILE`, `CRITIQUE_REPORT_FILE` | `TASK_NUMBER` plus `CURRENT_TASK_ARTIFACTS` in `critique` |
| `decision-recorder` | `TICKET_KEY`, `MODE`, `DECISIONS` | `ITERATION`; `DEFERRED_QUESTIONS`; `IMPLEMENTATION_UPDATES`; and in `critique` also `TASK_NUMBER`, `TASK_TITLE`, `RESOLVED_IRRELEVANT` |

### Shared output shapes

| Output surface | Canonical contract |
| --- | --- |
| Critique artifact | `docs/<KEY>-upfront-critique.md` or `docs/<KEY>-task-<N>-critique.md` |
| Main plan updates | `docs/<KEY>-tasks.md` updated with clarified state |
| Decisions log | `## Decisions Log` in the main plan |
| Per-task decisions file | `docs/<KEY>-task-<N>-decisions.md` in `critique` |
| Final summary flags | `RE_PLAN_NEEDED`, `BLOCKERS_PRESENT` |

### Orchestrator-level contract expectations

The parent workflow owns the clarification boundary contract at its entry and
exit points. The downstream clarification skill remains responsible for its
internal five-stage execution, while the orchestrator remains responsible for
the workflow-level validation and routing around that execution.

| Orchestrator responsibility | Canonical expectation |
| --- | --- |
| Entry points | Invoke `clarifying-assumptions` only at the parent workflow's plan-wide clarification boundary and task-level critique boundary |
| Input normalization | Pass the clarification skill its required top-level inputs exactly as declared in this spec, including alias normalization at the parent-workflow boundary when the platform-native identifier is not already `TICKET_KEY` |
| Precondition gating | Validate that the mode-specific upstream artifact set still exists before invoking the clarification skill |
| Re-plan routing | Treat `RE_PLAN_NEEDED=true` as a targeted loop back to the immediately preceding planning phase for the same work item or task, then re-run the clarification boundary |
| Blocker gating | Treat `BLOCKERS_PRESENT=true` as a hard stop before downstream write or execution phases |
| Postcondition validation | Validate only the clarification-owned artifact boundary after the skill returns: critique artifact plus decisions surface |
| User gate after clean clarification | Even when `BLOCKERS_PRESENT=false`, require the parent workflow's normal user confirmation before advancing into downstream write or execution phases |
| Mutation boundary | Keep Phase 3 and Phase 6 clarification-only at orchestrator level; implementation kickoff, platform mutations, and execution-state changes remain downstream to later phases |

These expectations are harmonized across Jira-side and GitHub-side
orchestrators. Platform-native validators may retain their own parameter names
and later-phase write models, but they must preserve the same clarification
boundary semantics.

### Stable per-item identity contract

- Critique report item IDs must remain stable across the full pipeline.
- Valid critique-origin prefixes are `PF<n>`, `TC<n>`, and `UI<n>`.
- Manifest-derived IDs may use deterministic non-critique prefixes such as
  `A<n>`, `CQ<n>`, `V<n>`, `TQ-<task>-<n>`, and `DQ-<task>-<n>`.
- `decision-recorder` must carry each manifest `Item ID` unchanged into
  recorded decisions and plan annotations.

## Canonical Pipeline Stages

The harmonized clarification pipeline has exactly five canonical stages in this
order for both Jira-side and GitHub-side workflows:

| Order | Stage name | Canonical purpose |
| --- | --- | --- |
| 1 | Load guidance | Read the design-thinking reference and the active mode playbook |
| 2 | Analyze artifacts | Dispatch `critique-analyzer` to inspect artifacts, verify the codebase, and write the critique artifact |
| 3 | Build manifest | Dispatch `question-manifest-builder` to transform critique plus plan context into an ordered manifest |
| 4 | Clarify inline | Walk manifest items with the developer, one item at a time, and collect decisions |
| 5 | Record decisions | Dispatch `decision-recorder` to update artifacts, validate them, and return the write summary |

No platform-specific variant may rename, reorder, skip, or merge these stages
inside the clarification skill contract.

## Stage Semantics By Mode

### `MODE=upfront`

- Scope: plan-wide clarification before implementation begins
- Critique sections required: `Problem Framing Critique`, `Technology Critique Items`
- Manifest focus: hard-gate framing issues, architectural assumptions,
  validation failures, cross-cutting questions, and Task 1 questions
- Deferred behavior: future-task questions are deferred, not resolved inline

### `MODE=critique`

- Scope: task-level clarification immediately before executing one task
- Critique sections required: `Technology Critique Items`, `User Impact Critique Items`
- Manifest focus: current-task critique, user-impact concerns, still-relevant
  deferred questions, and current-task unresolved assumptions
- Irrelevant behavior: deferred questions whose premise is no longer true are
  recorded as irrelevant rather than asked again

## Subagent Dispatch Conventions

### General dispatch rules

- Read the subagent definition immediately before dispatch.
- Pass only explicit inputs named in that subagent contract.
- Preserve artifact-path handoffs; do not inline raw artifact bodies into later
  stages unless the downstream contract explicitly requires it.
- Keep dependent stages sequential: Stage 3 depends on Stage 2 output, and Stage
  5 depends on Stage 4 decisions.

### Verdict routing conventions

| Source | Expected verdicts | Canonical routing |
| --- | --- | --- |
| `critique-analyzer` | `CRITIQUE: PASS`, `CRITIQUE: WARN`, `CRITIQUE: FAIL` | `FAIL` stops; `WARN` continues only if critique validity is preserved |
| `question-manifest-builder` | `MANIFEST: PASS`, `MANIFEST: WARN`, `MANIFEST: BLOCKED`, `MANIFEST: FAIL` | `BLOCKED` and `FAIL` stop; `WARN` continues with surfaced warning |
| `decision-recorder` | `RECORDING: PASS`, `RECORDING: WARN`, `RECORDING: BLOCKED`, `RECORDING: ERROR` | `BLOCKED` and `ERROR` stop; `WARN` continues with surfaced warning |

### Inline clarification conventions

- Ask one manifest item per message.
- Ask only manifest-backed questions.
- Carry each `Item ID` unchanged into recorded decisions.
- Use Model A only for Tier 3 problem-framing hard gates.
- Use Model B for all other items.
- Respect manifest `Skippable` rules instead of inventing new skip behavior.

## Platform-Specific Divergence Boundaries

Platform differences are valid only at these boundaries.

### Boundary 1: Work-item identity at parent-workflow entry

- Jira parent workflows operate on `TICKET_KEY` values such as `JNS-6065`.
- GitHub parent workflows operate on `ISSUE_SLUG` values such as `acme-app-42`.
- The shared clarification skill normalizes both to runtime input `TICKET_KEY`.

Justification: the clarification layer owns one artifact family and one
dispatch contract, so identifier normalization belongs at the parent-workflow to
shared-skill boundary, not inside later subagent stages.

### Boundary 2: Platform-native summary heading in the main plan

- Jira planning outputs `## Ticket Summary`.
- GitHub planning outputs `## Issue Summary`.
- The canonical clarification contract accepts either heading as the same input
  slot.

Justification: the heading text is platform-native upstream language, while the
clarification pipeline consumes the same semantic summary payload in both cases.

### Boundary 3: Upstream fetch and planning provenance

- Jira provenance: ticket snapshot and Jira planning artifacts.
- GitHub provenance: issue snapshot and GitHub planning artifacts.
- The clarification skill treats both only as pre-existing readable markdown at
  canonical path families.

Justification: provenance differences matter to fetch and planning skills, but
not to the clarification pipeline once artifact contracts are satisfied.

### Boundary 4: Parent orchestration phase numbering

- Jira and GitHub orchestrators both currently invoke clarification in Phases 3
  and 6.
- Those ordinals are parent-workflow metadata only and are outside the runtime
  contract of `clarifying-assumptions`.

Justification: coupling clarification-owned artifacts to parent phase numbers
creates unnecessary drift risk and breaks the shared-skill boundary.

### Boundary 5: Platform-specific downstream creation and execution phases

- Jira continues into subtask creation and Jira task execution.
- GitHub continues into task-issue creation and GitHub task execution.
- The clarification contract exposes only artifact updates and gate flags used by
  those later phases.

Justification: downstream side-effect behavior belongs to later workflow phases,
not to the clarification pipeline.

### Boundary 6: Parent validator parameter names

- Jira validator dispatches use `TICKET_KEY`.
- GitHub validator dispatches use `ISSUE_SLUG`.
- The shared clarification skill still receives the normalized runtime input
  name `TICKET_KEY`.

Justification: validator dispatches are parent-workflow-local contracts, while
the clarification skill boundary remains normalized and shared.

### Boundary 7: Parent user-gate wording after clarification

- Jira may present Jira-specific next-step language before Phase 4 or Phase 7.
- GitHub may present GitHub-specific next-step language before Phase 4 or Phase
  7.
- Both orchestrators must still preserve the same clarification-owned gate
  semantics: stop on blockers, re-plan on `RE_PLAN_NEEDED`, and require an
  explicit user go-ahead before mutation phases.

Justification: prompt wording may stay platform-native, but the branching logic
at the clarification boundary is shared and contractually stable.

## Decisions Made During This Pass

### F-001: Neutral summary-slot alias accepted

- Decision: the canonical input contract now names the platform-native summary
  section explicitly as `## Ticket Summary` or `## Issue Summary`.
- Rationale: the ledger classified the omission as a `FIX` because the upstream
  planning skills already advertised that section as consumed downstream, so the
  receiving skill needed an explicit handshake instead of an implicit one.

### F-002: Stable user-impact item IDs made explicit at the artifact boundary

- Decision: the critique template uses `Item ID` for user-impact rows.
- Rationale: the ledger classified this as a `FIX` because stable IDs already
  functioned as a durable cross-step contract from critique to manifest to
  recorder, and the generic `#` label weakened that parseable boundary.

### F-003: Subagent-local helper paths normalized to sibling-relative form

- Decision: helper references inside `skills/clarifying-assumptions/subagents/`
  use sibling-relative paths.
- Rationale: the ledger classified this as a `FIX` because mixed path bases in
  the same package introduced contract-shape drift and made the local runtime
  model harder to follow consistently.

### F-004: Parent phase ordinals removed from clarification-owned artifacts

- Decision: the per-task decisions-file schema records skill-owned metadata only
  and does not embed parent-workflow phase numbers.
- Rationale: the ledger classified this as a `FIX` because the skill already
  declared that phase numbers are outside its contract, so embedding
  `Phase: 6 — Critique` violated the stated boundary.

## Orchestrator Cascade Verification Outcome

This harmonization run verified the orchestrator-facing clarification boundary
against both parent workflows and the downstream `clarifying-assumptions`
contract. The Phase 0 report found no shape-level drift, the Phase 1 ledger
recorded no triage entries, and Phase 2 therefore applied no changes.

### Orchestrator-level FIX decisions from this run

The Phase 1 ledger recorded no `FIX` entries for the orchestrator cascade.

| Finding | Status | Rationale |
| --- | --- | --- |
| None | No fix applied | `docs/orchestrator-alignment-ledger-clarifying-assumptions.md` records `FIX = 0`, so Phase 2 correctly made no orchestrator or downstream contract changes |

### Orchestrator-level PRESERVE boundaries from this run

The Phase 1 ledger recorded no `PRESERVE` entries that required new
orchestrator-level divergence handling beyond the standing platform boundaries
already captured in this spec.

| Boundary | Status | Notes |
| --- | --- | --- |
| None | No new preserve decisions | `docs/orchestrator-alignment-ledger-clarifying-assumptions.md` records `PRESERVE = 0` |

## Deferred Items

The Phase 1 ledger recorded no `DEFER` entries.

| Finding | Status | Notes |
| --- | --- | --- |
| None | No deferred work | `docs/clarifying-assumptions-harmonization-triage-ledger.md` reports `DEFER = 0` |
| Orchestrator cascade | No deferred work | `docs/orchestrator-alignment-ledger-clarifying-assumptions.md` records `DEFER = 0` |

## Spec Staleness / Follow-Up

The orchestrator alignment pass recorded no `SPEC_STALENESS` entries and no
additional follow-up items for the canonical clarification contract.

| Item | Status | Notes |
| --- | --- | --- |
| None | No staleness follow-up required | `docs/orchestrator-alignment-ledger-clarifying-assumptions.md` records `SPEC_STALENESS = 0` and the Phase 0 report found no spec lag at the orchestrator boundary |

## Known Non-Goals

- Defining Jira-specific fetch, write, or execution behavior
- Defining GitHub-specific fetch, `gh`, or execution behavior
- Redesigning the Phase 2 planning pipeline that produces the upstream task plan
- Changing the conversational mentoring style beyond what is required to keep a
  stable clarification contract
- Introducing runtime dependencies on this spec file or any Phase 0/1/2
  harmonization artifacts
- Defining implementation-code quality standards for Phase 7 execution

## Canonical Outcome

The validated canonical model is a single shared clarification pipeline with:

- one normalized work-item key at the clarification boundary
- one five-stage stage order
- one stable subagent chain
- one per-item identity contract
- tightly bounded platform divergence at upstream naming and provenance edges only

This specification is the canonical harmonization record for the validated
clarifying-assumptions workflow pair/group.
