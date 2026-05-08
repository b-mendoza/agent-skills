# Task Issue Creator Templates

> Read this file only when constructing GitHub issue bodies or refreshing the
> local plan's `## GitHub Task Issues` section.

These are literal local artifact fragments. Phase 4 artifact semantics live in
`../references/phase-4-io-contracts.md`. For current `gh` flags, REST
sub-issue syntax, required headers, or parent-body task-list markdown, fetch
the relevant source from `../references/external-sources.md`.

## GitHub Issue Body Fragment

```markdown
## Parent

Tracks parent issue: <PARENT_URL> (`<owner/repo#PARENT_NUMBER>`)

## Task index

Workflow task: **<N>** (from `docs/<ISSUE_SLUG>-tasks.md`)

## Objective

<Objective text from plan>

## Relevant requirements and context

<From plan>

## Dependencies / prerequisites

<From plan or "None">

## Questions to answer before starting

<From plan or "None - all resolved">

## Implementation notes

<Current plan content for this task>

## Definition of done

<From plan>

## Likely files / artifacts affected

<From plan>
```

## Task-List Fallback Note

```markdown
Task-list fallback records plan-only traceability when no concrete child issue
can be created. Use `task-list` in local tables and inline lines; fetch the
GitHub task-list source only before editing parent issue checklist markdown.
```

## Example Machine Handoff Comment

```html
<!-- phase4-handoff parent="OWNER/REPO#PARENT_NUMBER" model="<write-model>" capability="<short detection summary>" updated="2026-04-08T12:00:00Z" -->
```

## Example `## GitHub Task Issues` Section

```markdown
## GitHub Task Issues

<!-- phase4-handoff parent="acme/app#42" model="linked-issue" capability="..." updated="2026-04-08T12:00:00Z" -->

| Task | Issue ref | Title | Write model | Status | Dependencies | Priority |
| ---- | --------- | ----- | ----------- | ------ | ------------ | -------- |
| 1    | acme/app#100 | Task 1: Set up database schema | linked-issue | OPEN | None | High |
| 2    | Not Created | Task 2: Implement API layer | linked-issue | Not Created | 1 | High |
| 3    | task-list | Task 3: Polish copy | task-list | task-list | None | Low |
```

## Example Per-Task Inline Lines

```markdown
GitHub Task Issue: acme/app#100
```

```markdown
GitHub Task Issue: Not Created
```

```markdown
GitHub Task Issue: task-list
```
