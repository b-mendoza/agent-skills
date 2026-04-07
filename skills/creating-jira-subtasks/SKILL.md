---
name: "creating-jira-subtasks"
description: 'Phase 4 of the orchestrating-jira-workflow pipeline. Use after the task plan has been clarified and the user has explicitly approved Jira writes. This skill reads only its bundled files, dispatches the `subtask-creator` subagent with `JIRA_URL`, and returns a concise phase summary after Jira subtasks are created or reconciled and `docs/<TICKET_KEY>-tasks.md` is updated with subtask keys.'
---

# Creating Jira Subtasks

Create or reconcile Jira subtasks for a clarified task plan at
`docs/<TICKET_KEY>-tasks.md`. This skill coordinates Phase 4 by dispatching one
specialist subagent, keeping only its structured summary, and reporting the
outcome the parent workflow needs for progress tracking.

The coordinator does four things directly: read its bundled files, derive
identifiers from `JIRA_URL`, dispatch `subtask-creator`, and relay the
subagent's summary. It does not parse the task plan inline, call Jira
directly, or edit the plan file itself.

## Inputs

| Input      | Required | Example                                                     |
| ---------- | -------- | ----------------------------------------------------------- |
| `JIRA_URL` | Yes      | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

Derive these values from the URL when you need to describe the ticket:

- **Workspace:** subdomain before `.atlassian.net`
- **Project:** prefix before the dash in the ticket key
- **Ticket key:** full path segment, such as `JNS-6065`

Prefer passing the full `JIRA_URL` downstream rather than only `TICKET_KEY`.
The URL carries the workspace context needed for Jira reads and writes.

## Input and Output Contracts

Primary input artifact:

```text
docs/<TICKET_KEY>-tasks.md
```

For normal Phase 4 execution, the plan is expected to contain:

| Required section / element               | Produced by            | Why it matters                                |
| ---------------------------------------- | ---------------------- | --------------------------------------------- |
| `## Tasks` with numbered `## Task <N>:` headings | planning-jira-tasks    | Each task maps to one Jira subtask            |
| `## Execution Order Summary`             | planning-jira-tasks    | Preserves task ordering context               |
| `## Decisions Log`                       | clarifying-assumptions | Indicates critique is complete before Jira writes |

The parent orchestrator already validates the Phase 4 precondition before this
skill runs. If this skill is used standalone and the plan is missing or
malformed, the subagent returns `SUBTASKS: BLOCKED`.

Primary output artifact:

```text
docs/<TICKET_KEY>-tasks.md
```

After successful or partial Phase 4 completion, the plan file must include:

| Addition                                              | Consumed by          | Purpose                                           |
| ----------------------------------------------------- | -------------------- | ------------------------------------------------- |
| `## Jira Subtasks` table (Task, Subtask Key, Title, Status) | planning-jira-task, executing-jira-task | Maps task numbers to Jira keys and Jira state     |
| `Jira Subtask: <KEY>` line in each linked task section | planning-jira-task, executing-jira-task | Identifies the Jira issue to transition later     |

The subagent returns a structured summary with:

- `SUBTASKS: PASS | WARN | FAIL | BLOCKED | ERROR`
- `Validation: PASS | FAIL | NOT_RUN`
- Counts for tasks in plan, already-linked tasks, newly created tasks, and
  failed creates
- A `Created/Linked Subtasks` table with task numbers, keys, and titles
- Explicit `Warnings` and `Failures` sections

That table is the handoff the parent workflow uses to populate progress
tracking. The overall Phase 4 completion signal remains the validated presence
of `## Jira Subtasks` in `docs/<TICKET_KEY>-tasks.md`.

## Workflow Overview

```text
1. Read the subtask-creator definition
2. Dispatch it with JIRA_URL
3. Interpret its structured result
4. Report only the concise phase summary to the caller
```

## Subagent Registry

Read a subagent definition only when you are about to dispatch it.

