---
name: "fetching-jira-ticket"
description: 'Retrieve ALL information from a Jira ticket (description, comments, subtasks, attachments metadata, labels, sprint, status, assignee, reporter, linked issues, custom fields, acceptance criteria) and persist it as a single Markdown file. Use whenever the user says "fetch ticket", "retrieve Jira", "pull ticket info", "get ticket details", "look up ticket", "grab the Jira", "what does ticket X say", "check the ticket", "read the ticket", "show me the ticket", or provides a Jira ticket URL or key like PROJECT-1234. Also triggered by the orchestrating-jira-workflow skill as Phase 1 of the end-to-end pipeline. Trigger even if the user only pastes a ticket key with no other context — that alone means "fetch this ticket." This skill ONLY retrieves — it never modifies the ticket or starts implementation.'
---

# Fetching Jira Ticket

## Purpose

Dispatch the `ticket-retriever` subagent to extract every available field from
a Jira ticket and its subtasks, then write a comprehensive Markdown snapshot
to `docs/`. This file becomes the single source of truth for all downstream
skills (planning, subtask creation, execution, validation).

This skill is a **pure coordinator** — it dispatches one subagent and reports
the result. It never makes Jira API calls, reads files, writes files, or
runs commands directly.

## Inputs

| Input        | Source              | Required | Example                                                     |
| ------------ | ------------------- | -------- | ----------------------------------------------------------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065`                                                  |
| `JIRA_URL`   | User (optional)     | No       | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

If the user provides a full URL, pass it along to the subagent which will
extract the ticket key from it.

## Output

A Markdown file at:

```
docs/<TICKET_KEY>.md
```

### Output contract (consumed by downstream skills)

Every section below **must** appear in the output file. If a section has no
data, the subagent keeps the heading and writes `_None_` beneath it — never
omits a heading. Downstream skills parse these headings programmatically, so
missing headings break the pipeline.

| Section                  | Required by                                 | Why                                     |
| ------------------------ | ------------------------------------------- | --------------------------------------- |
| `## Metadata` table      | planning-jira-tasks                         | Task decomposition needs ticket context |
| `## Description`         | planning-jira-tasks                         | Primary source for requirements         |
| `## Acceptance Criteria` | planning-jira-tasks, task-validator         | Maps to Definition of Done              |
| `## Comments`            | planning-jira-tasks                         | Contains decisions and clarifications   |
| `## Subtasks`            | planning-jira-tasks, creating-jira-subtasks | Avoids duplicating existing work        |
| `## Linked Issues`       | planning-jira-tasks                         | Dependency and context awareness        |
| `## Attachments`         | executing-jira-task                         | Implementation reference                |
| `## Custom Fields`       | planning-jira-tasks                         | May contain acceptance criteria         |

## Subagent Registry

| Subagent           | Path                              | Purpose                                                               |
| ------------------ | --------------------------------- | --------------------------------------------------------------------- |
| `ticket-retriever` | `./subagents/ticket-retriever.md` | End-to-end: retrieves all data, assembles document, writes, validates |

Before dispatching, read the subagent file to understand its input/output
contract. The path is relative to this skill's directory.

## Multi-Platform MCP Compatibility

Jira data is accessed through MCP tools, but the specific tool names and
interfaces vary across platforms (Cursor, Claude Code, OpenCode). The
`ticket-retriever` subagent handles MCP tool discovery internally — this
skill does not need to know which tools are available.

## Execution Steps

### 1. Dispatch `ticket-retriever`

Read `./subagents/ticket-retriever.md` and dispatch the subagent with:

- `TICKET_KEY` — the ticket key extracted from the user's input.
- `JIRA_URL` — if the user provided a full URL, include it.

The subagent handles everything end-to-end:

- Validates the input format.
- Discovers available Jira MCP tools.
- Retrieves all parent ticket fields, comments, attachments metadata.
- Retrieves all subtasks and linked issues (full details, regardless of count).
- Handles pagination, auth errors, and rate limits.
- Runs `mkdir -p docs`.
- Assembles the document using the standardised template.
- Writes to `docs/<TICKET_KEY>.md`.
- Validates the output (all sections present, counts match).
- Cleans up any temporary files.
- Returns a concise summary.

### 2. Handle the result

Collect the subagent's summary. Check the summary for errors:

- **If the subagent reports a fatal error** (ticket not found, auth failure):
  relay the error to the user and stop.
- **If the subagent reports validation FAIL**: relay the validation details to
  the user. Offer to retry.
- **If validation PASS**: proceed to step 3.

### 3. Report to the user

Using ONLY the information from the subagent's summary, tell the user:

- The file path written (e.g., `docs/JNS-6065.md`).
- A short summary: ticket title, status, number of comments, number of subtasks
  and linked issues retrieved.
- Any retrieval errors or warnings.
- Remind the user this is retrieval only — no ticket modifications, no branches,
  no code, no implementation.

## Execution Rules

1. **Delegate everything.** This skill dispatches the `ticket-retriever`
   subagent and reports its summary. It never makes Jira API calls, reads
   files, writes files, or runs commands directly.
2. **Do not load raw data.** The subagent's summary is the only data this skill
   processes. Never ask the subagent to return file contents or raw API
   responses.
3. **Retrieve only.** Do not modify the Jira ticket. Do not start
   implementation, create branches, write code, or propose solutions.
4. **Fail gracefully.** If the subagent reports partial failures (some subtasks
   could not be retrieved), relay the specifics to the user but do not treat
   partial success as a fatal error.
