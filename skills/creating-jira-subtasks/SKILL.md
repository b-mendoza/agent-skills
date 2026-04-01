---
name: "creating-jira-subtasks"
description: 'Phase 4 of the orchestrating-jira-workflow pipeline. Reads the task plan from docs/<TICKET_KEY>-tasks.md and creates one Jira subtask per task under the parent ticket, updating the plan file with subtask keys for traceability. Invoked by the orchestrating-jira-workflow skill — not intended for standalone use. This skill creates subtasks but never starts implementation — all subtasks are created in "To Do" status.'
---

# Creating Jira Subtasks

## Purpose

Dispatch the `subtask-creator` subagent to read the task plan, create
corresponding subtasks in Jira under the parent ticket, and update the plan
file with subtask keys for traceability.

This skill is a **pure coordinator** — it dispatches one subagent and reports
the result. It never makes Jira API calls, reads files, writes files, or
runs commands directly.

## Inputs

| Input      | Required | Example                                                     |
| ---------- | -------- | ----------------------------------------------------------- |
| `JIRA_URL` | Yes      | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

Extract these values from the URL:

- **Workspace:** subdomain before `.atlassian.net` → `vukaheavyindustries`
- **Project:** prefix before the dash in the path segment → `JNS`
- **Ticket key:** full path segment → `JNS-6065`

### Input contract

The task plan file must already exist at `docs/<TICKET_KEY>-tasks.md`.
If it does not, the orchestrator should re-run Phase 2.

The plan file must contain these sections, produced by upstream skills:

| Required section                        | Produced by            | Purpose                                       |
| --------------------------------------- | ---------------------- | --------------------------------------------- |
| `## Tasks` with numbered task sections  | planning-jira-tasks    | Each task becomes one Jira subtask            |
| `## Execution Order Summary`            | planning-jira-tasks    | Determines creation sequence                  |
| `## Decisions Log`                      | clarifying-assumptions | Phase-completion signal; resolved decisions   |
| Per-task `Questions to answer` resolved | clarifying-assumptions | Subtask descriptions reflect resolved answers |
| Per-task `Implementation notes` updated | clarifying-assumptions | Descriptions include confirmed approach       |

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

## Multi-Platform MCP Compatibility

Jira subtasks are created through MCP tools, but the specific tool names
and interfaces vary across platforms (Cursor, Claude Code, OpenCode). The
`subtask-creator` subagent handles MCP tool discovery internally — this
skill does not need to know which tools are available.

## How This Skill Works

This skill does exactly two things: **dispatch** the `subtask-creator`
subagent with the `TICKET_KEY` derived from `JIRA_URL`, and **report** its
summary to the user.

The subagent's summary is the only data this skill processes. If the summary
indicates errors (parent not found, all subtasks failed, validation failure),
relay them to the user. If it indicates success, report the subtask count
and the tracking table.

## Execution Steps

### 1. Dispatch `subtask-creator`

Read `./subagents/subtask-creator.md` and dispatch the subagent with:

- `TICKET_KEY` — the ticket key derived from the user's `JIRA_URL`.

The subagent handles everything end-to-end: reads and parses the task plan,
looks up the parent ticket via Jira MCP, builds subtask payloads in Jira wiki
markup (cross-referencing resolved decisions), creates subtasks sequentially,
handles individual failures gracefully, updates the plan file with subtask
keys and the tracking table, validates the output contract, and returns a
concise summary.

### 2. Handle the result

Collect the subagent's summary. Check the summary for errors:

- **FAIL (fatal — parent not found, auth failure, no MCP tools):** Relay the
  error to the user and stop. Phase 4 is incomplete.
- **BLOCKED (plan file missing):** Relay the error — the orchestrator should
  re-run Phase 2. Phase 4 is incomplete.
- **WARN (partial failures):** Relay which tasks failed and which succeeded.
  If ALL subtasks failed, the subagent will NOT have written the
  `## Jira Subtasks` table — tell the user Phase 4 is incomplete. Offer to
  retry.
- **WARN (Decisions Log missing):** Relay this warning — subtask descriptions
  may not reflect resolved decisions.
- **WARN (validation failure):** Relay the validation details. Offer to retry.
- **PASS (all subtasks created, validation passed):** Proceed to step 3.

If the platform cannot dispatch the subagent, fall back to reading the
subagent's `.md` file and executing its instructions directly.

### 3. Report to the user

Using ONLY the information from the subagent's summary, tell the user:

- Total subtasks created vs. total tasks in plan.
- Table of subtask keys, titles, and links.
- Any failures or warnings.
- Remind the user that no implementation has started — subtasks are in "To Do".

<example>
User provides: https://vukaheavyindustries.atlassian.net/browse/JNS-6065

1. Extract TICKET_KEY → JNS-6065
2. Read ./subagents/subtask-creator.md
3. Dispatch subtask-creator with TICKET_KEY=JNS-6065
4. Subagent returns:

   ## Subtask Creation Summary
   - Parent ticket: JNS-6065
   - Tasks in plan: 5
   - Successfully created: 5
   - Failed: 0
   - Decisions Log present: Yes
   - Validation: PASS

   ### Created Subtasks
   | Task | Subtask Key | Title                          |
   | ---- | ----------- | ------------------------------ |
   | 1    | JNS-6070    | Task 1: Set up database schema |
   | 2    | JNS-6071    | Task 2: Implement API layer    |
   | 3    | JNS-6072    | Task 3: Build UI components    |
   | 4    | JNS-6073    | Task 4: Add integration tests  |
   | 5    | JNS-6074    | Task 5: Update documentation   |

   ### Failures
   None

5. Report to user:
   "5 subtasks created under JNS-6065 (5/5 succeeded).
    JNS-6070 through JNS-6074. Plan file updated with subtask keys.
    No implementation started — all subtasks are in To Do."
</example>
