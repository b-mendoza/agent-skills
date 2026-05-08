# Jira Retrieval Playbook

> Load this file inside `ticket-retriever` before Jira reads. Use external URLs
> from `external-sources.md` only when exact current API or tool syntax matters.

## Read Path Setup

Map the available environment to these operations before reading data:

| Operation | Required capability |
| --------- | ------------------- |
| Parent issue | Read one Jira issue by key with fields and relationships |
| Comments | Read parent and related-item comments, inline or by endpoint, with pagination |
| Related issues | Retrieve subtasks and linked issues by key, parent relationship fields, or verified search/query |
| Metadata | Resolve field names, attachment metadata, and custom fields without downloading binaries |

Choose deterministic read tools: prefer the most specific read-only tool, then
the schema that most directly matches Jira issue/comment/search semantics, then
keep the mapping stable for the run. Complete available authentication once
before the first Jira read. Return `AUTH` when access is denied or auth cannot be
completed, and `TOOLS_MISSING` when no Jira-capable read path can cover the
required operations.

## Parent Ticket Retrieval

Capture relevant non-empty parent data:

- Key and summary.
- Status, resolution, issue type, priority.
- Assignee and reporter.
- Labels, components, sprint, epic, fix versions, affects versions.
- Created, updated, and due dates.
- Full description with useful lists, links, tables, and code fences preserved.
- Acceptance criteria from a dedicated field when present, otherwise from the
  description using the precedence in **Acceptance Criteria Extraction**.
- Parent comments in chronological order with author and timestamp.
- Attachment metadata: filename, media type, and size.
- Non-empty custom fields not represented elsewhere, sorted by field name.

Rewrite Jira-authored Markdown heading lines outside fenced code blocks as bold
labels so body content cannot collide with reserved snapshot headings. Example:
`## Steps` becomes `**Steps**`.

Serialize multi-value metadata and custom-field values as comma-separated strings
sorted alphabetically by display text. If a custom-field value remains structured
after flattening, serialize compact JSON with object keys sorted alphabetically.

## Acceptance Criteria Extraction

Use the dedicated Jira acceptance-criteria field when present. If that field is
empty, inspect the description in this precedence order:

1. `Acceptance Criteria`
2. `AC`
3. `Definition of Done` or `Definition of Done (DoD)`

Use only sections with the highest-precedence label present. If multiple
sections share that label, keep them in source order and prefix each block with
`**Source:** <label>`. Remove the winning blocks from `## Description`. If no
criteria exist, write `_None_` under `## Acceptance Criteria` and keep the full
description under `## Description`.

## Relationships

Determine discovered totals for subtasks and linked issues before claiming full
success. Use `0/0` only when the parent issue or a verified query proves the
section is empty. If discovery cannot be verified after the parent ticket was
retrieved, render the template's unknown marker, add the same warning under
`## Retrieval Warnings`, report `<retrieved>/UNKNOWN`, and return
`FETCH: PARTIAL`.

For each discovered subtask or linked issue, retrieve enough context to render:

- Key, summary, status, assignee, and type.
- Full description with formatting preserved and heading lines rewritten.
- Comments in chronological order, with partial comment gaps made visible.
- Link type for linked issues, such as `blocks`, `is blocked by`, or `relates`.

If one related item cannot be hydrated, continue with the others, add a warning,
and render the matching `Not retrieved` placeholder from the template. Order
subtasks by key, linked issues by link type then key, attachments by filename,
and custom fields by field name.

## Partial Comment Retrieval

When comment retrieval is partial after the parent or related item is known,
keep retrieved comments, append
`_Partial comment retrieval: <retrieved>/<found>. Reason: <reason>_` to that
comment section, record the same warning under `## Retrieval Warnings`, and
return `FETCH: PARTIAL`.

## Assembly

Read `./references/ticket-snapshot-template.md` only at assembly time. Copy the
fenced Markdown shape into `docs/<TICKET_KEY>.md` and fill it from retrieved
data. Top-level headings are always required. For empty scalar metadata values,
write `_None_`. Normalize timestamps with times to `YYYY-MM-DD HH:MM UTC`; keep
date-only values as `YYYY-MM-DD`. Leave the artifact in place and unstaged.

## Validation Gate

After writing, re-read the artifact and verify:

- Every required top-level heading exists in template order.
- The title is `# <TICKET_KEY>: <Summary>`.
- The preamble includes `Retrieved on`, `Source`, and workspace/project/ticket.
- The metadata table includes required rows in template order.
- `## Description` and `## Acceptance Criteria` follow the extraction rules.
- Parent comment count matches retrieved parent comments.
- Subtask and linked-issue sections match discovered identities, placeholders,
  or unknown markers.
- Partial comment warnings have matching terminal markers in comment sections.
- Each unretrieved related item has both a warning and placeholder.
- Heading-like body lines outside fenced code blocks were rewritten as bold
  labels.
- Attachment and custom-field sections are `_None_` or valid tables.
- Repeated sections follow deterministic ordering.

If validation fails, fix only missing or mismatched portions, rewrite, and
re-check. Use at most 3 repair passes. After the limit, return `FETCH: ERROR`,
`Validation: FAIL`, and `Failure category: UNEXPECTED`.
