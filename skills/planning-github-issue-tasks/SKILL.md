---
name: "planning-github-issue-tasks"
description: 'Phase 2 of the orchestrating-github-workflow pipeline. Reads a GitHub issue snapshot at docs/<ISSUE_SLUG>.md and produces a detailed, self-contained task plan at docs/<ISSUE_SLUG>-tasks.md through a three-stage subagent pipeline (plan → prioritize → validate). Invoked by the orchestrating-github-workflow skill, not intended for standalone use. This skill orchestrates the pipeline, preserves planning artifacts for resume and critique, and never does planning work itself. Downstream clarification uses TICKET_KEY = ISSUE_SLUG for path compatibility.'
---

# Planning GitHub Issue Tasks

Plan a GitHub issue into a structured execution artifact at
`docs/<ISSUE_SLUG>-tasks.md`. This skill is the Phase 2 orchestrator in the
GitHub workflow: it dispatches specialist subagents, validates each artifact
boundary, preserves planning artifacts for resume and critique, and returns
only concise handoff summaries to the parent workflow. It does not decompose
work, prioritize dependencies, or validate plan quality inline.

**Compatibility:** `clarifying-assumptions` expects `TICKET_KEY`. For this
workflow, **`TICKET_KEY` and `ISSUE_SLUG` are the same string** (for example
`acme-app-42`). All artifact paths use `docs/<ISSUE_SLUG>…`.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `ISSUE_SLUG` | Yes | `acme-app-42` |
| `RE_PLAN` | No | `true` |
| `DECISIONS` | No | `Task 3 depends on SSO choice` |

Phase 2 is file-driven, so `ISSUE_SLUG` is sufficient. `ISSUE_URL` is not
required once the issue snapshot already exists on disk.

The issue snapshot must already exist at `docs/<ISSUE_SLUG>.md` with the stable
Phase 1 headings defined by `fetching-github-issue` (see
`../orchestrating-github-workflow/references/data-contracts.md`). The
`stage-validator` preflight enforces the same minimum heading set as the
orchestrator’s Phase 1 postcondition / Phase 2 precondition, including
`## Metadata`, `## Description`, `## Acceptance Criteria`, `## Comments`,
`## Retrieval Warnings`, `## Child Issues`, `## Linked Issues`, `## Labels`,
`## Assignees`, `## Milestone`, `## Projects`, and `## Attachments` (the last
three are stable sections in the Phase 1 template, often `_None_`).

If any required check fails, treat Phase 1 as incomplete and stop with a
preflight failure.

If `RE_PLAN=true`, load `./references/re-plan-cycle.md` and pass the supplied
`DECISIONS` only to the stages that need plan revisions.

## Output Contract

### Artifact contract

Final artifact path: `docs/<ISSUE_SLUG>-tasks.md`

The final plan must contain all of these sections for downstream phases (matches
`orchestrating-github-workflow` / `artifact-validator` Phase 2 postcondition):

| Section | Consumed by |
| ------- | ----------- |
| `## Issue Summary` | Clarification and critique context |
| `## Execution Order Summary` | Ordering and tracking |
| `## Problem Framing` | `clarifying-assumptions`, critique paths |
| `## Assumptions and Constraints` | `clarifying-assumptions` |
| `## Cross-Cutting Open Questions` | `clarifying-assumptions` |
| `## Tasks` with numbered task entries | `clarifying-assumptions`, child-issue creation, task execution |
| `## Dependency Graph` | Task execution and critique |
| `## Validation Report` | `clarifying-assumptions` |

Each final task entry must include these eight subsections:

- `**Objective:**`
- `**Relevant requirements and context:**`
- `**Questions to answer before starting:**`
- `**Implementation notes:**`
- `**Definition of done:**`
- `**Likely files / artifacts affected:**`
- `**Dependencies / prerequisites:**`
- `**Priority:**`

Phase 2 does not add `## Decisions Log`; that artifact is appended later by
Phase 3.

### Return handoff

Return only a concise phase handoff to the parent orchestrator:

```text
PLANNING: PASS | FAIL
Issue: <ISSUE_SLUG>
File: <final file path or "not written">
Tasks: <N>
Cross-cutting questions: <N>
Validation warnings: <N>
Failure category: PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE
Reason: <one line>
Artifacts preserved: <comma-separated paths>
```

## Workflow Overview

```
docs/<ISSUE_SLUG>.md (issue snapshot)
       │
       ▼
┌──────────────────────────┐
│  task-planner            │  -> Detailed tasks (what + how)
└────────┬─────────────────┘
         ▼
┌──────────────────────────┐
│  dependency-prioritizer  │  -> Dependencies + execution order
└────────┬─────────────────┘
         ▼
┌──────────────────────────┐
│  task-validator          │  -> Final validated plan + report
└──────────────────────────┘
         │
         ▼
docs/<ISSUE_SLUG>-tasks.md
```

Each stage writes a Category A orchestration artifact that stays on disk for
Phase 3 critique, targeted retries, and workflow resume:

