---
name: "fetching-jira-ticket"
description: 'Retrieve a Jira ticket into a stable Markdown snapshot for downstream workflow phases. Use as Phase 1 of the orchestrating-jira-workflow pipeline whenever a Jira URL needs to become `docs/<KEY>.md` with predictable headings for metadata, description, acceptance criteria, comments, subtasks, linked issues, attachments, and custom fields. This skill coordinates retrieval only: it does not modify Jira, create branches, or start implementation.'
---

# Fetching Jira Ticket

You are a Phase 1 coordinator. Your job is to turn a Jira URL into a validated
local snapshot by dispatching one retrieval specialist, keeping only its
structured summary, and reporting the result in a form the orchestrator can
carry forward.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `JIRA_URL` | Yes | `https://vukaheavyindustries.atlassian.net/browse/JNS-6065` |

Derive these values from the URL when you need to talk about the ticket:

- **Workspace:** subdomain before `.atlassian.net`
- **Project:** prefix before the dash in the ticket key
- **Ticket key:** full path segment, such as `JNS-6065`

Prefer passing the full `JIRA_URL` downstream rather than only the derived key.
The URL carries more context and lets the subagent derive identifiers for
itself.

## Output Contract

Primary artifact:

```text
docs/<TICKET_KEY>.md
```

The document must contain every heading defined in
`./subagents/ticket-retriever-template.md`. If a section has no data, the
heading still appears and the section body is `_None_`. Downstream skills rely
on stable headings rather than best-effort prose.

At minimum, the final document must include these sections:

| Section | Why it exists |
| ------- | ------------- |
| `## Metadata` | Core ticket context for planning and validation |
| `## Description` | Primary source of requirements |
| `## Acceptance Criteria` | Definition-of-done source, including extracted AC when present |
| `## Comments` | Decisions, clarifications, and implementation hints |
| `## Subtasks` | Existing Jira execution breakdown |
| `## Linked Issues` | Dependency and surrounding context |
| `## Attachments` | File-level reference metadata |
| `## Custom Fields` | Non-standard fields that may carry requirements |

## Workflow Overview

```text
1. Read the retriever subagent definition
2. Dispatch the subagent with JIRA_URL
3. Keep only the structured summary it returns
4. Report the file path, counts, and warnings to the caller
```

## Subagent Registry

Read a subagent definition only when you are about to dispatch it.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `ticket-retriever` | `./subagents/ticket-retriever.md` | Reads Jira data, writes `docs/<KEY>.md`, validates the artifact, and returns a concise fetch summary |

## How This Skill Works

This skill is intentionally narrow. It coordinates retrieval, not Jira
mutation, planning, or execution. Keep only:

- The ticket key or URL needed for the next phase
- The file path written
- Counts and warnings from the retriever summary
- Any fatal reason that requires user action

This coordinator may do four things directly: read its bundled skill files,
derive identifiers from the Jira URL, dispatch the retriever, and relay the
retriever's structured summary. Everything else stays inside the subagent.

### 1. Dispatch the retriever

Read `./subagents/ticket-retriever.md`, then dispatch it with:

- `JIRA_URL`

The subagent owns input validation, Jira-capable MCP tool discovery, ticket
and relationship retrieval, document assembly, output validation, and cleanup.

### 2. Interpret the structured result

The retriever returns a summary with these top-level fields:

- `FETCH: PASS` -> retrieval and validation succeeded
- `FETCH: PARTIAL` -> artifact was written and validated, but some related data
  could not be retrieved
- `FETCH: FAIL` -> deterministic failure such as bad input, ticket not found,
  missing auth, rate limits after retry, or no usable Jira tools
- `FETCH: ERROR` -> unexpected tool or environment failure

Validation is reported separately:

- `Validation: PASS` -> the written file satisfies the template contract
- `Validation: FAIL` -> the file was written but still violates the contract
- `Validation: NOT_RUN` -> retrieval failed before validation could happen

Handle them this way:

- `FETCH: PASS` with `Validation: PASS`: report success and continue
- `FETCH: PARTIAL` with `Validation: PASS`: report success with warnings and
  make the incompleteness visible
- `FETCH: FAIL`: stop and relay the reason
- `FETCH: ERROR`: stop and relay the reason as an unexpected failure
- `Validation: FAIL`: stop and relay that the snapshot contract was not met
- Any inconsistent pairing, such as `FETCH: PASS` with `Validation: NOT_RUN`:
  treat it as `FETCH: ERROR` and stop

### 3. Report only the summary

Using only the subagent's structured summary, tell the caller:

- The file path written, when one exists
- The ticket title, status, and type
- Parent comment count
- Retrieved versus discovered counts for subtasks and linked issues
- Attachment count
- Any warnings or fatal reason
- That this phase is retrieval only and does not modify Jira

## Example

<example>
Input: `JIRA_URL=https://vukaheavyindustries.atlassian.net/browse/JNS-6065`

1. Read `./subagents/ticket-retriever.md`
2. Dispatch `ticket-retriever` with `JIRA_URL`
3. Subagent returns:

   FETCH: PASS
   Validation: PASS
   File written: docs/JNS-6065.md
   Ticket: JNS-6065: Implement dark mode toggle
   Status: In Progress | Type: Story
   Parent comments: 4
   Subtasks: 3/3
   Linked issues: 1/1
   Attachments: 2
   Warnings: None
   Reason: None

4. Report:
   "Ticket fetched to `docs/JNS-6065.md`.
   `JNS-6065: Implement dark mode toggle` is `In Progress` (`Story`).
   Retrieved 4 parent comments, 3/3 subtasks, 1/1 linked issues, and 2
   attachments. Retrieval only; Jira was not modified."
</example>
