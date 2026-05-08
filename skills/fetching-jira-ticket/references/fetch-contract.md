# Fetch Contract

> Load this file when interpreting the retriever summary, formatting the
> coordinator report, or checking the artifact contract. Keep raw Jira
> payloads inside the retriever.

## Summary Semantics

| Field | Meaning |
| ----- | ------- |
| `FETCH: PASS` | Retrieval and validation succeeded with no known gaps |
| `FETCH: PARTIAL` | A valid artifact was written, but comments, related items, or discovery are incomplete |
| `FETCH: FAIL` | Deterministic blocker: bad input, not found, auth, missing tools, or rate limit |
| `FETCH: ERROR` | Unexpected tool, schema, environment, or validation failure |
| `Validation: PASS` | Written artifact satisfies the template contract |
| `Validation: FAIL` | Artifact violates the contract after repair attempts |
| `Validation: NOT_RUN` | Retrieval stopped before assembly or validation |

Failure categories: `NONE`, `BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`,
`RATE_LIMIT`, `UNEXPECTED`.

## Count Rules

- `0/0` — verified empty section.
- `<retrieved>/UNKNOWN` — parent ticket retrieved, but discovery for that
  section could not be verified; classify the run as `FETCH: PARTIAL`.
- `N/A` — parent ticket was not retrieved, so downstream reads did not run.
- `Attachments: <N>` counts metadata rows only; binaries are not downloaded.

## Locked Summary Line Order

```text
FETCH: <PASS | PARTIAL | FAIL | ERROR>
Validation: <PASS | FAIL | NOT_RUN>
Failure category: <NONE | BAD_INPUT | NOT_FOUND | AUTH | TOOLS_MISSING | RATE_LIMIT | UNEXPECTED>
File written: <docs/<TICKET_KEY>.md | None>
Ticket: <TICKET_KEY>: <Summary/Title | Unknown>
Status: <status | Unknown> | Type: <type | Unknown>
Comments: <retrieved>/<found | N/A>
Subtasks: <retrieved>/<found | UNKNOWN | N/A>
Linked issues: <retrieved>/<found | UNKNOWN | N/A>
Attachments: <N | N/A>
Warnings: <None | semicolon-separated warnings>
Reason: <None | fatal reason>
```

## Artifact Contract

Primary artifact: `docs/<TICKET_KEY>.md`.

Required top-level headings, in order:

| Section | Purpose |
| ------- | ------- |
| `## Metadata` | Tracker identity and context |
| `## Description` | Normalized requirements source |
| `## Acceptance Criteria` | Definition-of-done material when present |
| `## Comments` | Decisions, clarifications, implementation hints |
| `## Retrieval Warnings` | Stable disclosure for partial retrieval |
| `## Subtasks` | Jira work-breakdown slot |
| `## Linked Issues` | Dependencies and surrounding context |
| `## Attachments` | File metadata, not binary content |
| `## Custom Fields` | Non-standard fields that may carry requirements |

The preamble includes `Retrieved on`, `Source: <JIRA_URL>`, and
`Workspace: <workspace> | Project: <project> | Ticket: <TICKET_KEY>`.
Repeated nested headings appear only when the section has material or a
required `Not retrieved` placeholder. Use `_None_` for verified empty
sections; use the template's `_Unknown..._` markers when subtask or
linked-issue discovery is unverified after the parent ticket was retrieved.
The full snapshot shape lives in `./references/ticket-snapshot-template.md`.

## Coordinator Report Phrasing

For `PASS` or `PARTIAL`, report the file path, ticket identity, status/type,
comment count, subtask count, linked-issue count, attachment count, warnings,
and that Jira was not modified. For `FAIL`, `ERROR`, or `Validation: FAIL`,
report the failure category and reason without inspecting raw payloads.

<example>
Ticket fetched to `docs/JNS-6065.md`. `JNS-6065: Implement dark mode toggle`
is `In Progress` (`Story`). Retrieved 4/4 comments, 3/3 subtasks, 1/1 linked
issues, and 2 attachments. Retrieval only; Jira was not modified.
</example>

<example>
Ticket fetched to `docs/JNS-7001.md` with retrieval warnings.
`JNS-7001: Audit webhook retries` is `To Do` (`Task`). Retrieved 2/2
comments, 1/2 subtasks, 0/0 linked issues, and 0 attachments. Warning: Could
not retrieve JNS-7002 (404 Not Found). Retrieval only; Jira was not modified.
</example>
