---
name: "planning-jira-tasks"
description: 'Phase 2 of the orchestrating-jira-workflow pipeline. Reads a ticket snapshot at docs/<TICKET_KEY>.md and produces a detailed, self-contained task plan at docs/<TICKET_KEY>-tasks.md through a three-stage subagent pipeline (plan → prioritize → validate). Invoked by the orchestrating-jira-workflow skill — not intended for standalone use. This skill orchestrates the pipeline but never does planning work itself.'
---

# Planning Jira Tasks

## Purpose

Read the ticket snapshot at `docs/<TICKET_KEY>.md` and produce a detailed,
self-contained task plan at `docs/<TICKET_KEY>-tasks.md`. This skill
orchestrates a **pipeline of specialized subagents** — it coordinates
handoffs, validates stage outputs, and reports the result to the orchestrator.
It never does the planning work itself.

## Inputs

| Input        | Required | Example    |
| ------------ | -------- | ---------- |
| `TICKET_KEY` | Yes      | `JNS-6065` |

The ticket snapshot must already exist at `docs/<TICKET_KEY>.md` with these
sections (produced by the `fetching-jira-ticket` skill):

| Required section         | Why                                         |
| ------------------------ | ------------------------------------------- |
| `## Description`         | Primary source for identifying work items   |
| `## Acceptance Criteria` | Maps to Definition of Done per task         |
| `## Comments`            | Contains decisions and scope clarifications |
| `## Subtasks`            | Existing work to account for, not duplicate |
| `## Linked Issues`       | Cross-ticket dependency awareness           |

If any are missing, the ticket was not fetched correctly — the orchestrator
should re-run Phase 1.

## Output

**Path:** `docs/<TICKET_KEY>-tasks.md`

The output file **must** contain all of these sections for downstream skills:

| Section                              | Required by                                                         |
| ------------------------------------ | ------------------------------------------------------------------- |
| `## Ticket Summary`                  | clarifying-assumptions                                              |
| `## Problem Framing`                 | clarifying-assumptions (Tier 3 hard gates), critique-analyzer       |
| `## Assumptions and Constraints`     | clarifying-assumptions                                              |
| `## Cross-Cutting Open Questions`    | clarifying-assumptions                                              |
| `## Tasks` (each with 8 subsections) | clarifying-assumptions, creating-jira-subtasks, executing-jira-task |
| `## Execution Order Summary`         | creating-jira-subtasks                                              |
| `## Dependency Graph`                | executing-jira-task                                                 |
| `## Validation Report`               | clarifying-assumptions                                              |

**Required subsections per task:** Objective · Relevant requirements and
context · Questions to answer before starting · Implementation notes ·
Definition of done · Likely files / artifacts affected · Dependencies /
prerequisites _(added by dependency-prioritizer)_ · Priority _(added by
dependency-prioritizer)_.

## Subagent Registry

| Subagent                 | Path                                    | Purpose                                               |
| ------------------------ | --------------------------------------- | ----------------------------------------------------- |
| `task-planner`           | `./subagents/task-planner.md`           | Decompose ticket and detail tasks (the WHAT + HOW)    |
| `dependency-prioritizer` | `./subagents/dependency-prioritizer.md` | Dependency graph + scoring + final execution order    |
| `task-validator`         | `./subagents/task-validator.md`         | QA gate — 19 validation checks                        |
| `stage-validator`        | `./subagents/stage-validator.md`        | Pre-flight, inter-stage, and post-pipeline validation |

Read each subagent file only when you are about to dispatch to it — do not
preload all definitions.

## How This Skill Works

This skill coordinates a three-stage planning pipeline. It does exactly three
things: **dispatch** each pipeline subagent in sequence, **validate** each
stage's output via `stage-validator`, and **report** the final result to the
orchestrator.

The `stage-validator`'s verdict (PASS/FAIL + issues list) is the only data
this skill uses between stages. If a stage fails validation, this skill
retries the stage once with the validator's feedback. If it fails again, it
stops and reports the failure.

The orchestrator's context window is the most expensive resource. This skill
returns only a concise summary — never raw plan content.

## Pipeline Flow

