---
name: "fetching-jira-ticket"
description: 'Retrieve ALL information from a Jira ticket (description, comments, subtasks, attachments metadata, labels, sprint, status, assignee, reporter, linked issues, custom fields, acceptance criteria) and persist it as a single Markdown file. Use whenever the user says "fetch ticket", "retrieve Jira", "pull ticket info", "get ticket details", "look up ticket", "grab the Jira", "what does ticket X say", "check the ticket", "read the ticket", "show me the ticket", or provides a Jira ticket URL like https://workspace.atlassian.net/browse/PROJECT-1234. Also triggered by the orchestrating-jira-workflow skill as Phase 1 of the end-to-end pipeline. Trigger even if the user only pastes a Jira URL with no other context — that alone means "fetch this ticket." This skill ONLY retrieves — it never modifies the ticket or starts implementation.'
---

# Fetching Jira Ticket

## Purpose

Dispatch the `ticket-retriever` subagent to extract every available field from
a Jira ticket and its subtasks, then write a comprehensive Markdown snapshot
to `docs/`. This file becomes the single source of truth for all downstream
skills (planning, subtask creation, execution, validation).

This skill is a **pure coordinator** — it dispatches one subagent and reports
the result.

## Inputs

| Input      | Required | Example                                                     |
| ---------- | -------- | ----------------------------------------------------------- |
| `JIRA_URL` | Yes      | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

Extract these values from the URL:

- **Workspace:** subdomain before `.atlassian.net` → `vukaheavyindustries`
- **Project:** prefix before the dash in the path segment → `JNS`
- **Ticket key:** full path segment → `JNS-6065`

If the user provides only a ticket key (e.g., `JNS-6065`), ask for the full
URL — it carries workspace and project context that downstream skills need.

## Output

A Markdown file at:

```
docs/<TICKET_KEY>.md
```

### Output contract (consumed by downstream skills)

Every section below appears in the output file. If a section has no data, the
subagent keeps the heading and writes `_None_` beneath it — headings are never
omitted. Downstream skills parse these headings programmatically, so missing
headings break the pipeline.

| Section                  | Required by                                 | Why                                     |
| ------------------------ | ------------------------------------------- | --------------------------------------- |
| `## Metadata` table      | planning-jira-tasks                         | Task decomposition needs ticket context |
| `## Description`         | planning-jira-tasks                         | Primary source for requirements         |
| `## Acceptance Criteria` | planning-jira-tasks, task-validator          | Maps to Definition of Done              |
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

## How This Skill Works

This skill does exactly two things: **dispatch** the `ticket-retriever`
subagent with the `TICKET_KEY` derived from `JIRA_URL`, and **report** its
summary to the user.

The subagent's summary is the only data this skill processes. If the summary
indicates errors, relay them to the user. If it indicates success, report the
file path and key stats.

### 1. Dispatch `ticket-retriever`

Read `./subagents/ticket-retriever.md` and dispatch the subagent with:

- `TICKET_KEY` — the ticket key extracted from the user's `JIRA_URL`.

The subagent handles everything end-to-end: input validation, MCP tool
discovery, retrieval of all parent ticket fields, comments, attachments
metadata, subtasks, linked issues, pagination, error handling, document
assembly, file writing, and output validation.

### 2. Handle the result

Collect the subagent's summary. Check the summary for errors:

- **Validation FAIL (fatal — ticket not found, auth failure, no MCP tools):**
  Relay the error to the user and stop.
- **Validation FAIL (non-fatal — validation mismatch):** Relay the validation
  details to the user. Offer to retry.
- **Validation PASS:** Proceed to step 3.

### 3. Report to the user

Using ONLY the information from the subagent's summary, tell the user:

- The file path written (e.g., `docs/JNS-6065.md`).
- A short summary: ticket title, status, number of comments, number of
  subtasks and linked issues retrieved.
- Any retrieval errors or warnings.
- Remind the user this is retrieval only — no ticket modifications, no
  branches, no code, no implementation.

<example>
User provides: https://vukaheavyindustries.atlassian.net/browse/JNS-6065

1. Extract TICKET_KEY → JNS-6065
2. Read ./subagents/ticket-retriever.md
3. Dispatch ticket-retriever with TICKET_KEY=JNS-6065
4. Subagent returns:

   VALIDATION: PASS
   File written: docs/JNS-6065.md
   Ticket: JNS-6065: Implement dark mode toggle
   Status: In Progress | Type: Story
   Comments: 4 on parent ticket
   Subtasks retrieved: 3 (of 3 found)
   Linked issues retrieved: 1 (of 1 found)
   Attachments listed: 2
   Retrieval errors: None

5. Report to user:
   "Ticket fetched and saved to docs/JNS-6065.md.
    JNS-6065: Implement dark mode toggle (In Progress).
    4 comments, 3 subtasks, 1 linked issue, 2 attachments.
    This is retrieval only — no changes were made to the ticket."
</example>
