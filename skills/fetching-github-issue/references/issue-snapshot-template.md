> Read this file only during document assembly. Copy only the fenced Markdown
> shape into the artifact; explanatory notes outside the fence are retriever
> instructions, not output content.

# Issue Snapshot Template

Write the snapshot using the structure below. Every top-level heading in the
Markdown block is required. Repeated nested headings are shapes for items that
exist or required `Not retrieved` placeholders.

If a section has no data and that absence was verified, keep the heading and
write `_None_`. If the retriever could not verify whether `## Child Issues`,
`## Linked Issues`, or `## Projects` are empty after the parent issue was
retrieved, use the `_Unknown..._` markers in **Conditional Rules** instead of
`_None_`.

```markdown
# <ISSUE_SLUG>: <Issue title>

> Retrieved on: <YYYY-MM-DD HH:MM UTC>
> Source: <ISSUE_URL or owner/repo#N>
> Repository: <owner>/<repo> | Issue: #<N>

## Metadata

| Field | Value |
| ----- | ----- |
| ISSUE_SLUG | ... |
| Repository | ... |
| Issue number | ... |
| State | ... |
| Author | ... |
| Created | ... |
| Updated | ... |
| Closed | ... |
| URL | ... |

## Description

<full issue body after acceptance-criteria extraction, or _None_>

## Acceptance Criteria

<acceptance criteria, or _None_>

## Comments

### Comment 1 - <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

### Comment 2 - ...

## Retrieval Warnings

- <warning text>

## Child Issues

### <owner>/<repo>#<N>: <Title>

- **State:** ...
- **URL:** ...

#### Description

<body or _None_>

#### Comments

##### Comment 1 - <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

## Linked Issues

### <RELATION_OR_CONTEXT>: <owner>/<repo>#<N> - <Title>

- **State:** ...
- **URL:** ...

#### Description

<body or _None_>

#### Comments

##### Comment 1 - <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

## Labels

| Name | Description |
| ---- | ----------- |
| ...  | ...         |

## Assignees

| Login | Name or _None_ |
| ----- | -------------- |
| ...   | ...            |

## Milestone

<title and due date if any, or _None_>

## Projects

<table, bullet list of project membership, _Unknown. Project membership not determined: <reason>_, or _None_ when absence was verified>

## Attachments

_None_ or a short bullet list of explicitly linked upload or binary asset URLs found in issue or comment bodies.
```

## Conditional Rules

- If there are no parent comments, write `_None_` under `## Comments`.
- If retrieval completed without warnings, write `_None_` under
  `## Retrieval Warnings`.
- If there are no verified child issues, write `_None_` under
  `## Child Issues`.
- If child-issue discovery could not be verified, write
  `_Unknown. Child issue discovery unavailable: <reason>_` under
  `## Child Issues` and record the same warning under `## Retrieval Warnings`.
- If there are no verified linked issues, write `_None_` under
  `## Linked Issues`.
- If linked-issue discovery could not be verified, write
  `_Unknown. Linked issue discovery unavailable: <reason>_` under
  `## Linked Issues` and record the same warning under `## Retrieval Warnings`.
- If project membership cannot be determined, write
  `_Unknown. Project membership not determined: <reason>_` under `## Projects`
  and record the same warning under `## Retrieval Warnings`.
- If a child or linked issue has no comments, write `_None_` under its
  `#### Comments` heading.
- If a retrieved child or linked issue has no description, write `_None_` under
  its `#### Description` heading.
- Use tables for `## Labels` and `## Assignees` only when at least one row
  exists; otherwise write `_None_`.

### Missing Child Issue Placeholder

```markdown
### <owner>/<repo>#<N>: Not retrieved

- **State:** Unknown
- **URL:** _None_
- **Retrieval Status:** Not retrieved
- **Reason:** <reason>

#### Description

_None_

#### Comments

_None_
```

### Missing Linked Issue Placeholder

```markdown
### <RELATION_OR_CONTEXT>: <owner>/<repo>#<N> - Not retrieved

- **State:** Unknown
- **URL:** _None_
- **Retrieval Status:** Not retrieved
- **Reason:** <reason>

#### Description

_None_

#### Comments

_None_
```
