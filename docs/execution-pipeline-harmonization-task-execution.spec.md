---
title: "Execution Pipeline Harmonization Spec: Task Execution"
slug: "task-execution"
slug_derivation: "Chosen from the shared skill-pair function: executing exactly one planned task through kickoff, implementation, verification, review, fix loops, and final reporting."
applies_to:
  - "skills/executing-jira-task"
  - "skills/executing-github-task"
source_inputs:
  - "docs/execution-pipeline-harmonization-task-execution.reconciliation-report.md"
  - "docs/execution-pipeline-harmonization-task-execution.triage-ledger.md"
  - "docs/execution-pipeline-harmonization-task-execution.change-summary.md"
  - "CLAUDE.md"
status: "canonical"
phase: 3
---

# Execution Pipeline Harmonization Spec: Task Execution

## Purpose

This document is the canonical shape reference for the harmonized execution
pipeline shared by `skills/executing-jira-task` and
`skills/executing-github-task`.

It defines the contract shape that future audits should compare against. The
skills remain self-contained and must not depend on this file at runtime.

## Scope

This spec covers:

- shared input, artifact, dispatch, and report shapes
- pipeline stage names and required ordering
- subagent dispatch conventions
- legitimate Jira/GitHub content divergence boundaries
- Phase 1 harmonization decisions that govern the current shared shape

This spec does not introduce new steps, tools, dependencies, or capabilities.

## Canonical Shared Contract Shape

### Skill identity and top-level behavior

Both skills must retain the same orchestration shape:

- one task per invocation
- exactly two explicit top-level inputs: a tracker workflow identifier and
  `TASK_NUMBER`
- readiness validation before kickoff
- kickoff as the first execution mutation boundary after critique approval
- implementation followed by documentation/commit work
- requirements verification before review gates
- ordered review gates
- targeted fix cycles that re-run only the failing path
- one final task-only outcome report

### Input shape

The top-level input contract is a two-field record:

| Field | Type | Required | Shared meaning | Platform slot |
| ----- | ---- | -------- | -------------- | ------------- |
| tracker workflow key | string | Yes | Derives artifact paths and tracker references | `TICKET_KEY` for Jira, `ISSUE_SLUG` for GitHub |
| `TASK_NUMBER` | integer-like string or integer | Yes | Selects exactly one planned task | same |

Shape rule:

- the first field may differ in name and example values by platform
- the second field remains `TASK_NUMBER`
- no third top-level execution selector is introduced by harmonization

### Artifact path family shape

Both skills use the same derivation pattern with one platform-specific root key:

| Artifact role | Canonical pattern |
| ------------- | ----------------- |
| tracker snapshot | `docs/<WORK_KEY>.md` |
| task plan | `docs/<WORK_KEY>-tasks.md` |
| execution brief | `docs/<WORK_KEY>-task-<N>-brief.md` |
| execution plan | `docs/<WORK_KEY>-task-<N>-execution-plan.md` |
| test spec | `docs/<WORK_KEY>-task-<N>-test-spec.md` |
| refactoring plan | `docs/<WORK_KEY>-task-<N>-refactoring-plan.md` |
| critique record | `docs/<WORK_KEY>-task-<N>-critique.md` |
| decisions record | `docs/<WORK_KEY>-task-<N>-decisions.md` |

Where:

- `<WORK_KEY>` maps to `TICKET_KEY` for Jira and `ISSUE_SLUG` for GitHub
- `<N>` maps to `TASK_NUMBER`

Readiness shape rule:

- all listed artifacts are required on the standard execution path before
  kickoff
- `decisions.md` is the authoritative tie-breaker when it conflicts with older
  planning text

### Artifact lifecycle shape

Both skills must preserve the same two-category lifecycle:

| Category | Shape |
| -------- | ----- |
| Category A | `docs/<WORK_KEY>*.md`, progress files, briefs, plans, test specs, refactoring plans, critique, decisions; kept on disk, never committed, never deleted by this pipeline |
| Category B | source, tests, config, in-code documentation; committed normally |

Lifecycle rule:

- `documentation-writer` may update Category A files on disk for workflow
  continuity, but commit scope is Category B only

### Symbolic handoff shape

The pipeline passes structured markdown reports between stages using fixed
symbolic names:

