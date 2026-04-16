> Read this file only during document assembly. Copy only the fenced Markdown
> shape into the artifact; the explanatory notes outside the fence are
> instructions for the retriever, not output content.

# Ticket Snapshot Template

Write the snapshot using the structure below. The Markdown block is the literal
artifact shape. The notes after it explain how to fill conditional sections;
do not copy those explanatory notes into the final snapshot.

Every top-level heading in the Markdown block is always required. Repeated
nested headings are example shapes for items that actually exist.

If a section has no data and that absence was verified, keep the top-level
heading and write `_None_` beneath it instead of omitting the section. If the
retriever could not verify whether `## Subtasks` or `## Linked Issues` are empty
because discovery or capability was unavailable after the parent ticket was
retrieved, use the `_Unknown. ..._` markers described in **Conditional Rules**
instead of `_None_`. For empty scalar values in `## Metadata`, write `_None_`
in the `Value` column.

The paired tracker-fetching templates share the same locked core section order:
`## Metadata`, `## Description`, `## Acceptance Criteria`, `## Comments`,
`## Retrieval Warnings`, the tracker-specific work-breakdown section, and
`## Linked Issues`. Platform-extension sections follow after that locked core.

Use tables only when there is at least one row to show. If there is no data
for `## Attachments` or `## Custom Fields`, write `_None_` under the heading
instead of an empty table.

**`## Subtasks` and `## Linked Issues`:** Subtask keys and linked-issue
identities normally come from the **retrieved parent ticket's** relationship
fields (or reads keyed off that parent). `_None_` means verified empty—the
parent (or a verified query) reported no such relationships. If subtask or
linked-issue discovery cannot be verified after the parent was retrieved, write
`_Unknown. Subtask discovery unavailable: <reason>_` or
`_Unknown. Linked issue discovery unavailable: <reason>_` under the affected
section, record the same warning under `## Retrieval Warnings`, and treat the
run as `FETCH: PARTIAL`. When identities are known but a related item cannot be
hydrated, use the missing-item placeholder shapes under **Conditional Rules**;
partial runs are `FETCH: PARTIAL` with warnings.

Normalize timestamps that include a time component to `YYYY-MM-DD HH:MM UTC`.
Preserve date-only values, such as Jira due dates without a time component, as
`YYYY-MM-DD`.

```markdown
# <TICKET_KEY>: <Summary>

> Retrieved on: <YYYY-MM-DD HH:MM UTC>
> Source: <JIRA_URL>
> Workspace: <workspace> | Project: <project> | Ticket: <TICKET_KEY>

## Metadata

| Field           | Value |
| --------------- | ----- |
| Ticket Key      | …     |
| Workspace       | …     |
| Project         | …     |
| Status          | …     |
| Resolution      | …     |
| Type            | …     |
| Priority        | …     |
| Assignee        | …     |
| Reporter        | …     |
| Labels          | …     |
| Components      | …     |
| Sprint          | …     |
| Epic            | …     |
| Fix Version     | …     |
| Affects Version | …     |
| Created         | …     |
| Updated         | …     |
| Due Date        | …     |
| URL             | …     |

## Description

<full description body after acceptance-criteria extraction — preserve lists, links, tables, and code fences; rewrite Jira-authored heading lines as bold labels; or _None_ if Jira has no description or the body is empty after extraction>

## Acceptance Criteria

<acceptance criteria: dedicated Jira field when present; otherwise description body sections per precedence and extraction rules below; or _None_>

## Comments

### Comment 1 — <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

### Comment 2 — …

## Retrieval Warnings

- <warning text>

## Subtasks

### <SUBTASK_KEY>: <Summary>

- **Status:** …
- **Assignee:** …
- **Type:** …

#### Description

<body or _None_>

#### Comments

##### Comment 1 — <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

## Linked Issues

### <LINK_TYPE>: <ISSUE_KEY> — <Summary>

- **Status:** …
- **Assignee:** …
- **Type:** …

#### Description

<body or _None_>

#### Comments

##### Comment 1 — <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

## Attachments

| Filename | Type | Size |
| -------- | ---- | ---- |
| …        | …    | …    |

## Custom Fields

| Field Name | Value |
| ---------- | ----- |
| …          | …     |
```

