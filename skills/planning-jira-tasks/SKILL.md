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

| Subagent                 | Path                                    | Purpose                                            |
| ------------------------ | --------------------------------------- | -------------------------------------------------- |
| `task-planner`           | `./subagents/task-planner.md`           | Decompose ticket and detail tasks (the WHAT + HOW) |
| `dependency-prioritizer` | `./subagents/dependency-prioritizer.md` | Dependency graph + scoring + final execution order |
| `task-validator`         | `./subagents/task-validator.md`         | QA gate — 19 validation checks                     |

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

All three platforms have native subagent support. The co-located subagent
`.md` files in this skill's `subagents/` directory are compatible with all
platforms. See the reference file for platform-specific dispatch details and
tips.

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

Each stage writes to a working file. These are cleaned up after the final plan
is written successfully.

| Stage | File                                | Subagent               |
| ----- | ----------------------------------- | ---------------------- |
| 1     | `docs/<KEY>-stage-1-detailed.md`    | task-planner           |
| 2     | `docs/<KEY>-stage-2-prioritized.md` | dependency-prioritizer |
| 3     | `docs/<KEY>-tasks.md` (final)       | task-validator         |

## Execution Steps

### 1. Pre-flight

1. Verify `docs/<TICKET_KEY>.md` exists. If not, stop and tell the user to run
   the fetching skill.
2. Read the file and confirm the five required sections from the input contract
   are present. If any are missing, stop and ask the user to re-fetch.

### 2. Run the pipeline

Execute each subagent in order. After each stage, run the sanity check
described below before proceeding. If a check fails, retry that stage ONCE with
specific feedback about what was missing. If it fails again, stop and report.

**Stage 1 — Plan:**
Dispatch `task-planner` with input: `docs/<KEY>.md`.
Output: `docs/<KEY>-stage-1-detailed.md`.
Sanity check: file exists, contains at least 2 tasks, every task has all 6
required subsections (Objective, Relevant requirements, Questions, Implementation
notes, Definition of done, Likely files), and every task has a `Traces to` line.

**Stage 2 — Prioritize:**
Dispatch `dependency-prioritizer` with input: stage 1 output.
Output: `docs/<KEY>-stage-2-prioritized.md`.
Sanity check: every task has a `Dependencies / prerequisites` field, tasks are
renumbered from letters to sequential numbers, `## Execution Order Summary`
and `## Dependency Graph` sections exist.

**Stage 3 — Validate:**
Dispatch `task-validator` with inputs: `docs/<KEY>.md` + stage 2 output.
Output: `docs/<KEY>-tasks.md`.
Sanity check: file exists, validation report section is present.

### 3. Post-pipeline validation

Verify the final `docs/<KEY>-tasks.md` satisfies the output contract:

- `## Ticket Summary` exists
- `## Assumptions and Constraints` exists
- `## Cross-Cutting Open Questions` exists (even if empty)
- `## Execution Order Summary` table exists
- `## Dependency Graph` exists
- `## Validation Report` exists
- Every `## Task N:` has all 8 required subsections

If anything is missing, re-run stage 3 with specific feedback. If it fails
again, stop and report.

### 4. Clean up

After the final plan passes validation:

```bash
rm -f docs/<KEY>-stage-1-detailed.md
rm -f docs/<KEY>-stage-2-prioritized.md
```

### 5. Report to user

Tell the user:

- File path written
- Total number of tasks created
- Number of open questions flagged
- Number of dependency chains identified
- Any validation warnings from stage 3
- Remind them that no implementation has started

## Error Handling

- If any subagent fails, do NOT proceed to the next stage. Report the failure
  with the stage number and error.
- If a sanity check fails, retry the subagent ONCE with specific feedback. If
  it fails again, stop and report.
- Intermediate files are NOT cleaned up on failure — they help with debugging.

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
