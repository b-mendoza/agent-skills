# Jira Retrieval Playbook

> Load this file inside `ticket-retriever` before Jira reads. Use external
> URLs from `external-sources.md` only when exact API or tool syntax matters.
> The orchestrator does not load this file.

## Contents

- Read path setup
- Capture rules
- Acceptance criteria precedence
- Relationships
- Partial comment retrieval
- Assembly
- Validation gate
- Rate limiting

## Read Path Setup

Map the environment to these operations before reading data. Prefer the most
specific read-only tool, then the schema closest to Jira issue/comment/search
semantics, then keep the mapping stable for the run.

| Operation | Required capability |
| --------- | ------------------- |
| Parent issue | Read one Jira issue by key with fields and relationships |
| Comments | Read parent and related-item comments with pagination |
| Related issues | Retrieve subtasks and linked issues by key, parent fields, or verified search/query |
| Metadata | Resolve field names, attachment metadata, and custom fields without downloading binaries |

Complete authentication once before the first read. Return `AUTH` when access
is denied or auth cannot be completed; `TOOLS_MISSING` when no Jira-capable
read path covers the required operations. For exact REST shapes, auth, and
pagination, fetch `jira-rest-intro`, `jira-get-issue`, or `jira-comments` from
`external-sources.md` only when the current decision needs them.

## Capture Rules

**Parent ticket.** Capture all non-empty values among: key, summary; status,
resolution, type, priority; assignee, reporter; labels, components, sprint,
epic, fix versions, affects versions; created, updated, due dates; full
description with formatting preserved; acceptance criteria (see precedence);
parent comments in chronological order with author and timestamp; attachment
metadata (filename, media type, size); non-empty custom fields not represented
elsewhere, sorted by field name.

**Heading rewrite.** Outside fenced code blocks, rewrite Jira-authored ATX
Markdown headings (`#`-`######`) as bold labels so body content cannot collide
with reserved snapshot headings. Example: `## Steps` becomes `**Steps**`.

**Multi-value flattening.** Serialize arrays as comma-separated strings sorted
alphabetically by display text. If a custom-field value remains structured
after flattening, serialize compact JSON with object keys sorted
alphabetically. For Atlassian rich-text fields, fetch `jira-adf` from
`external-sources.md` only when normalization is unclear.

## Acceptance Criteria Precedence

1. Use the dedicated Jira acceptance-criteria field when present and non-empty.
2. Otherwise scan the description in this label order: `Acceptance Criteria`,
   then `AC`, then `Definition of Done` or `Definition of Done (DoD)`.
3. Use only sections matching the highest-precedence label found. If multiple
   sections share that label, keep them in source order, prefix each block
   with `**Source:** <label>`, and remove the winning blocks from
   `## Description`.
4. If no criteria exist, write `_None_` under `## Acceptance Criteria` and
   keep the full description under `## Description`.

## Relationships

Determine totals before claiming full success. Use `0/0` only when the parent
issue or a verified query proves the section is empty. If discovery cannot be
verified after the parent ticket was retrieved, render the template's unknown
marker, add the same warning under `## Retrieval Warnings`, report
`<retrieved>/UNKNOWN`, and return `FETCH: PARTIAL`.

For each retrieved subtask or linked issue, capture: key, summary, status,
assignee, type, full description (with heading rewrite), comments in
chronological order, and link type for linked issues (e.g., `blocks`,
`is blocked by`, `relates`).

If one related item cannot be hydrated, continue with the others, add a
warning, and render the matching `Not retrieved` placeholder. Order subtasks
by key, linked issues by link type then key, attachments by filename, and
custom fields by field name.

## Partial Comment Retrieval

When parent or related-item comments are partial, keep retrieved comments,
append `_Partial comment retrieval: <retrieved>/<found>. Reason: <reason>_`
to that comment section, record the same warning under
`## Retrieval Warnings`, and return `FETCH: PARTIAL`.

## Assembly

Read `./ticket-snapshot-template.md` only at assembly time. Before filling the
template, normalize all retrieved Markdown body content by rewriting
Jira-authored ATX headings (`#`-`######`) outside fenced code blocks as bold
labels. Copy the fenced shape into `docs/<TICKET_KEY>.md` and fill it from
retrieved data. Top-level headings are always required. For empty scalar
metadata values, write `_None_`. Normalize timestamps with times to
`YYYY-MM-DD HH:MM UTC`; keep date-only values as `YYYY-MM-DD`. Leave the
artifact in place and unstaged.

## Validation Gate

After writing, re-read the artifact and verify:

- Every required top-level heading exists in template order.
- Title is `# <TICKET_KEY>: <Summary>`.
- Preamble includes `Retrieved on`, `Source`, and workspace/project/ticket.
- `## Metadata` table has the required rows in template order.
- `## Description` and `## Acceptance Criteria` follow the precedence rules.
- Parent comment count matches retrieved parent comments.
- Subtasks, linked issues, attachments, custom fields match discovered
  identities, placeholders, or unknown markers.
- Each unretrieved related item has both a warning and a placeholder.
- Heading-like body lines outside code fences were rewritten as bold labels.
- Repeated sections follow deterministic ordering.

If validation fails, fix only the missing or mismatched portions, rewrite,
and re-check. Max 3 repair passes. After the limit, return `FETCH: ERROR`,
`Validation: FAIL`, and `Failure category: UNEXPECTED`.

## Rate Limiting

For exact retry policy and limit categories, fetch `jira-rate-limits` from
`external-sources.md` when needed. When Jira returns rate-limit metadata, honor
`Retry-After` or `X-RateLimit-Reset`, preserve `RateLimit-Reason`, and retry
only while the local retry budget remains. Default behavior without explicit
timing: at most 2 retries with 1s then 3s backoff and jitter. Classify
exhausted limits as `FETCH: FAIL` with `Failure category: RATE_LIMIT`.