## Conditional Rules

- If there are no parent comments, write `_None_` under `## Comments`.
- If parent-comment retrieval is partial after the ticket is known, keep the
  retrieved comments in chronological order, then append `_Partial comment
  retrieval: <retrieved>/<found>. Reason: <reason>_` under `## Comments`,
  record the same warning under `## Retrieval Warnings`, and treat the run
  as `FETCH: PARTIAL`.
- If retrieval completed without warnings, write `_None_` under
  `## Retrieval Warnings`.
- If there are no subtasks discovered and that absence was verified, write
  `_None_` under `## Subtasks`.
- If subtask discovery could not be verified after the parent ticket was
  retrieved, write `_Unknown. Subtask discovery unavailable: <reason>_` under
  `## Subtasks`, record the same warning under `## Retrieval Warnings`, and
  treat the run as `FETCH: PARTIAL`.
- If there are no linked issues discovered and that absence was verified, write
  `_None_` under `## Linked Issues`.
- If linked-issue discovery could not be verified after the parent ticket was
  retrieved, write `_Unknown. Linked issue discovery unavailable: <reason>_`
  under `## Linked Issues`, record the same warning under
  `## Retrieval Warnings`, and treat the run as `FETCH: PARTIAL`.
- If a subtask or linked issue has no comments, write `_None_` under its
  `#### Comments` heading.
- If a subtask or linked issue has partial comment retrieval after the item is
  known, keep the retrieved comments in chronological order, then append
  `_Partial comment retrieval: <retrieved>/<found>. Reason: <reason>_` under
  that item's `#### Comments`, and record the same warning under
  `## Retrieval Warnings`.
- If a retrieved subtask or linked issue has no description, write `_None_`
  under its `#### Description` heading.
- If related-item retrieval is partial, record each warning under
  `## Retrieval Warnings` and include a placeholder entry for every unretrieved
  subtask or linked issue in its respective section.
- In Jira-authored description and comment bodies, preserve useful formatting
  such as lists, links, tables, and code fences. Outside fenced code blocks,
  rewrite Markdown heading lines as bold labels so Jira-authored body content
  cannot collide with reserved snapshot headings. Example: `## Steps` becomes
  `**Steps**`.
- In `## Acceptance Criteria`, use the dedicated Jira field when present. If
  that field is empty, use this precedence on the **description** (after
  stripping winning AC blocks from `## Description`):
  1. A section titled `Acceptance Criteria`
  2. Otherwise `AC`
  3. Otherwise `Definition of Done` or `Definition of Done (DoD)`
  Use only sections with the highest-precedence label that is present. If
  multiple sections share that label, keep them in source order and prefix each
  block with `**Source:** <label>`. If none exist, write `_None_` under
  `## Acceptance Criteria` and keep the full body under `## Description`.
- In `## Custom Fields`, include every non-empty custom field that is not
  already represented in `## Metadata`, `## Acceptance Criteria`, or another
  dedicated section. Sort rows alphabetically by field name.
- Order repeated sections deterministically:
  subtasks by ticket key ascending; linked issues by link type, then ticket key
  ascending; attachments by filename ascending.
- Serialize multi-value metadata or custom-field values as comma-separated
  strings sorted alphabetically by display text. If a custom-field value is
  still structured after flattening, serialize it as compact JSON with object
  keys sorted alphabetically.

### Missing Subtask Placeholder

```markdown
### <SUBTASK_KEY>: Not retrieved

- **Status:** Unknown
- **Assignee:** Unknown
- **Type:** Unknown
- **Retrieval Status:** Not retrieved
- **Reason:** <reason>

#### Description

_None_

#### Comments

_None_
```

### Missing Linked Issue Placeholder

```markdown
### <LINK_TYPE>: <ISSUE_KEY> — Not retrieved

- **Status:** Unknown
- **Assignee:** Unknown
- **Type:** Unknown
- **Retrieval Status:** Not retrieved
- **Reason:** <reason>

#### Description

_None_

#### Comments

_None_
```
