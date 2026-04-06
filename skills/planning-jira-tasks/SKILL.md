---
name: "planning-jira-tasks"
description: 'Phase 2 of the orchestrating-jira-workflow pipeline. Reads a ticket snapshot at docs/<TICKET_KEY>.md and produces a detailed, self-contained task plan at docs/<TICKET_KEY>-tasks.md through a three-stage subagent pipeline (plan -> prioritize -> validate). Invoked by the orchestrating-jira-workflow skill, not intended for standalone use. This skill orchestrates the pipeline, preserves planning artifacts for resume and critique, and never does planning work itself.'
---

# Planning Jira Tasks

Plan a Jira ticket into a structured execution artifact at
`docs/<TICKET_KEY>-tasks.md`. This skill coordinates a three-stage subagent
pipeline, validates each artifact boundary, and returns only concise handoff
summaries to the parent workflow. It does not decompose work, prioritize
dependencies, or validate plan quality inline.

## Inputs

| Input        | Required | Example               |
| ------------ | -------- | --------------------- |
| `TICKET_KEY` | Yes      | `JNS-6065`            |
| `RE_PLAN`    | No       | `true`                |
| `DECISIONS`  | No       | `Task 3 depends on SSO choice` |

Phase 2 is file-driven, so `TICKET_KEY` is sufficient. `JIRA_URL` is not
required once the ticket snapshot already exists on disk.

The ticket snapshot must already exist at `docs/<TICKET_KEY>.md` with these
sections, produced by `fetching-jira-ticket`:

| Required section         | Why it matters                              |
| ------------------------ | ------------------------------------------- |
| `## Description`         | Primary source for identifying work items   |
| `## Acceptance Criteria` | Maps to Definition of Done per task         |
| `## Comments`            | Captures scope changes and clarifications   |
| `## Subtasks`            | Prevents duplicate planning                 |
| `## Linked Issues`       | Preserves dependency awareness              |

If any are missing, treat Phase 1 as incomplete and stop with a preflight
failure.

If `RE_PLAN=true`, reuse the same `TICKET_KEY`, load
`./references/re-plan-cycle.md`, and pass the supplied `DECISIONS` only to the
stages that need plan revisions.

## Workflow Overview

```
docs/<KEY>.md (ticket snapshot)
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
docs/<KEY>-tasks.md
```

Each stage writes a Category A orchestration artifact that stays on disk for
Phase 3 critique, targeted retries, and workflow resume:

| Stage | File                                | Produced by            |
| ----- | ----------------------------------- | ---------------------- |
| 1     | `docs/<KEY>-stage-1-detailed.md`    | `task-planner`         |
| 2     | `docs/<KEY>-stage-2-prioritized.md` | `dependency-prioritizer` |
| 3     | `docs/<KEY>-tasks.md`               | `task-validator`       |

Preserve these planning artifacts on disk. They support resume and critique
workflows, and they stay out of git history as orchestration artifacts.

## Subagent Registry

| Subagent                 | Path                                    | Purpose                                               |
| ------------------------ | --------------------------------------- | ----------------------------------------------------- |
| `task-planner`           | `./subagents/task-planner.md`           | Decompose the ticket and draft the stage 1 plan       |
| `dependency-prioritizer` | `./subagents/dependency-prioritizer.md` | Annotate dependencies and determine execution order   |
| `task-validator`         | `./subagents/task-validator.md`         | Validate the prioritized plan and append QA findings  |
| `stage-validator`        | `./subagents/stage-validator.md`        | Check preflight, inter-stage, and final output gates  |

Read a subagent definition only when you are about to dispatch that subagent.

## Output Contract

Final artifact path: `docs/<TICKET_KEY>-tasks.md`

The final plan must contain all of these sections for downstream phases:

| Section                              | Consumed by                                                         |
| ------------------------------------ | ------------------------------------------------------------------- |
| `## Ticket Summary`                  | `clarifying-assumptions`                                            |
| `## Problem Framing`                 | `clarifying-assumptions`, critique paths                            |
| `## Assumptions and Constraints`     | `clarifying-assumptions`                                            |
| `## Cross-Cutting Open Questions`    | `clarifying-assumptions`                                            |
| `## Tasks` with numbered task entries | `clarifying-assumptions`, `creating-jira-subtasks`, task execution |
| `## Execution Order Summary`         | `creating-jira-subtasks`                                            |
| `## Dependency Graph`                | task execution and critique                                         |
| `## Validation Report`               | `clarifying-assumptions`                                            |

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

Return only a concise phase handoff to the parent orchestrator:

```text
PLANNING: PASS | FAIL
Ticket: <TICKET_KEY>
File: <final file path or "not written">
Tasks: <N>
Cross-cutting questions: <N>
Validation warnings: <N>
Failure category: PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE
Reason: <one line>
Artifacts preserved: <comma-separated paths>
```

## How This Skill Works

This skill does exactly three things:

- **Dispatch** the planning subagents in sequence.
- **Validate** each artifact boundary with `stage-validator`.
- **Report** only stage verdicts and summary counts to the parent workflow.

