# Document Template

Write the file using this structure exactly. Downstream skills parse these
headings programmatically — missing headings break the pipeline. If a section
has no data, keep the heading and write `_None_` beneath it.

```markdown
# <TICKET_KEY>: <Summary>

> Retrieved on: <YYYY-MM-DD HH:MM UTC>

## Metadata

| Field           | Value |
| --------------- | ----- |
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

<full description body — preserve original formatting>

## Acceptance Criteria

<if present, otherwise _None_>

## Comments

### Comment 1 — <Author> (<YYYY-MM-DD HH:MM>)

<body>

### Comment 2 — …

## Subtasks

### <SUBTASK_KEY>: <Summary>

- **Status:** …
- **Assignee:** …
- **Type:** …

#### Description

<body>

#### Comments

##### Comment 1 — <Author> (<date>)

<body>

### <next subtask…>

## Linked Issues

### <LINK_TYPE>: <ISSUE_KEY> — <Summary>

- **Status:** …
- **Type:** …

#### Description

<body>

#### Comments

…

## Attachments

| Filename | Type | Size |
| -------- | ---- | ---- |

## Custom Fields

| Field Name | Value |
| ---------- | ----- |
| …          | …     |
```