| Stage | File | Produced by |
| ----- | ---- | ----------- |
| 1 | `docs/<ISSUE_SLUG>-stage-1-detailed.md` | `task-planner` |
| 2 | `docs/<ISSUE_SLUG>-stage-2-prioritized.md` | `dependency-prioritizer` |
| 3 | `docs/<ISSUE_SLUG>-tasks.md` | `task-validator` |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `task-planner` | `./subagents/task-planner.md` | Decompose the issue and draft the stage 1 plan |
| `dependency-prioritizer` | `./subagents/dependency-prioritizer.md` | Annotate dependencies and determine execution order |
| `task-validator` | `./subagents/task-validator.md` | Validate the prioritized plan and append QA findings |
| `stage-validator` | `./subagents/stage-validator.md` | Check preflight, inter-stage, and final output gates |

Read a subagent definition only when you are about to dispatch that subagent.

## How This Skill Works

This skill does exactly three things:

- **Dispatch** the planning subagents in sequence.
- **Validate** each artifact boundary with `stage-validator`.
- **Report** only stage verdicts and summary counts to the parent workflow.

The orchestrator keeps only decision-relevant handoff data between stages:

- The validator verdict
- The output file path for the passing stage
- The specific issues that failed the current gate
- Retry count for the current gate

Do not carry raw plan content forward in the orchestrator context.

## Phase Guide

| Phase / gate | Dispatch | Required output | On failure |
| ------------ | -------- | --------------- | ---------- |
| `preflight` | `stage-validator` | Issue snapshot present and complete | Stop with `Failure category: PREFLIGHT` |
| Stage 1 | `task-planner` → `stage-validator` | `docs/<ISSUE_SLUG>-stage-1-detailed.md` passes Stage 1 checks | Retry Stage 1 only |
| Stage 2 | `dependency-prioritizer` → `stage-validator` | `docs/<ISSUE_SLUG>-stage-2-prioritized.md` passes Stage 2 checks | Retry Stage 2 only |
| Stage 3 | `task-validator` → `stage-validator` | `docs/<ISSUE_SLUG>-tasks.md` passes Stage 3 checks | Retry Stage 3 only |
| `postpipeline` | `stage-validator` | Full downstream contract intact | Re-dispatch Stage 3, then re-run Stage 3 + postpipeline gates |

## Execution Paths

- **Normal path:** `preflight → stage 1 → stage 2 → stage 3 → postpipeline`
- **Re-plan path:** read `./references/re-plan-cycle.md`, identify the earliest
  affected stage, resume from that stage using preserved on-disk artifacts, then
  rerun every downstream stage and finish with `postpipeline`

Use targeted fix loops only. When a gate fails, re-dispatch the stage that
produced the failing artifact, pass only the validator's issues list, and
re-run only the failing gate.

## Execution Steps

1. **Choose execution path** — Same logic as `planning-jira-tasks`: normal vs
   `RE_PLAN=true` per `./references/re-plan-cycle.md` (with `ISSUE_SLUG`).

2. **Preflight** — Dispatch `stage-validator` with:
   - `ISSUE_SLUG=<ISSUE_SLUG>`
   - `STAGE=preflight`
   - `FILE_PATH=docs/<ISSUE_SLUG>.md`

3. **Stage 1** — Dispatch `task-planner` with:
   - `ISSUE_SLUG`, `INPUT_PATH=docs/<ISSUE_SLUG>.md`,
     `OUTPUT_PATH=docs/<ISSUE_SLUG>-stage-1-detailed.md`,
     optional `DECISIONS`, optional `VALIDATION_ISSUES`

   Then `stage-validator` with `STAGE=1`,
   `FILE_PATH=docs/<ISSUE_SLUG>-stage-1-detailed.md`.

4. **Stage 2** — Dispatch `dependency-prioritizer` with paths for stage 1 → 2
   outputs; validate with `STAGE=2`.

5. **Stage 3** — Dispatch `task-validator` with:
   - `ISSUE_SLUG`
   - `SNAPSHOT_PATH=docs/<ISSUE_SLUG>.md`
   - `PLAN_PATH=docs/<ISSUE_SLUG>-stage-2-prioritized.md`
   - `OUTPUT_PATH=docs/<ISSUE_SLUG>-tasks.md`
   - optional `VALIDATION_ISSUES`

   Then `stage-validator` with `STAGE=3` and `postpipeline` on
   `docs/<ISSUE_SLUG>-tasks.md`.

6. **Targeted retry loop** — Max 3 cycles per gate; on `postpipeline` failure,
   re-dispatch Stage 3 with `VALIDATION_ISSUES`, then rerun `STAGE=3` and
   `postpipeline`.

7. **Report** — On success, return the completion handoff from
   `## Output Contract`.

## Example

<example>
ISSUE_SLUG = acme-app-42

1. `stage-validator` preflight on `docs/acme-app-42.md` → PASS
2. `task-planner` → `docs/acme-app-42-stage-1-detailed.md`
3. Stage 1 gate → PASS
4. `dependency-prioritizer` → `docs/acme-app-42-stage-2-prioritized.md`
5. Stage 2 gate → PASS
6. `task-validator` → `docs/acme-app-42-tasks.md`
7. Stage 3 + postpipeline → PASS
8. Return:

   PLANNING: PASS
   Issue: acme-app-42
   File: docs/acme-app-42-tasks.md
   Tasks: 7
   Cross-cutting questions: 3
   Validation warnings: 1
   Failure category: NONE
   Reason: Final plan validated and ready for Phase 3.
   Artifacts preserved: docs/acme-app-42-stage-1-detailed.md,
   docs/acme-app-42-stage-2-prioritized.md, docs/acme-app-42-tasks.md
</example>
