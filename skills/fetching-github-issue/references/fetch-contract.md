# Fetch Contract

> Load this file when interpreting the retriever summary, formatting the final
> coordinator report, or checking the artifact contract. Keep raw GitHub payloads
> inside the retriever.

## Summary Semantics

| Field | Meaning |
| ----- | ------- |
| `FETCH: PASS` | Retrieval and validation succeeded with no known gaps |
| `FETCH: PARTIAL` | A valid artifact was written, but comments, related items, project membership, or discovery are incomplete |
| `FETCH: FAIL` | Deterministic blocker such as bad input, not found, auth, missing tools, or rate limit |
| `FETCH: ERROR` | Unexpected tool, schema, environment, or validation failure |
| `Validation: PASS` | Written artifact satisfies the template contract |
| `Validation: FAIL` | Artifact was written but still violates the contract after repair attempts |
| `Validation: NOT_RUN` | Retrieval stopped before document assembly or validation |

Failure categories: `NONE`, `BAD_INPUT`, `NOT_FOUND`, `AUTH`, `TOOLS_MISSING`,
`RATE_LIMIT`, `UNEXPECTED`.

## Count Rules

- `0/0` means the retriever verified that no entries exist in that section.
- `<retrieved>/UNKNOWN` means the parent issue was retrieved but discovery for
  that section could not be verified; this is `FETCH: PARTIAL`.
- `N/A` for `Comments`, `Child issues`, `Linked issues`, or `Attachments` means
  the parent issue was not retrieved and those downstream reads did not run.
- `Attachments: <N>` counts explicit upload or binary asset references rendered
  under `## Attachments`; the retriever does not download binaries.

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

## Artifact Contract

Primary artifact: `docs/<ISSUE_SLUG>.md`.

The document must contain every top-level heading from
`./references/issue-snapshot-template.md`. Repeated nested headings appear only
when the parent section has material or a required `Not retrieved` placeholder.
Use `_None_` only for verified empty sections. Use the template's `_Unknown..._`
markers when child-issue, linked-issue, or project discovery cannot be verified
after the parent issue was retrieved.

Locked top-level order:

| Section | Purpose |
| ------- | ------- |
| `## Metadata` | Core tracker identity and context |
| `## Description` | Normalized requirements source |
| `## Acceptance Criteria` | Definition-of-done material, extracted when present |
| `## Comments` | Decisions, clarifications, and implementation hints |
| `## Retrieval Warnings` | Stable disclosure for partial retrieval |
| `## Child Issues` | GitHub work-breakdown slot |
| `## Linked Issues` | Dependencies and surrounding context |
| `## Labels` | Scoped classification |
| `## Assignees` | Ownership |
| `## Milestone` | Release or iteration bucket |
| `## Projects` | Project membership or explicit unknown marker |
| `## Attachments` | Explicit asset links, not binary content |

The preamble includes `Retrieved on`, `Source: <ISSUE_URL or owner/repo#N>`, and
`Repository: <owner>/<repo> | Issue: #<N>`.

## Coordinator Reports

For `PASS` or `PARTIAL`, report the file path, issue identity, state, comment
count, child-issue count, linked-issue count, attachment count, warnings, and
that GitHub was not modified. For `FAIL`, `ERROR`, or `Validation: FAIL`, report
the failure category and reason without inspecting raw payloads.

<example>
Issue fetched to `docs/acme-app-42.md`. `acme/app#42: Implement dark mode toggle`
is `OPEN`. Retrieved 4/4 comments, 0/0 child issues, 1/1 linked issues, and 0
attachments. Retrieval only; GitHub was not modified.
</example>

<example>
Issue fetched to `docs/acme-app-7001.md` with retrieval warnings.
`acme/app#7001: Audit webhook retries` is `OPEN`. Retrieved 2/2 comments,
0/UNKNOWN child issues, 1/1 linked issues, and 0 attachments. Warning: Child
issue discovery unavailable: sub_issues endpoint unsupported on this host.
Retrieval only; GitHub was not modified.
</example>
