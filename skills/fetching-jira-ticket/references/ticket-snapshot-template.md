> Read this file only during document assembly. Copy only the fenced Markdown
> shape into the artifact; explanatory notes outside the fence are retriever
> instructions, not output content.

# Ticket Snapshot Template

Write the snapshot using the structure below. Every top-level heading in the
Markdown block is required. Repeated nested headings are shapes for items that
exist or required `Not retrieved` placeholders.

If a section has no data and that absence was verified, keep the heading and
write `_None_`. If the retriever could not verify whether `## Subtasks` or
`## Linked Issues` are empty after the parent ticket was retrieved, use the
`_Unknown..._` markers in **Conditional Rules** instead of `_None_`.

```markdown
# <TICKET_KEY>: <Summary>

> Retrieved on: <YYYY-MM-DD HH:MM UTC>
> Source: <JIRA_URL>
> Workspace: <workspace> | Project: <project> | Ticket: <TICKET_KEY>

## Metadata

| Field           | Value |
| --------------- | ----- |
| Ticket Key      | ...   |
| Workspace       | ...   |
| Project         | ...   |
| Status          | ...   |
| Resolution      | ...   |
| Type            | ...   |
| Priority        | ...   |
| Assignee        | ...   |
| Reporter        | ...   |
| Labels          | ...   |
| Components      | ...   |
| Sprint          | ...   |
| Epic            | ...   |
| Fix Version     | ...   |
| Affects Version | ...   |
| Created         | ...   |
| Updated         | ...   |
| Due Date        | ...   |
| URL             | ...   |

## Description

<full description body after acceptance-criteria extraction, or _None_>

## Acceptance Criteria

<acceptance criteria, or _None_>

## Comments

### Comment 1 - <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

### Comment 2 - ...

## Retrieval Warnings

- <warning text>

## Subtasks

### <SUBTASK_KEY>: <Summary>

- **Status:** ...
- **Assignee:** ...
- **Type:** ...

#### Description

<body or _None_>

#### Comments

##### Comment 1 - <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

## Linked Issues

### <LINK_TYPE>: <ISSUE_KEY> - <Summary>

- **Status:** ...
- **Assignee:** ...
- **Type:** ...

#### Description

<body or _None_>

#### Comments

##### Comment 1 - <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

## Attachments

| Filename | Type | Size |
| -------- | ---- | ---- |
| ...      | ...  | ...  |

## Custom Fields

| Field Name | Value |
| ---------- | ----- |
| ...        | ...   |
```

## Conditional Rules

- If there are no parent comments, write `_None_` under `## Comments`.
- If retrieval completed without warnings, write `_None_` under
  `## Retrieval Warnings`.
- If there are no verified subtasks, write `_None_` under `## Subtasks`.
- If subtask discovery could not be verified, write
  `_Unknown. Subtask discovery unavailable: <reason>_` under `## Subtasks` and
  record the same warning under `## Retrieval Warnings`.
- If there are no verified linked issues, write `_None_` under
  `## Linked Issues`.
- If linked-issue discovery could not be verified, write
  `_Unknown. Linked issue discovery unavailable: <reason>_` under
  `## Linked Issues` and record the same warning under `## Retrieval Warnings`.
- If a subtask or linked issue has no comments, write `_None_` under its
  `#### Comments` heading.
- If a retrieved subtask or linked issue has no description, write `_None_`
  under its `#### Description` heading.
- Use tables for `## Attachments` and `## Custom Fields` only when at least one
  row exists; otherwise write `_None_`.

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
### <LINK_TYPE>: <ISSUE_KEY> - Not retrieved

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