| Handoff | Produced by | Consumed by |
| ------- | ----------- | ----------- |
| `KICKOFF_REPORT` | `execution-starter` | orchestrator, then reporting logic |
| `EXECUTION_REPORT` | `task-executor` | `documentation-writer`, `requirements-verifier`, review gates |
| `DOCUMENTATION_REPORT` | `documentation-writer` | `requirements-verifier`, review gates |
| `VERIFICATION_RESULT` | `requirements-verifier` | review gates |
| `CODE_REVIEW` | `clean-code-reviewer` | `architecture-reviewer`, `security-auditor` |
| `ARCHITECTURE_REVIEW` | `architecture-reviewer` | `security-auditor` |

Shared handoff rule:

- these names refer to full structured markdown outputs, not free-form oral
  summaries
- downstream stages must preserve blocked/error states instead of inferring
  success from partial file changes

### Report section shape

The canonical report family uses fixed sectioned markdown with an explicit
top-level status or verdict line.

Required shared patterns:

- `execution-starter` returns `## Execution Kickoff Report` with `### Status`
- `task-executor` returns `## Execution Report` with `### Status`
- `documentation-writer` returns `## Documentation Report` with `### Status`
- `requirements-verifier` returns `## Requirements Verification` with
  `### Verdict`
- review gates return a review-specific title with `### Verdict`

Shared status vocabulary by stage:

| Stage family | Allowed values |
| ------------ | -------------- |
| kickoff | `READY`, `BLOCKED`, `ERROR` |
| execution | `COMPLETE`, `NEEDS_CONTEXT`, `BLOCKED`, `ERROR` |
| documentation | `COMPLETE`, `BLOCKED`, `ERROR` |
| requirements verification | `PASS`, `FAIL`, `BLOCKED`, `ERROR` |
| clean-code review | `PASS`, `PASS WITH SUGGESTIONS`, `NEEDS FIXES`, `BLOCKED`, `ERROR` |
| architecture review | `PASS`, `PASS WITH SUGGESTIONS`, `NEEDS FIXES`, `BLOCKED`, `ERROR` |
| security audit | `PASS`, `PASS WITH ADVISORIES`, `NEEDS FIXES`, `BLOCKED`, `ERROR` |

Shape rule:

- the report title and fixed section list are contract shape
- section body content may vary by task and platform
- empty required sections remain present and use explicit `None` placeholders
  when the subagent contract requires them

### Review gate output shape

The review-gate family shares these contract requirements:

- review committed code only
- require a clean working tree or return `BLOCKED`
- read structured inputs first, then inspect changed files named in
  `EXECUTION_REPORT`
- keep a fixed section list per reviewer contract
- put blocking issues only in blocking sections
- keep non-blocking improvements in suggestion/advisory sections
- emit `None` rather than omitting required empty sections

The last rule is mandatory shared shape, not reviewer preference.

## Canonical Pipeline Stages

The canonical stage order is:

| Order | Stage name | Required result |
| ----- | ---------- | --------------- |
| 0 | Readiness | ready-to-run task or explicit blocker |
| 1 | Kickoff | `KICKOFF_REPORT` |
| 2 | Execution | `EXECUTION_REPORT` |
| 3 | Documentation | `DOCUMENTATION_REPORT` |
| 4 | Requirements Verification | `VERIFICATION_RESULT` |
| 5 | Quality Gates | ordered review verdicts |
| 6 | Targeted Fix Cycle | revalidated failing path or escalation |
| 7 | Final Report | concise task-only completion summary |

Ordering rules:

- readiness must complete before kickoff
- kickoff is the first execution mutation boundary after critique approval
- requirements verification must complete before any review gate runs
- quality gates run in this order only:
  `clean-code-reviewer` -> `architecture-reviewer` -> `security-auditor`
- targeted fix cycles re-run only the failing verification or gate path, not
  the whole pipeline
- the run stops after the selected task; it never auto-continues to the next
  task

## Subagent Dispatch Conventions

Both skills must use the same orchestration conventions:

- the orchestrator reads only the current skill file, the current reference
  file, and the specific subagent file being dispatched
- all substantive execution, mutation, analysis, and artifact updates are
  delegated to subagents
- dispatch inputs must be compact and structured
- prefer file paths over pasted file contents
- prefer prior structured reports over raw logs or raw command output
- pass only the inputs the target subagent needs
- carry forward the smallest decision-relevant summary between stages

Canonical subagent roster and sequence:

| Subagent | Canonical role |
| -------- | -------------- |
| `execution-starter` | kickoff readiness, workspace checks, first tracker-side startup actions |
| `task-executor` | in-scope implementation and test execution |
| `documentation-writer` | in-code documentation, Category B commits, Category A tracking updates, optional completion-side tracker updates |
| `requirements-verifier` | DoD completeness gate before review |
| `clean-code-reviewer` | maintainability and code quality gate |
| `architecture-reviewer` | structural and architectural fit gate |
| `security-auditor` | final security gate |