| Subagent          | Path                             | Purpose                                                                                 |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------- |
| `subtask-creator` | `./subagents/subtask-creator.md` | Reads or reconciles the plan, creates missing Jira subtasks sequentially, updates the plan idempotently, validates the output, and returns a structured Phase 4 summary |

## How This Skill Works

This skill is intentionally narrow. Phase 3 user approval has already happened
before Phase 4 starts, and the parent orchestrator wraps this skill with its
own precondition/postcondition checks and progress tracking.

Inside Phase 4, keep only:

- The structured `SUBTASKS` verdict
- The validation verdict
- The task/key/title rows needed for progress reporting
- Any warning or fatal reason that requires user attention

Do not surface raw Jira API responses, raw file contents, or intermediate parse
results unless the user explicitly asks for them.

## Execution Steps

### 1. Dispatch `subtask-creator`

Read `./subagents/subtask-creator.md`, then dispatch it with:

- `JIRA_URL`

The subagent owns plan parsing, Jira-capable MCP tool discovery, parent lookup,
idempotent reuse of existing subtask links, sequential creation of missing
subtasks, plan-file updates, and post-write validation.

### 2. Interpret the structured result

Handle the returned summary this way:

- `SUBTASKS: PASS` with `Validation: PASS`: report success and proceed.
- `SUBTASKS: WARN` with `Validation: PASS`: report partial success or degraded
  input clearly. Phase 4 may still be usable if the plan file now contains
  valid Jira keys, but make failed tasks visible so the user can retry before
  executing them.
- `SUBTASKS: BLOCKED`: stop and relay the artifact or data-shape problem. This
  usually means the plan is missing, malformed, or contains unsafe existing
  Jira links that need manual correction.
- `SUBTASKS: FAIL`: stop and relay the fatal Jira or validation failure.
- `SUBTASKS: ERROR`: stop and relay the unexpected failure.
- Any result paired with `Validation: FAIL`: treat the phase as incomplete even
  if some Jira writes succeeded, because the local plan contract is not
  trustworthy yet.

### 3. Report only the summary

Using only the subagent's structured summary, tell the caller:

- The ticket key and updated plan-file path
- Total tasks in plan, already linked tasks, newly created subtasks, and failed
  creates
- The `Created/Linked Subtasks` table
- Any warnings or failures
- That no implementation has started and linked subtasks remain in `To Do`
  unless Jira already shows another status

If dispatch is unavailable, stop and report the skill as blocked rather than
reproducing the subagent inline.

## Example

<example>
Input: `JIRA_URL=https://workspace.atlassian.net/browse/PROJ-123`

1. Read `./subagents/subtask-creator.md`
2. Dispatch `subtask-creator` with `JIRA_URL`
3. Subagent returns:

   SUBTASKS: PASS
   Validation: PASS
   Ticket: PROJ-123
   Plan file: docs/PROJ-123-tasks.md
   Tasks in plan: 4
   Already linked: 1
   Created now: 3
   Failed creates: 0
   Decisions Log: PRESENT
   Reason: All tasks are now linked to Jira subtasks.

   Created/Linked Subtasks:
   | Task | Subtask Key | Title                         | Outcome        |
   | ---- | ----------- | ----------------------------- | -------------- |
   | 1    | PROJ-200    | Task 1: Set up schema         | Already linked |
   | 2    | PROJ-201    | Task 2: Implement API layer   | Created now    |
   | 3    | PROJ-202    | Task 3: Add integration tests | Created now    |
   | 4    | PROJ-203    | Task 4: Update docs           | Created now    |

   Warnings:
   - None

   Failures:
   - None

4. Report:
   "Phase 4 complete for `PROJ-123`.
   `docs/PROJ-123-tasks.md` now maps all 4 tasks to Jira subtasks.
   1 task was already linked and 3 subtasks were created now.
   No implementation has started."
</example>
