# Task Issue Creator Templates

> Read this file only when you reach the description/body construction or
> plan-update steps in `task-issue-creator.md`.
>
> These are literal fragments and examples. Phase 4 contract semantics live in
> `../references/phase-4-io-contracts.md`.

## GitHub issue body fragment

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

<From plan or "None — all resolved">

## Implementation notes

<Current plan content for this task>

## Definition of done

<From plan>

## Likely files / artifacts affected

<From plan>
```

## Example task-list note

```markdown
- [ ] **(task-list)** This task is tracked as a checklist item on the parent issue or in this plan; no child issue number.
```

## Example machine handoff comment

```html
<!-- phase4-handoff parent="OWNER/REPO#PARENT_NUMBER" model="linked-issue" capability="REST sub_issues unavailable; using gh issue create + parent URL in body" updated="2026-04-08T12:00:00Z" -->
```

## Example `## GitHub Task Issues` section

```markdown
## GitHub Task Issues

<!-- phase4-handoff parent="acme/app#42" model="linked-issue" capability="..." updated="2026-04-08T12:00:00Z" -->

| Task | Issue ref | Title | Write model | Status | Dependencies | Priority |
| ---- | --------- | ----- | ----------- | ------ | ------------ | -------- |
| 1    | acme/app#100 | Task 1: Set up database schema | linked-issue | OPEN | None | High |
| 2    | Not Created | Task 2: Implement API layer | linked-issue | Not Created | 1 | High |
| 3    | task-list | Task 3: Polish copy | task-list | task-list | None | Low |
```

## Example per-task inline lines

```markdown
GitHub Task Issue: acme/app#100
```

```markdown
GitHub Task Issue: Not Created
```

```markdown
GitHub Task Issue: task-list
```
