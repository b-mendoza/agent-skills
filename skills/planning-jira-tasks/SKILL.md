---
name: "planning-jira-tasks"
description: 'Create an implementation task plan from a previously retrieved Jira ticket document. Breaks the ticket into the smallest practical set of focused, independent, and executable tasks. Use when the user says "plan the ticket", "create tasks", "break down the ticket", "create an implementation plan", "plan JNS-1234", "decompose this ticket", "what needs to be done for this ticket", or "make a task plan". Also triggered by the orchestrating-jira-workflow skill as Phase 2 of the end-to-end pipeline. Requires that the ticket information has already been retrieved into docs/<TICKET_KEY>.md. This skill produces a plan ONLY — it does NOT implement anything. Works with Claude Code CLI, Cursor IDE, and OpenCode CLI.'
---

# Planning Jira Tasks

## Purpose

Read the ticket snapshot at `docs/<TICKET_KEY>.md` and produce a detailed,
self-contained task plan at `docs/<TICKET_KEY>-tasks.md`. Each task carries
enough local context that a future agent with zero prior knowledge can execute
it in isolation.

This skill orchestrates a **pipeline of specialized subagents**, each handling
one phase of the planning process. The orchestrator coordinates handoffs,
validates stage outputs, and performs a final quality check — it never does the
planning work itself.

## Inputs

| Input        | Source              | Required | Example    |
| ------------ | ------------------- | -------- | ---------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065` |

The ticket snapshot file must already exist at `docs/<TICKET_KEY>.md`.
If it does not, tell the user to run the **fetching-jira-ticket** skill first.

### Input contract

The input file `docs/<TICKET_KEY>.md` must contain these sections (produced by
the `fetching-jira-ticket` skill):

| Required section         | Why                                         |
| ------------------------ | ------------------------------------------- |
| `## Description`         | Primary source for identifying work items   |
| `## Acceptance Criteria` | Maps to Definition of Done per task         |
| `## Comments`            | Contains decisions and scope clarifications |
| `## Subtasks`            | Existing work to account for, not duplicate |
| `## Linked Issues`       | Cross-ticket dependency awareness           |

If any are missing, the ticket was not fetched correctly — stop and ask the
user to re-fetch.

## Output

```
docs/<TICKET_KEY>-tasks.md
```

### Output contract

The output file **must** contain all of these sections for downstream skills:

| Section                              | Required by                                                         |
| ------------------------------------ | ------------------------------------------------------------------- |
| `## Ticket Summary`                  | clarifying-assumptions                                              |
| `## Assumptions and Constraints`     | clarifying-assumptions                                              |
| `## Cross-Cutting Open Questions`    | clarifying-assumptions                                              |
| `## Tasks` (each with 8 subsections) | clarifying-assumptions, creating-jira-subtasks, executing-jira-task |
| `## Execution Order Summary`         | creating-jira-subtasks                                              |
| `## Dependency Graph`                | executing-jira-task                                                 |
| `## Validation Report`               | clarifying-assumptions                                              |

**Required subsections per task:**

1. `**Objective:**`
2. `**Relevant requirements and context:**`
3. `**Questions to answer before starting:**`
4. `**Implementation notes:**`
5. `**Definition of done:**`
6. `**Likely files / artifacts affected:**`
7. `**Dependencies / prerequisites:**` (added by dependency-prioritizer)
8. `**Priority:**` (added by dependency-prioritizer)

## Subagent Registry

| Subagent                 | Path                                    | Purpose                                               |
| ------------------------ | --------------------------------------- | ----------------------------------------------------- |
| `task-planner`           | `./subagents/task-planner.md`           | Decompose ticket and detail tasks (the WHAT + HOW)    |
| `dependency-prioritizer` | `./subagents/dependency-prioritizer.md` | Dependency graph + scoring + final execution order    |
| `task-validator`         | `./subagents/task-validator.md`         | QA gate — 19 validation checks                        |
| `stage-validator`        | `./subagents/stage-validator.md`        | Pre-flight, inter-stage, and post-pipeline validation |

Read each subagent file only when you are about to dispatch to it — do not
preload all definitions.

## Platform-Specific Dispatch

This skill works across multiple AI coding tools. Read
`./references/platform-dispatch.md` to determine the correct subagent dispatch
syntax for your current environment.

**Quick reference:**

| Platform     | Dispatch mechanism                                             |
| ------------ | -------------------------------------------------------------- |
| Claude Code  | `agent` tool — co-located `.md` files in `subagents/`          |
| Cursor IDE   | Native subagents (2.4+) — `.cursor/agents/` or inline dispatch |
| OpenCode CLI | Task tool — `.opencode/agents/` or `@mention` invocation       |

