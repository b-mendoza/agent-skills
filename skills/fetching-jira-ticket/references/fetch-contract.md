# Fetch Contract

> Load this file when interpreting the retriever summary, formatting the final
> coordinator report, or checking the artifact contract. Keep raw Jira payloads
> inside the retriever.

## Summary Semantics

| Field | Meaning |
| ----- | ------- |
| `FETCH: PASS` | Retrieval and validation succeeded with no known gaps |
| `FETCH: PARTIAL` | A valid artifact was written, but comments, related items, or discovery are incomplete |
| `FETCH: FAIL` | Deterministic blocker such as bad input, not found, auth, missing tools, or rate limit |
| `FETCH: ERROR` | Unexpected tool, schema, environment, or validation failure |
| `Validation: PASS` | Written artifact satisfies the template contract |
| `Validation: FAIL` | Artifact was written but still violates the contract after repair attempts |
| `Validation: NOT_RUN` | Retrieval stopped before document assembly or validation |

Failure categories: `NONE`, `BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`,
`RATE_LIMIT`, `UNEXPECTED`.

## Count Rules

- `0/0` means the retriever verified that no entries exist in that section.
- `<retrieved>/UNKNOWN` means the parent ticket was retrieved but discovery for
  that section could not be verified; this is `FETCH: PARTIAL`.
- `N/A` for `Comments`, `Subtasks`, `Linked issues`, or `Attachments` means the
  parent ticket was not retrieved and those downstream reads did not run.
- `Attachments: <N>` counts metadata rows rendered under `## Attachments`; the
  retriever does not download binaries.

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

The document must contain every top-level heading from
`./references/ticket-snapshot-template.md`. Repeated nested headings appear only
when the parent section has material or a required `Not retrieved` placeholder.
Use `_None_` only for verified empty sections. Use the template's `_Unknown..._`
markers when subtask or linked-issue discovery cannot be verified after the
parent ticket was retrieved.

Locked top-level order:

| Section | Purpose |
| ------- | ------- |
| `## Metadata` | Core tracker identity and context |
| `## Description` | Normalized requirements source |
| `## Acceptance Criteria` | Definition-of-done material, extracted when present |
| `## Comments` | Decisions, clarifications, and implementation hints |
| `## Retrieval Warnings` | Stable disclosure for partial retrieval |
| `## Subtasks` | Jira work-breakdown slot |
| `## Linked Issues` | Dependencies and surrounding context |
| `## Attachments` | File metadata, not binary content |
| `## Custom Fields` | Non-standard fields that may carry requirements |

The preamble includes `Retrieved on`, `Source: <JIRA_URL>`, and
`Workspace: <workspace> | Project: <project> | Ticket: <TICKET_KEY>`.

## Coordinator Reports

For `PASS` or `PARTIAL`, report the file path, ticket identity, status/type,
comment count, subtask count, linked-issue count, attachment count, warnings,
and that Jira was not modified. For `FAIL`, `ERROR`, or `Validation: FAIL`,
report the failure category and reason without inspecting raw payloads.

<example>
Ticket fetched to `docs/JNS-6065.md`. `JNS-6065: Implement dark mode toggle` is
`In Progress` (`Story`). Retrieved 4/4 comments, 3/3 subtasks, 1/1 linked
issues, and 2 attachments. Retrieval only; Jira was not modified.
</example>

<example>
Ticket fetched to `docs/JNS-7001.md` with retrieval warnings. `JNS-7001: Audit
webhook retries` is `To Do` (`Task`). Retrieved 2/2 comments, 1/2 subtasks,
0/0 linked issues, and 0 attachments. Warning: Could not retrieve JNS-7002
(404 Not Found). Retrieval only; Jira was not modified.
</example>
