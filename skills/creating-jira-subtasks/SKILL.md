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
subagent's summary. Plan parsing, Jira operations, and plan-file edits all stay
inside `subtask-creator` after dispatch.

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

## Workflow Overview

```text
1. Read the subtask-creator definition
2. Dispatch it with JIRA_URL
3. Interpret its structured result
4. Report only the concise phase summary to the caller
```

## Subagent Registry

Read a subagent definition only when you are about to dispatch it.

| Subagent          | Path                             | Purpose                                               |
| ----------------- | -------------------------------- | ----------------------------------------------------- |
| `subtask-creator` | `./subagents/subtask-creator.md` | Reconcile the clarified plan with Jira and return a structured Phase 4 summary |

## How This Skill Works

This skill is intentionally narrow. The parent workflow is responsible for
Phase 4 gating and progress tracking; this skill assumes the Phase 3 approval
step has already happened before Jira writes begin.

Inside Phase 4, keep only:

- The structured `SUBTASKS` verdict
- The validation verdict
- The task/key/title/dependency/priority rows needed for progress reporting
- Any warning or fatal reason that requires user attention

Relay only the structured fields the subagent returns. Raw Jira payloads, raw
file contents, and intermediate parse details stay inside `subtask-creator`
unless the user explicitly asks for them.

## Input and Output Contracts

Primary artifact:

```text
docs/<TICKET_KEY>-tasks.md
```

For the complete standalone input contract, output contract, and summary-field
definitions, read `./references/phase-4-io-contracts.md`.

The short version:

- The plan is expected to contain numbered `## Task <N>:` sections under
  `## Tasks`.
- Standalone malformed or missing plans resolve to `SUBTASKS: BLOCKED`.
- A missing `## Decisions Log` downgrades the run to `SUBTASKS: WARN` rather
  than blocking it.
- Successful Phase 4 output is still the validated presence of `## Jira
  Subtasks` plus `Jira Subtask: <KEY>` lines in linked task sections, per
  `./references/phase-4-io-contracts.md`.

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
- The `Created/Linked Subtasks` table, including dependency and priority
  metadata for each task
- Any warnings or failures
- That no implementation has started and linked subtasks remain in `To Do`
  unless Jira already shows another status

Use dispatch to run `subtask-creator`. If dispatch is unavailable, report the
skill as blocked rather than reproducing the subagent inline.

## Escalation

Use the subagent's structured verdict as the only routing input:

| Summary state | Coordinator action |
| ------------- | ------------------ |
| `SUBTASKS: PASS` with `Validation: PASS` | Report success and proceed |
| `SUBTASKS: WARN` with `Validation: PASS` | Report usable output with warnings and make failed or skipped linkage visible |
| `SUBTASKS: BLOCKED` | Stop and surface the plan-shape or unsafe-linkage issue |
| `SUBTASKS: FAIL` | Stop and surface the fatal Jira or validation failure |
| `SUBTASKS: ERROR` or `Validation: FAIL` | Stop and surface the unexpected failure or local contract failure |

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
   | Task | Subtask Key | Title                         | Dependencies | Priority | Outcome        |
   | ---- | ----------- | ----------------------------- | ------------ | -------- | -------------- |
   | 1    | PROJ-200    | Task 1: Set up schema         | None         | High     | Already linked |
   | 2    | PROJ-201    | Task 2: Implement API layer   | 1            | High     | Created now    |
   | 3    | PROJ-202    | Task 3: Add integration tests | 2            | Medium   | Created now    |
   | 4    | PROJ-203    | Task 4: Update docs           | None         | Medium   | Created now    |

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