```
docs/<KEY>.md (ticket snapshot)
       │
       ▼
┌──────────────────────────┐
│  task-planner            │  → Detailed tasks (what + how)
└────────┬─────────────────┘
         ▼
┌──────────────────────────┐
│  dependency-prioritizer  │  → Dependencies + ordered task list
└────────┬─────────────────┘
         ▼
┌──────────────────────────┐
│  task-validator          │  → Validated plan with issues flagged
└──────────────────────────┘
         │
         ▼
docs/<KEY>-tasks.md (final plan)
```

## Intermediate Files

Each stage writes to a working file, preserved for the `critique-analyzer`
subagent in Phase 3 and for debugging if a re-plan cycle is triggered.

| Stage | File                                | Subagent               |
| ----- | ----------------------------------- | ---------------------- |
| 1     | `docs/<KEY>-stage-1-detailed.md`    | task-planner           |
| 2     | `docs/<KEY>-stage-2-prioritized.md` | dependency-prioritizer |
| 3     | `docs/<KEY>-tasks.md` (final)       | task-validator         |

**Artifact preservation rule:** These files are NEVER deleted and NEVER
committed to git.

## Execution Steps

**1. Pre-flight** — Dispatch `stage-validator` with `STAGE=preflight`,
`TICKET_KEY`, and `FILE_PATH=docs/<TICKET_KEY>.md`. On FAIL: stop and report
(the orchestrator should re-run Phase 1). On PASS: proceed.

**2. Run the pipeline** — Execute each subagent in order. After each stage,
dispatch `stage-validator`. If validation fails, retry that stage ONCE with
the validator's feedback. If it fails again, stop and report.

- **Stage 1 — Plan:** Dispatch `task-planner` with input `docs/<KEY>.md`.
  Output: `docs/<KEY>-stage-1-detailed.md`. Validate with `STAGE=1`.
- **Stage 2 — Prioritize:** Dispatch `dependency-prioritizer` with stage 1
  output. Output: `docs/<KEY>-stage-2-prioritized.md`. Validate `STAGE=2`.
- **Stage 3 — Validate:** Dispatch `task-validator` with `docs/<KEY>.md` +
  stage 2 output. Output: `docs/<KEY>-tasks.md`. Validate with `STAGE=3`.

**3. Post-pipeline validation** — Dispatch `stage-validator` with
`STAGE=postpipeline` and `FILE_PATH=docs/<KEY>-tasks.md`. This checks all 8
required sections and all 8 per-task subsections. If anything is missing,
re-run stage 3 with the validator's feedback. If it fails again, stop.

**4. Report** — Tell the orchestrator: file path, total tasks, open questions,
dependency chains, validation warnings. Note that no implementation has
started and intermediate files are preserved.

## Non-Happy-Path Reference

If Phase 3 critique triggers a re-plan cycle, or if an error occurs during
the pipeline, read `./references/re-plan-cycle.md` for recovery procedures.

<example>
TICKET_KEY = JNS-6065

1. Pre-flight: Dispatch stage-validator STAGE=preflight, FILE=docs/JNS-6065.md
   → PASS (6/6 checks)
2. Stage 1: Dispatch task-planner, input docs/JNS-6065.md
   → Wrote docs/JNS-6065-stage-1-detailed.md
   Validate STAGE=1 → PASS (9/9 checks)
3. Stage 2: Dispatch dependency-prioritizer, input stage-1-detailed.md
   → Wrote docs/JNS-6065-stage-2-prioritized.md
   Validate STAGE=2 → PASS (6/6 checks)
4. Stage 3: Dispatch task-validator, inputs JNS-6065.md + stage-2-prioritized.md
   → Wrote docs/JNS-6065-tasks.md
   Validate STAGE=3 → PASS (2/2 checks)
5. Post-pipeline: Validate STAGE=postpipeline → PASS (8/8 checks)
6. Report to orchestrator:
   File: docs/JNS-6065-tasks.md
   Tasks: 7 | Open questions: 3 | Dependency chains: 2
   Validation warnings: 1 (Task 4 DoD says "works correctly")
   No implementation started. Intermediate files preserved.
</example>