Dispatch-shape requirements by handoff:

- `execution-starter` receives the two top-level inputs plus snapshot path, task
  plan path, and execution brief path
- `task-executor` receives planning artifact paths and optional fix/resume
  context
- `documentation-writer` receives `EXECUTION_REPORT` plus the two top-level
  inputs
- `requirements-verifier` receives brief path, test spec path,
  `EXECUTION_REPORT`, and `DOCUMENTATION_REPORT`
- later reviewers accumulate earlier verdicts in order instead of skipping
  earlier gates

## Platform-Specific Divergence Boundaries

The harmonized shape permits platform-specific content divergence only where the
underlying tracker model or transport differs. Those differences must remain
content-level, not shape-level.

### Legitimate content-level divergence

| Boundary | Jira variant | GitHub variant | Why this is legitimate |
| -------- | ------------ | -------------- | ---------------------- |
| workflow key field | `TICKET_KEY` | `ISSUE_SLUG` | Different tracker identifier models drive path derivation |
| snapshot artifact meaning | ticket snapshot and Jira context | issue snapshot and GitHub context | Same artifact role, different tracker content |
| task plan table | `## Jira Subtasks` and `Jira Subtask:` lines | `## GitHub Task Issues` and `GitHub Task Issue:` lines | Same traceability role, different tracker entities |
| kickoff actions | transition subtask, add start comment | `gh` label/assignee/comment/project-field actions | Same kickoff phase, different tracker operations |
| completion updates | Jira subtask done state and completion comment | `gh` completion updates on child or parent issue | Same completion-side tracking role, different tracker transport |
| optional reference semantics | secondary reference stays `None` in current Jira contract | child/parent issue relationships may exist in GitHub content | GitHub task issue model exposes parent/child issue relationships more directly |

### Non-permitted shape divergence

The following are shape drift and should be harmonized rather than preserved:

- changing pipeline stage names or order between the two skills
- changing the subagent roster for the shared execution path
- changing symbolic handoff names for equivalent stages
- changing required fixed section lists for equivalent report types without a
  corresponding pair-wide decision
- omitting required empty review sections in one skill while preserving them in
  the other
- introducing platform-specific extra execution stages that change the normal
  shared pipeline contract

## Decisions From This Pass

### Decision 1: Preserve fixed review section lists with explicit `None`

Source:

- Phase 1 ledger `Entry 1`
- Phase 2 applied fix for `P0-CONTRACT-001`

Decision:

- the canonical shared review-gate contract preserves the fixed section list
  defined by each reviewer subagent
- when a required section is empty, the reviewer emits the section with an
  explicit `None` placeholder
- the governing review policy must align with that fixed-shape rule

Rationale derived from the Phase 1 ledger:

- the earlier mismatch was a contract-integrity problem inside the same review
  flow, not a Jira/GitHub platform difference
- downstream readers cannot safely consume reviewer output when policy says an
  empty section may be omitted but the subagent output contract requires it to
  be present
- both skill families can adopt the same empty-section convention without
  changing capability, scope, or tooling

Audit implication:

- future audits should treat omission of a required empty reviewer section as
  shape drift even if the prose content is otherwise correct

## Deferred Items

No deferred items. The Phase 1 ledger records `DEFER: 0`, and the Phase 2
change summary states `No deferred items.`

## Known Non-Goals

This harmonization does not cover:

- changing the functional behavior of either skill
- adding new tracker operations, commands, or dependencies
- altering commit strategy beyond the existing documentation-writer contract
- redefining task-planning phases that happen before per-task execution begins
- harmonizing the semantic content of Jira-specific and GitHub-specific tracker
  operations where the underlying platforms genuinely differ
- making the runtime skills depend on this spec file
- introducing a broader cross-skill taxonomy beyond the chosen `task-execution`
  slug

## Audit Checklist

A future reviewer can compare each skill against this spec by confirming:

1. The skill still accepts exactly two top-level inputs with the same shared
   roles.
2. The required artifact family still follows the shared derivation pattern.
3. Category A and Category B lifecycle rules still match this spec.
4. The pipeline stage order still matches the canonical sequence.
5. The same seven subagents still own the same pipeline roles.
6. Structured handoff names still match the canonical report family.
7. Requirements verification still occurs before any review gate.
8. Review gates still run in clean-code, architecture, security order.
9. Required empty review sections still remain present with explicit `None`
   placeholders.
10. Any Jira/GitHub differences remain within the legitimate divergence
    boundaries above rather than changing contract shape.
