> Read this file only during document assembly. Copy only the fenced Markdown
> shape into the artifact; the explanatory notes outside the fence are
> instructions for the retriever, not output content.

# Ticket Snapshot Template

Write the snapshot using the structure below. The Markdown block is the literal
artifact shape. The notes after it explain how to fill conditional sections;
do not copy those explanatory notes into the final snapshot.

Every top-level heading in the Markdown block is always required. Repeated
nested headings are example shapes for items that actually exist.

If a section has no data, keep the top-level heading and write `_None_`
beneath it instead of omitting the section. For empty scalar values in
`## Metadata`, write `_None_` in the `Value` column.

Use tables only when there is at least one row to show. If there is no data
for `## Attachments` or `## Custom Fields`, write `_None_` under the heading
instead of an empty table.

Normalize timestamps with time to `YYYY-MM-DD HH:MM UTC`. Preserve date-only
values, such as Jira due dates without a time component, as `YYYY-MM-DD`.

```markdown
# <TICKET_KEY>: <Summary>

> Retrieved on: <YYYY-MM-DD HH:MM UTC>
> Source: <JIRA_URL>

## Metadata

| Field           | Value |
| --------------- | ----- |
| Ticket Key      | …     |
| Workspace       | …     |
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

## Description

<full description body after acceptance-criteria extraction — preserve lists, links, tables, and code fences; rewrite Jira-authored heading lines as bold labels; or _None_ if Jira has no description or the body is empty after extraction>

## Acceptance Criteria

<acceptance criteria body using the dedicated field when present; otherwise description sections in precedence order; or _None_>

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

<body>

#### Comments

##### Comment 1 — <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

## Linked Issues

### <LINK_TYPE>: <ISSUE_KEY> — <Summary>

- **Status:** …
- **Assignee:** …
- **Type:** …

#### Description

<body>

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
  retrieval: <retrieved>/<found>. Reason: <reason>_` under `## Comments`.
- If retrieval completed without warnings, write `_None_` under
  `## Retrieval Warnings`.
- If there are no subtasks at all, write `_None_` under `## Subtasks`.
- If there are no linked issues at all, write `_None_` under `## Linked Issues`.
- If a subtask or linked issue has no comments, write `_None_` under its
  `#### Comments` heading.
- If a subtask or linked issue has partial comment retrieval after the item is
  known, keep the retrieved comments in chronological order, then append
  `_Partial comment retrieval: <retrieved>/<found>. Reason: <reason>_` under
  that item's `#### Comments`.
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
  that field is empty, inspect description sections in this precedence order:
  `Acceptance Criteria`, `AC`, `Definition of Done` or
  `Definition of Done (DoD)`. Use only sections with the highest-precedence
  label that is present. If multiple sections share that winning label, keep
  them in source order and label each block with `**Source:** <label>`. If
  none exist, write `_None_` under `## Acceptance Criteria` and keep the full
  body under `## Description`.
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
