---
name: "creating-jira-subtasks"
description: 'Create subtasks in Jira from a previously generated task plan. Reads the plan from docs/<TICKET_KEY>-tasks.md and creates one Jira subtask per task under the parent ticket. Use when the user says "create subtasks", "push tasks to Jira", "sync plan to Jira", "create Jira tickets", "make subtasks for PROJECT-1234", or anything about turning a plan into Jira issues. Also triggered by the orchestrating-jira-workflow skill as Phase 4. Requires the task plan to already exist (run planning-jira-tasks first if it does not). Use this skill even if the user just says "push to Jira" or "create the tickets" after a planning phase — those are subtask creation requests.'
---

# Creating Jira Subtasks

## Purpose

Dispatch the `subtask-creator` subagent to read the task plan, create
corresponding subtasks in Jira under the parent ticket, and update the plan
file with subtask keys for traceability.

This skill is a **pure coordinator** — it dispatches one subagent and reports
the result. It never makes Jira API calls, reads files, writes files, or
runs commands directly.

## Platform Compatibility

This skill follows the Agent Skills open standard and works across Claude Code,
Cursor, OpenCode, and other compatible tools. Subagent delegation is the only
platform-specific behavior:

| Platform        | Dispatch method                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| **Claude Code** | Natural language or @-mention the subagent. Uses the Agent tool (renamed from Task in v2.1.63).           |
| **Cursor**      | Auto-delegates based on subagent description, or explicit mention. Supported since Cursor 2.4 (Jan 2026). |
| **OpenCode**    | @-mention or Task tool. Also reads `.claude/agents/` as a fallback.                                       |

All platforms support co-located subagents inside skill directories. The
subagent at `./subagents/subtask-creator.md` is read by the orchestrating agent
at dispatch time and passed as the subagent's system prompt.

## Inputs

| Input        | Source              | Required | Example    |
| ------------ | ------------------- | -------- | ---------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065` |

The task plan file must already exist at `docs/<TICKET_KEY>-tasks.md`.
If it does not, tell the user to run **planning-jira-tasks** first.

### Input contract

The plan file must contain these sections, produced by upstream skills:

| Required section                        | Produced by            | Purpose                                       |
| --------------------------------------- | ---------------------- | --------------------------------------------- |
| `## Tasks` with numbered task sections  | planning-jira-tasks    | Each task becomes one Jira subtask            |
| `## Execution Order Summary`            | planning-jira-tasks    | Determines creation sequence                  |
| `## Decisions Log`                      | clarifying-assumptions | Phase-completion signal; resolved decisions   |
| Per-task `Questions to answer` resolved | clarifying-assumptions | Subtask descriptions reflect resolved answers |
| Per-task `Implementation notes` updated | clarifying-assumptions | Descriptions include confirmed approach       |

**Pre-flight gate:** If `## Decisions Log` is missing, the plan has not been
clarified. The subagent will note this as a warning but proceed. Warn the user
and ask whether to continue or run clarifying-assumptions first.

## Output

- Subtasks created in Jira under `TICKET_KEY`.
- A summary table printed to the user showing each subtask key and title.
- The local plan file updated with created subtask keys for traceability.

### Output contract (consumed by executing-jira-task)

| Addition                                              | Required by         | Purpose                                           |
| ----------------------------------------------------- | ------------------- | ------------------------------------------------- |
| `## Jira Subtasks` table (Task #, Key, Title, Status) | executing-jira-task | Maps task numbers to Jira keys for status updates |
| `Jira Subtask: <KEY>` line in each task section       | executing-jira-task | Executor transitions the correct Jira issue       |

The orchestrator checks for `## Jira Subtasks` as the Phase 4 completion
signal.

## Subagent Registry

| Subagent          | Path                             | Purpose                                                                              |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| `subtask-creator` | `./subagents/subtask-creator.md` | End-to-end: parse plan → lookup parent → build payloads → create → update → validate |

Before dispatching, read the subagent file to understand its input/output
contract. The path is relative to this skill's directory.

## Execution Steps

### 1. Dispatch `subtask-creator`

Read `./subagents/subtask-creator.md` and dispatch the subagent with:

- `TICKET_KEY` — the ticket key from the user's input.

The subagent handles everything end-to-end:

- Reads and parses the task plan (all task sections + Decisions Log).
- Looks up the parent ticket via Jira MCP (extracts project key, subtask
  issue type).
- Builds subtask payloads in Jira wiki markup, cross-referencing resolved
  decisions.
- Creates subtasks sequentially via Jira MCP (with retry on rate limits).
- Handles individual failures gracefully (logs + continues).
- Updates `docs/<TICKET_KEY>-tasks.md`: adds `## Jira Subtasks` table and
  `Jira Subtask: <KEY>` per task.
- Validates the output contract (table exists, keys present, counts match).
- Cleans up any temporary files.
- Returns a concise summary.

### 2. Handle the result

Collect the subagent's summary. Check for issues:

- **If the subagent reports the parent ticket was not found:** Relay the error
  to the user and stop.
- **If the subagent reports all subtasks failed:** Tell the user no subtasks
  were created. Offer to retry or investigate.
- **If the subagent reports partial failures:** Relay which tasks failed and
  which succeeded.
- **If the subagent warns that `## Decisions Log` was missing:** Relay this
  warning to the user.
- **If validation FAIL:** Relay the details to the user. Offer to retry.

### 3. Clean up

Delete any temporary files that may remain:

```bash
rm -f docs/<TICKET_KEY>-subtask-manifest.md
rm -f docs/<TICKET_KEY>-subtask-results.md
```

### 4. Report to the user

Using ONLY the information from the subagent's summary, tell the user:

- Total subtasks created vs. total tasks in plan.
- Table of subtask keys, titles, and links.
- Any failures or warnings.
- Remind the user that no implementation has started — subtasks are in "To Do".

## Error Handling

- **Jira MCP unavailable:** The subagent will report this. Relay to the user
  and stop.
- **Parent ticket not found:** The subagent will report this. Relay and stop.
- **Individual subtask failure:** The subagent handles this internally (logs
  - continues). Relay the failures from the summary.
- **ALL subtasks fail:** The subagent will NOT write the `## Jira Subtasks`
  table. Tell the user Phase 4 is incomplete.
- **Subagent delegation fails:** If the platform cannot dispatch the subagent,
  fall back to reading the subagent's `.md` file and executing its instructions
  directly.