### Pipeline flow

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

### Intermediate files

Each stage writes to a working file. These files are **preserved** after the
final plan is written — they are never deleted. They serve as reference for
the `critique-analyzer` subagent in Phase 3 and for debugging if a re-plan
cycle is triggered.

| Stage | File                                | Subagent               | Persisted |
| ----- | ----------------------------------- | ---------------------- | --------- |
| 1     | `docs/<KEY>-stage-1-detailed.md`    | task-planner           | Yes       |
| 2     | `docs/<KEY>-stage-2-prioritized.md` | dependency-prioritizer | Yes       |
| 3     | `docs/<KEY>-tasks.md` (final)       | task-validator         | Yes       |

**Artifact preservation rule:** These files are NEVER deleted and NEVER
committed to git. They are orchestration artifacts that persist for the
lifetime of the workflow.

## Execution Steps

### 1. Pre-flight

Dispatch `stage-validator` with `STAGE=preflight`, `TICKET_KEY`, and
`FILE_PATH=docs/<TICKET_KEY>.md`.

- **If verdict is FAIL:** Stop and tell the user which checks failed. If the
  file does not exist, tell the user to run the fetching skill. If sections
  are missing, tell the user to re-fetch.
- **If verdict is PASS:** Proceed.

### 2. Run the pipeline

Execute each subagent in order. After each stage, dispatch `stage-validator`
to check the output. If validation fails, retry that stage ONCE with specific
feedback from the validator's issues list. If it fails again, stop and report.

**Stage 1 — Plan:**
Dispatch `task-planner` with input: `docs/<KEY>.md`.
Output: `docs/<KEY>-stage-1-detailed.md`.
Dispatch `stage-validator` with `STAGE=1` and `FILE_PATH=docs/<KEY>-stage-1-detailed.md`.

**Stage 2 — Prioritize:**
Dispatch `dependency-prioritizer` with input: stage 1 output.
Output: `docs/<KEY>-stage-2-prioritized.md`.
Dispatch `stage-validator` with `STAGE=2` and `FILE_PATH=docs/<KEY>-stage-2-prioritized.md`.

**Stage 3 — Validate:**
Dispatch `task-validator` with inputs: `docs/<KEY>.md` + stage 2 output.
Output: `docs/<KEY>-tasks.md`.
Dispatch `stage-validator` with `STAGE=3` and `FILE_PATH=docs/<KEY>-tasks.md`.

### 3. Post-pipeline validation

Dispatch `stage-validator` with `STAGE=postpipeline` and
`FILE_PATH=docs/<KEY>-tasks.md`.

This runs the full output contract check — all 7 required sections, all 8
per-task subsections.

If anything is missing, re-run stage 3 with specific feedback from the
validator. If it fails again, stop and report.

### 4. Report to user

Tell the user:

- File path written
- Total number of tasks created
- Number of open questions flagged
- Number of dependency chains identified
- Any validation warnings from stage 3
- Remind them that no implementation has started
- Note that intermediate files are preserved for critique and debugging

## Re-Plan Cycle

If Phase 3 critique triggers a re-plan, the orchestrator re-dispatches this
skill with the same `TICKET_KEY`, plus:

- `RE_PLAN=true` — signals this is a re-dispatch
- `DECISIONS` — the decisions from Phase 3 that require plan changes

On re-plan:

1. **All three pipeline subagents are re-dispatched.** Each receives the
   prior intermediate artifact (already on disk) plus the new decisions.
2. **Intermediate files are overwritten** with updated versions.
3. **Post-pipeline validation runs again** to confirm the updated plan is
   well-formed.

**Maximum re-plan cycles:** 3 iterations. If Phase 3 critique still has
unresolved concerns after 3 cycles, escalate to the user.

## Error Handling

- If any subagent fails, do NOT proceed to the next stage. Report the failure
  with the stage number and error.
- If a `stage-validator` check fails, retry the subagent ONCE with specific
  feedback from the validator's issues list. If it fails again, stop and report.
- Intermediate files are ALWAYS preserved — they are never deleted, regardless
  of success or failure.

## Task-Planning Rules (reference — enforced by subagents)

- Keep tasks small, focused, and independent.
- Do not combine unrelated work into a single task.
- Prefer tasks that can be started, paused, reassigned, or clarified in
  isolation.
- If a task depends on missing information, call that out explicitly.
- Preserve traceability: each task references which requirement(s) it addresses.
- Include enough task-local context for zero-context execution.
- Order tasks in a sensible implementation sequence.
- Split large or ambiguous tasks until they are practical and self-contained.
