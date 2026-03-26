---
name: "fetching-jira-ticket"
description: 'Retrieve ALL information from a Jira ticket (description, comments, subtasks, attachments metadata, labels, sprint, status, assignee, reporter, linked issues, custom fields, acceptance criteria) and persist it as a single Markdown file. Use whenever the user says "fetch ticket", "retrieve Jira", "pull ticket info", "get ticket details", "look up ticket", "grab the Jira", "what does ticket X say", "check the ticket", "read the ticket", "show me the ticket", or provides a Jira ticket URL or key like PROJECT-1234. Also triggered by the orchestrating-jira-workflow skill as Phase 1 of the end-to-end pipeline. Trigger even if the user only pastes a ticket key with no other context — that alone means "fetch this ticket." This skill ONLY retrieves — it never modifies the ticket or starts implementation.'
---

# Fetching Jira Ticket

## Purpose

Extract every available field from a Jira ticket and its subtasks, then write a
comprehensive Markdown snapshot to `docs/`. This file becomes the single source
of truth for all downstream skills (planning, subtask creation, execution).

## Inputs

| Input        | Source              | Required | Example                                                     |
| ------------ | ------------------- | -------- | ----------------------------------------------------------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065`                                                  |
| `JIRA_URL`   | User (optional)     | No       | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

If the user provides a full URL, extract the ticket key from it.

## Output

A Markdown file at:

```
docs/<TICKET_KEY>.md
```

### Output contract (consumed by downstream skills)

The output file **must** contain all of these sections for downstream skills to
function correctly. If a section has no data, include the heading with `_None_`
beneath it — never omit the heading.

| Section                  | Required by                                 | Why                                     |
| ------------------------ | ------------------------------------------- | --------------------------------------- |
| `## Metadata` table      | planning-jira-tasks                         | Task decomposition needs ticket context |
| `## Description`         | planning-jira-tasks                         | Primary source for requirements         |
| `## Acceptance Criteria` | planning-jira-tasks, task-validator         | Maps to Definition of Done              |
| `## Comments`            | planning-jira-tasks                         | Contains decisions and clarifications   |
| `## Subtasks`            | planning-jira-tasks, creating-jira-subtasks | Avoids duplicating existing work        |
| `## Linked Issues`       | planning-jira-tasks                         | Dependency and context awareness        |
| `## Attachments`         | executing-subtask                           | Implementation reference                |
| `## Custom Fields`       | planning-jira-tasks                         | May contain acceptance criteria         |

## Subagent Registry

| Subagent           | Path                              | Purpose                                    |
| ------------------ | --------------------------------- | ------------------------------------------ |
| `ticket-retriever` | `./subagents/ticket-retriever.md` | Retrieves subtask and linked issue details |

Before delegating, read the subagent file to understand its contract (expected
input format, output format, and rules). The path is relative to this skill's
directory.

## Retrieval Checklist

You MUST retrieve **all** of the following. If a field is empty or unavailable,
write `_None_` — never silently omit it.

### Core fields

- Ticket key & URL
- Summary / title
- Status, Resolution
- Type (Story, Bug, Task, Epic, ...)
- Priority
- Labels, Components
- Fix Version(s), Affects Version(s)
- Sprint / Board
- Epic link (if any)
- Assignee, Reporter
- Created date, Updated date, Due date

### Rich content

- **Description** — full body, preserve formatting
- **Acceptance criteria** — if present as a custom field or within description
- **Comments** — every comment, with author and timestamp, in chronological order
- **Attachments** — list filenames, types, and sizes (do not download binary files)

### Subtasks & linked issues

For **each subtask** and **each linked issue**:

1. Retrieve its key, summary, status, assignee, and type.
2. Retrieve its full description.
3. Retrieve all its comments (author + timestamp + body).
4. Note the link type (e.g., "is blocked by", "relates to").

### Custom fields

Retrieve any non-empty custom fields visible on the ticket and list them under a
`## Custom Fields` section.

## Document Template

Write the file using this structure:

```markdown
# <TICKET_KEY>: <Summary>

> Retrieved on: <YYYY-MM-DD HH:MM UTC>

## Metadata

| Field           | Value |
| --------------- | ----- |
| Status          | ...   |
| Type            | ...   |
| Priority        | ...   |
| Assignee        | ...   |
| Reporter        | ...   |
| Labels          | ...   |
| Components      | ...   |
| Sprint          | ...   |
| Epic            | ...   |
| Fix Version     | ...   |
| Affects Version | ...   |
| Created         | ...   |
| Updated         | ...   |
| Due Date        | ...   |

## Description

<full description body>

## Acceptance Criteria

<if present, otherwise _None_>

## Comments

### Comment 1 — <Author> (<YYYY-MM-DD HH:MM>)

<body>

### Comment 2 — ...

## Subtasks

### <SUBTASK_KEY>: <Summary>

- **Status:** ...
- **Assignee:** ...
- **Type:** ...

#### Description

<body>

#### Comments

##### Comment 1 — <Author> (<date>)

<body>

### <next subtask...>

## Linked Issues

### <LINK_TYPE>: <ISSUE_KEY> — <Summary>

- **Status:** ...
- **Type:** ...

#### Description

<body>

#### Comments

...

## Attachments

| Filename | Type | Size |
| -------- | ---- | ---- |

## Custom Fields

| Field Name | Value |
| ---------- | ----- |
| ...        | ...   |
```

## Execution Steps

### 1. Retrieve core fields and parent ticket content

Use the Jira MCP to fetch the parent ticket's core fields, description,
comments, and attachment metadata. This stays in the main agent's context
because it is the minimum needed to write the document skeleton.

### 2. Delegate subtask and linked issue retrieval (if needed)

Count the subtasks and linked issues on the parent ticket.

**If the combined total is ≤ 3:** Retrieve them inline — the context cost is
manageable.

**If the combined total is > 3:** Delegate to the `ticket-retriever` subagent
to avoid context pollution from many MCP responses:

```
agent ticket-retriever "Retrieve full details for these Jira issues and write results to docs/<TICKET_KEY>-related.md: <comma-separated list of subtask and linked issue keys>. For each issue, retrieve: key, summary, status, assignee, type, full description, and all comments (with author + timestamp). For linked issues, also note the link type."
```

After the subagent completes, read `docs/<TICKET_KEY>-related.md` and merge its
content into the appropriate sections of the main document.

### 3. Assemble and write the document

Create `docs/` if missing (`mkdir -p docs`). Write the full document using the
template above.

### 4. Validate

After writing the file, re-read it and verify:

- [ ] Every section from the template is present (even if marked `_None_`).
- [ ] Subtask count matches what Jira reported.
- [ ] Comment count per item matches what Jira reported.
- [ ] The `## Description` section is non-empty (downstream skills depend on it).

If anything is missing, fetch the missing data and update the file before
reporting completion.

### 5. Clean up

If the subagent wrote a temporary consolidated file
(`docs/<TICKET_KEY>-related.md`), delete it after the main document is
validated.

### 6. Confirm completion

Tell the user:

- The file path written.
- A short summary: ticket title, status, number of comments, number of
  subtasks retrieved.
- Remind the user that this is retrieval only — no action has been taken.

## Execution Rules

1. **Retrieve only.** Do NOT modify the Jira ticket. Do NOT start implementation.
   Do NOT create branches, write code, or propose solutions.
2. **Be exhaustive.** If the Jira MCP tool paginates results (e.g., comments),
   fetch every page.
3. **Preserve fidelity.** Keep original formatting, code blocks, and links from
   the description and comments.
4. **Create `docs/` if missing.** Run `mkdir -p docs` before writing.
