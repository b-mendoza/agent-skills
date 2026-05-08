# Fetch Contract

> Load this file when interpreting the retriever summary, formatting the
> coordinator report, or checking the artifact contract. Keep raw GitHub
> payloads inside the retriever.

## Contents

- Summary semantics
- Count rules
- Locked summary line order
- Retriever summary examples
- Artifact contract
- Coordinator report phrasing

## Summary Semantics

| Field | Meaning |
| ----- | ------- |
| `FETCH: PASS` | Retrieval and validation succeeded with no known gaps |
| `FETCH: PARTIAL` | A valid artifact was written, but comments, related items, project membership, or discovery are incomplete |
| `FETCH: FAIL` | Deterministic blocker: bad input, not found, auth, missing tools, or rate limit |
| `FETCH: ERROR` | Unexpected tool, schema, environment, or validation failure |
| `Validation: PASS` | Written artifact satisfies the template contract |
| `Validation: FAIL` | Artifact violates the contract after repair attempts |
| `Validation: NOT_RUN` | Retrieval stopped before assembly or validation |

Failure categories: `NONE`, `BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`,
`RATE_LIMIT`, `UNEXPECTED`.

## Count Rules

- `0/0` — verified empty section.
- `<retrieved>/UNKNOWN` — parent issue retrieved, but discovery for that
  section could not be verified; classify the run as `FETCH: PARTIAL`.
- `N/A` — parent issue was not retrieved, so downstream reads did not run.
- `Attachments: <N>` counts explicit upload or binary asset references in
  issue or comment bodies; binaries are not downloaded.

## Locked Summary Line Order

```text
FETCH: <PASS | PARTIAL | FAIL | ERROR>
Validation: <PASS | FAIL | NOT_RUN>
Failure category: <NONE | BAD_INPUT | NOT_FOUND | AUTH | TOOLS_MISSING | RATE_LIMIT | UNEXPECTED>
File written: <docs/<ISSUE_SLUG>.md | None>
Issue: <owner>/<repo>#<N>: <Title | Unknown>
State: <OPEN | CLOSED | Unknown>
Comments: <retrieved>/<found | N/A>
Child issues: <retrieved>/<found | UNKNOWN | N/A>
Linked issues: <retrieved>/<found | UNKNOWN | N/A>
Attachments: <N | N/A>
Warnings: <None | semicolon-separated warnings>
Reason: <None | fatal reason>
```

## Retriever Summary Examples

Use these examples only when assembling or checking the final retriever
summary. They are not coordinator report text.

<example>
FETCH: PASS
Validation: PASS
Failure category: NONE
File written: docs/acme-app-42.md
Issue: acme/app#42: Implement dark mode toggle
State: OPEN
Comments: 4/4
Child issues: 0/0
Linked issues: 1/1
Attachments: 0
Warnings: None
Reason: None
</example>

<example>
FETCH: FAIL
Validation: NOT_RUN
Failure category: NOT_FOUND
File written: None
Issue: acme/app#892: Unknown
State: Unknown
Comments: N/A
Child issues: N/A
Linked issues: N/A
Attachments: N/A
Warnings: None
Reason: GitHub issue acme/app#892 was not found (404)
</example>

## Artifact Contract

Primary artifact: `docs/<ISSUE_SLUG>.md`.

Required top-level headings, in order:

| Section | Purpose |
| ------- | ------- |
| `## Metadata` | Tracker identity and context |
| `## Description` | Normalized requirements source |
| `## Acceptance Criteria` | Definition-of-done material when present |
| `## Comments` | Decisions, clarifications, implementation hints |
| `## Retrieval Warnings` | Stable disclosure for partial retrieval |
| `## Child Issues` | GitHub work-breakdown slot |
| `## Linked Issues` | Dependencies and surrounding context |
| `## Labels` | Scoped classification |
| `## Assignees` | Ownership |
| `## Milestone` | Release or iteration bucket |
| `## Projects` | Project membership or explicit unknown marker |
| `## Attachments` | Explicit asset links, not binary content |

The preamble includes `Retrieved on`, `Source: <ISSUE_URL or owner/repo#N>`,
and `Repository: <owner>/<repo> | Issue: #<N>`. Repeated nested headings
appear only when the section has material or a required `Not retrieved`
placeholder. Use `_None_` for verified empty sections; use the template's
`_Unknown..._` markers when child-issue, linked-issue, or project discovery
is unverified after the parent issue was retrieved. The full snapshot shape
lives in `./issue-snapshot-template.md`.

## Coordinator Report Phrasing

For `PASS` or `PARTIAL`, report the file path, issue identity, state,
comment count, child-issue count, linked-issue count, attachment count,
warnings, and that GitHub was not modified. For `FAIL`, `ERROR`, or
`Validation: FAIL`, report the failure category and reason without
inspecting raw payloads.

<example>
Issue fetched to `docs/acme-app-42.md`. `acme/app#42: Implement dark mode
toggle` is `OPEN`. Retrieved 4/4 comments, 0/0 child issues, 1/1 linked
issues, and 0 attachments. Retrieval only; GitHub was not modified.
</example>

<example>
Issue fetched to `docs/acme-app-7001.md` with retrieval warnings.
`acme/app#7001: Audit webhook retries` is `OPEN`. Retrieved 2/2 comments,
0/UNKNOWN child issues, 1/1 linked issues, and 0 attachments. Warning: Child
issue discovery unavailable: sub_issues endpoint unsupported on this host.
Retrieval only; GitHub was not modified.
</example>
