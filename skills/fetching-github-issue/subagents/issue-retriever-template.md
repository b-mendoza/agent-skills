> Read this file only during document assembly. Copy only the fenced Markdown
> shape into the artifact; the explanatory notes outside the fence are
> instructions for the retriever, not output content.

# Issue Snapshot Template

Write the snapshot using the structure below. The Markdown block is the literal
artifact shape. The notes after it explain how to fill conditional sections;
do not copy those explanatory notes into the final snapshot.

Every top-level heading in the Markdown block is always required. Repeated
nested headings are example shapes for items that actually exist.

If a section has no data and that absence was verified, keep the top-level
heading and write `_None_` beneath it instead of omitting the section. If the
retriever could not verify whether `## Child Issues`, `## Linked Issues`, or
`## Projects` are empty because discovery or capability was unavailable after
the parent issue was retrieved, use the `_Unknown. ..._` markers described in
**Conditional Rules** instead of `_None_`. For empty scalar values in
`## Metadata`, write `_None_` in the `Value` column.

The paired tracker-fetching templates share the same locked core section order:
`## Metadata`, `## Description`, `## Acceptance Criteria`, `## Comments`,
`## Retrieval Warnings`, the tracker-specific work-breakdown section, and
`## Linked Issues`. Platform-extension sections follow after that locked core.

**`## Child Issues`, `## Linked Issues`, and `## Projects`:** Child-issue
identities, linked-issue identities, and project membership normally come from
the **retrieved parent issue** or reads keyed from it. `_None_` means verified
empty. If child-issue discovery, linked-issue discovery, or project membership
cannot be verified after the parent issue was retrieved, write the appropriate
`_Unknown. ..._` marker under the affected section, record the same warning
under `## Retrieval Warnings`, and treat the run as `FETCH: PARTIAL`. When a
child or linked issue identity is known but that item cannot be hydrated, use
the missing-item placeholder shapes under **Conditional Rules**; partial runs
are `FETCH: PARTIAL` with warnings.

Use tables only when there is at least one row to show. If there is no data
for `## Labels` or `## Assignees`, write `_None_` under the heading instead of
an empty table.

Normalize timestamps that include a time component to `YYYY-MM-DD HH:MM UTC`.
Preserve date-only values as `YYYY-MM-DD`.

```markdown
# <ISSUE_SLUG>: <Issue title>

> Retrieved on: <YYYY-MM-DD HH:MM UTC>
> Source: <ISSUE_URL or owner/repo#N>
> Repository: <owner>/<repo> | Issue: #<N>

## Metadata

| Field | Value |
| ----- | ----- |
| ISSUE_SLUG | … |
| Repository | … |
| Issue number | … |
| State | … |
| Author | … |
| Created | … |
| Updated | … |
| Closed | … |
| URL | … |

## Description

<full issue body after acceptance-criteria extraction — preserve lists, links, tables, and code fences; rewrite GitHub-authored Markdown heading lines in body prose as bold labels so they cannot collide with reserved snapshot headings; or _None_ if the body is empty after extraction>

## Acceptance Criteria

<acceptance criteria using dedicated body sections in precedence order; or _None_>

## Comments

### Comment 1 — <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

### Comment 2 — …

## Retrieval Warnings

- <warning text>

## Child Issues

### <owner>/<repo>#<N>: <Title>

- **State:** …
- **URL:** …

#### Description

<body or _None_>

#### Comments

##### Comment 1 — <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

## Linked Issues

### <RELATION_OR_CONTEXT>: <owner>/<repo>#<N> — <Title>

- **State:** …
- **URL:** …

#### Description

<body or _None_>

#### Comments

##### Comment 1 — <Author> (<YYYY-MM-DD HH:MM UTC>)

<body>

## Labels

| Name | Description |
| ---- | ----------- |
| …    | …           |

## Assignees

| Login | Name or _None_ |
| ----- | -------------- |
| …     | …              |

## Milestone

<title and due date if any, or _None_>

## Projects

<table, bullet list of project membership, _Unknown. Project membership not determined: <reason>_, or _None_ when absence was verified>

## Attachments

_None_ or a short bullet list of explicitly linked upload or binary asset URLs found in issue or comment bodies.
```

## Conditional Rules

- If there are no parent comments, write `_None_` under `## Comments`.
- If parent-comment retrieval is partial after the issue is known, keep the retrieved
  comments in chronological order, then append
  `_Partial comment retrieval: <retrieved>/<found>. Reason: <reason>_` under
  `## Comments`, record the same warning under `## Retrieval Warnings`, and
  treat the run as `FETCH: PARTIAL`.
- If retrieval completed without warnings, write `_None_` under
  `## Retrieval Warnings`.
- If there are no child issues discovered and that absence was verified, write
  `_None_` under `## Child Issues`.
- If child-issue discovery could not be verified, write
  `_Unknown. Child issue discovery unavailable: <reason>_` under
  `## Child Issues`, record the same warning under `## Retrieval Warnings`,
  and treat the run as `FETCH: PARTIAL`.
- If there are no linked issues discovered and that absence was verified,
  write `_None_` under `## Linked Issues`.
- If linked-issue discovery could not be verified, write
  `_Unknown. Linked issue discovery unavailable: <reason>_` under
  `## Linked Issues`, record the same warning under `## Retrieval Warnings`,
  and treat the run as `FETCH: PARTIAL`.
- If a child or linked issue has no comments, write `_None_` under its
  `#### Comments` heading.
- If a child or linked issue has partial comment retrieval after the item is
  known, keep the retrieved comments in chronological order, then append
  `_Partial comment retrieval: <retrieved>/<found>. Reason: <reason>_` under
  that item's `#### Comments`, and record the same warning under
  `## Retrieval Warnings`.
- If a retrieved child or linked issue has no description, write `_None_` under
  its `#### Description` heading.
- If related-item retrieval is partial, record each warning under
  `## Retrieval Warnings` and include a placeholder entry for every unretrieved
  discovered key in its respective section.
- If project membership cannot be determined because the required capability is
  unavailable or discovery otherwise cannot be completed, write
  `_Unknown. Project membership not determined: <reason>_` under `## Projects`,
  record the same warning under `## Retrieval Warnings`, and treat the run as
  `FETCH: PARTIAL` rather than collapsing that state to `_None_`.
- In issue and comment bodies, preserve useful formatting such as lists, links,
  tables, and code fences. Outside fenced code blocks, rewrite Markdown heading
  lines as bold labels so body content cannot collide with reserved snapshot
  headings. Example: `## Steps` becomes `**Steps**`.
- In `## Acceptance Criteria`, use this precedence on the **issue body** (after
  stripping those blocks from `## Description`):
  1. A section titled `Acceptance Criteria`
  2. Otherwise `AC`
  3. Otherwise `Definition of Done` or `Definition of Done (DoD)`
  Use only sections with the highest-precedence label that is present. If
  multiple sections share that label, keep them in source order and prefix each
  block with `**Source:** <label>`. If none exist, write `_None_` under
  `## Acceptance Criteria` and keep the full body under `## Description`.
- Order repeated sections deterministically: child issues by number ascending;
  linked issues by relation/context string, then `owner/repo#N` ascending;
  labels by name ascending; assignees by login ascending.

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
### <RELATION_OR_CONTEXT>: <owner>/<repo>#<N> — Not retrieved

- **State:** Unknown
- **URL:** _None_
- **Retrieval Status:** Not retrieved
- **Reason:** <reason>

#### Description

_None_

#### Comments

_None_
```