Between stages, keep only structured handoff data:

- The validator verdict
- The output file path for the passing stage
- The specific issues that failed the current gate
- Retry count for the current gate

Do not carry raw plan content forward in the orchestrator context.

## Execution Steps

> Use targeted fix loops only: when a gate fails, re-dispatch the stage that
> produced that artifact and re-run only that failing gate. For re-plan or
> recovery paths, read `./references/re-plan-cycle.md`.

1. **Preflight**
   Read and dispatch `stage-validator` with:
   - `TICKET_KEY=<TICKET_KEY>`
   - `STAGE=preflight`
   - `FILE_PATH=docs/<TICKET_KEY>.md`

   If the verdict is FAIL, stop and return `PLANNING: FAIL` with
   `Failure category: PREFLIGHT`.

2. **Stage 1 - Plan**
   Read and dispatch `task-planner` with:
   - `TICKET_KEY=<TICKET_KEY>`
   - `INPUT_PATH=docs/<TICKET_KEY>.md`
   - `OUTPUT_PATH=docs/<TICKET_KEY>-stage-1-detailed.md`
   - `DECISIONS=<DECISIONS>` only when `RE_PLAN=true`

   Then validate stage 1 by dispatching `stage-validator` with `STAGE=1` and
   `FILE_PATH=docs/<TICKET_KEY>-stage-1-detailed.md`.

3. **Stage 2 - Prioritize**
   Read and dispatch `dependency-prioritizer` with:
   - `TICKET_KEY=<TICKET_KEY>`
   - `INPUT_PATH=docs/<TICKET_KEY>-stage-1-detailed.md`
   - `OUTPUT_PATH=docs/<TICKET_KEY>-stage-2-prioritized.md`
   - `DECISIONS=<DECISIONS>` only when `RE_PLAN=true`

   Then validate stage 2 by dispatching `stage-validator` with `STAGE=2` and
   `FILE_PATH=docs/<TICKET_KEY>-stage-2-prioritized.md`.

4. **Stage 3 - Validate**
   Read and dispatch `task-validator` with:
   - `TICKET_KEY=<TICKET_KEY>`
   - `TICKET_PATH=docs/<TICKET_KEY>.md`
   - `PLAN_PATH=docs/<TICKET_KEY>-stage-2-prioritized.md`
   - `OUTPUT_PATH=docs/<TICKET_KEY>-tasks.md`

   Then validate stage 3 by dispatching `stage-validator` with `STAGE=3` and
   `FILE_PATH=docs/<TICKET_KEY>-tasks.md`.

5. **Post-pipeline gate**
   Dispatch `stage-validator` with:
   - `TICKET_KEY=<TICKET_KEY>`
   - `STAGE=postpipeline`
   - `FILE_PATH=docs/<TICKET_KEY>-tasks.md`

   This confirms the full output contract for downstream phases.

6. **Targeted retry loop**
   For any failing gate:
   - Collect only the validator's issues list.
   - Re-dispatch only the stage that produced that artifact.
   - Pass the original inputs plus `VALIDATION_ISSUES=<issues list>`.
   - Re-run only the previously failing validator gate.
   - Stop after 3 failed cycles for the same gate and return `PLANNING: FAIL`
     with the relevant failure category.

7. **Report**
   On success, return the completion handoff from `## Output Contract`. Include
   the final file path, task count, cross-cutting question count, warning count,
   and the preserved artifact paths. State explicitly that planning is complete
   and implementation has not started.

## Example

<example>
TICKET_KEY = JNS-6065

1. Dispatch `stage-validator` with `STAGE=preflight`,
   `FILE_PATH=docs/JNS-6065.md`
   -> PASS
2. Dispatch `task-planner` with
   `INPUT_PATH=docs/JNS-6065.md`,
   `OUTPUT_PATH=docs/JNS-6065-stage-1-detailed.md`
   -> wrote stage 1 artifact
3. Validate stage 1
   -> PASS
4. Dispatch `dependency-prioritizer` with
   `INPUT_PATH=docs/JNS-6065-stage-1-detailed.md`,
   `OUTPUT_PATH=docs/JNS-6065-stage-2-prioritized.md`
   -> wrote stage 2 artifact
5. Validate stage 2
   -> PASS
6. Dispatch `task-validator` with
   `TICKET_PATH=docs/JNS-6065.md`,
   `PLAN_PATH=docs/JNS-6065-stage-2-prioritized.md`,
   `OUTPUT_PATH=docs/JNS-6065-tasks.md`
   -> wrote final plan
7. Validate `STAGE=3` and `STAGE=postpipeline`
   -> PASS
8. Return:

   PLANNING: PASS
   Ticket: JNS-6065
   File: docs/JNS-6065-tasks.md
   Tasks: 7
   Cross-cutting questions: 3
   Validation warnings: 1
   Failure category: NONE
   Reason: Final plan validated and ready for Phase 3.
   Artifacts preserved: docs/JNS-6065-stage-1-detailed.md,
   docs/JNS-6065-stage-2-prioritized.md, docs/JNS-6065-tasks.md
</example>
