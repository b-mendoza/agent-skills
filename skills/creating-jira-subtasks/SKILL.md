---
name: "creating-jira-subtasks"
description: "Creates or reconciles Jira subtasks for an approved Phase 4 task plan. Use after docs/<TICKET_KEY>-tasks.md is clarified and the user has approved Jira writes; dispatches subtask-creator and returns a compact status summary."
---

# Creating Jira Subtasks

You are a Phase 4 Jira subtask orchestration skill. Your job is to keep the
caller-facing workflow small: derive identifiers from `JIRA_URL`, load only the
local contract or external source map when needed, dispatch `subtask-creator`,
and relay the structured result.

The subagent owns plan parsing, Jira operations, plan-file edits, and validation.
The orchestrator keeps only verdicts, paths, counts, warnings, and failures.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `JIRA_URL` | Yes | `https://workspace.atlassian.net/browse/PROJ-123` |

Derive these values only for routing and reporting:

- **Workspace:** subdomain before `.atlassian.net`
- **Project:** prefix before the dash in the ticket key
- **TICKET_KEY:** full path segment, such as `PROJ-123`

Pass the full `JIRA_URL` to the subagent. It carries the workspace context Jira
tools need for reads and writes.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Phase 4 artifact shape, summary fields, or status semantics | `./references/phase-4-io-contracts.md` |
| Current Jira API syntax, subtask platform behavior, or prompt-disclosure rationale | `./references/external-sources.md`, then fetch only the relevant URL |
| Subtask creation or reconciliation | `./subagents/subtask-creator.md` |

External URLs are optional just-in-time sources. This skill remains executable
from its bundled files when network access is unavailable.

## Subagent Registry

Read a subagent definition only when dispatching that subagent.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `subtask-creator` | `./subagents/subtask-creator.md` | Reconciles the clarified plan with Jira subtasks and returns the Phase 4 summary |

## Workflow

1. Confirm `JIRA_URL` is present and derive `TICKET_KEY` for local reporting.
2. Read `./references/phase-4-io-contracts.md` only when interpreting an output,
   validating Phase 4, or explaining the required artifact shape.
3. Read `./subagents/subtask-creator.md` and dispatch it with `JIRA_URL`.
4. Route on the returned `SUBTASKS` and `Validation` lines.
5. Report a concise Phase 4 rollup: parent, `TICKET_KEY`, plan path, counts,
   warnings, failures, and the reminder that implementation work has not begun.

## Routing Rules

| Result | Orchestrator action |
| ------ | ------------------- |
| `SUBTASKS: PASS` with `Validation: PASS` | Report success and proceed |
| `SUBTASKS: WARN` with `Validation: PASS` | Report usable output with visible warnings or failed task links |
| `SUBTASKS: BLOCKED` | Stop and surface the plan-shape or unsafe-linkage issue |
| `SUBTASKS: FAIL` | Stop and surface the fatal Jira or validation failure |
| `SUBTASKS: ERROR` or `Validation: FAIL` | Stop and surface the unexpected failure or local contract failure |

Treat `Validation: NOT_RUN` as incomplete Phase 4 output even when the top-level
status is already `BLOCKED`, `FAIL`, or `ERROR`.

## Output Contract

Return only the subagent's structured summary plus a short caller-facing rollup.
The full summary schema lives in `./references/phase-4-io-contracts.md`.

Do not add GitHub-style write-model or capability lines to the Jira report. Jira
uses one native subtask relationship path for this workflow.

## Example

<example>
Input: `JIRA_URL=https://workspace.atlassian.net/browse/PROJ-123`

1. The orchestrator derives `TICKET_KEY=PROJ-123` for reporting.
2. The orchestrator dispatches `subtask-creator` with `JIRA_URL`.
3. The subagent returns:

```markdown
SUBTASKS: PASS
Validation: PASS
Parent: PROJ-123
TICKET_KEY: PROJ-123
Plan file: docs/PROJ-123-tasks.md
```

4. The orchestrator reports success, creation/link counts, warnings/failures if
   any, and that no implementation has started.
</example>
