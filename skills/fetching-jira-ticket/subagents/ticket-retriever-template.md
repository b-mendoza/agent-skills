# Document Template

Write the snapshot using this structure exactly. Downstream skills rely on
these headings being stable. If a section has no data, keep the heading and
write `_None_` beneath it instead of omitting the section.

Use tables only when there is at least one row to show. If there is no data
for `## Attachments` or `## Custom Fields`, write `_None_` under the heading
instead of an empty table.

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

<full description body — preserve original formatting, or _None_ if Jira has no description>

## Acceptance Criteria

<acceptance criteria body, or _None_>

## Comments

### Comment 1 — <Author> (<YYYY-MM-DD HH:MM>)

<body>

### Comment 2 — …

<!-- If there are no parent comments, replace the whole section body with _None_ -->

## Subtasks

### <SUBTASK_KEY>: <Summary>

- **Status:** …
- **Assignee:** …
- **Type:** …

#### Description

<body>

#### Comments

##### Comment 1 — <Author> (<YYYY-MM-DD HH:MM>)

<body>

<!-- If a subtask has no comments, write _None_ under #### Comments -->
<!-- If there are no subtasks at all, replace the whole section body with _None_ -->

## Linked Issues

### <LINK_TYPE>: <ISSUE_KEY> — <Summary>

- **Status:** …
- **Assignee:** …
- **Type:** …

#### Description

<body>

#### Comments

##### Comment 1 — <Author> (<YYYY-MM-DD HH:MM>)

<body>

<!-- If a linked issue has no comments, write _None_ under #### Comments -->
<!-- If there are no linked issues at all, replace the whole section body with _None_ -->

## Attachments

| Filename | Type | Size |
| -------- | ---- | ---- |
| …        | …    | …    |

## Custom Fields

| Field Name | Value |
| ---------- | ----- |
| …          | …     |
```
