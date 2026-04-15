# Task Issue Creator Templates

> Read this file only when you reach the description/body construction or plan-update
> steps in `task-issue-creator.md`.

## GitHub issue body (linked-issue and native-sub-issue)

Use this exact section order when assembling the **body** for a task issue
(GitHub-flavored Markdown). Keep headings at `##` so the body stays readable in
the GitHub UI.

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

For **native-sub-issue** rows, keep the same body. The parent traceability line
under `## Parent` remains required so validators and humans can follow the chain
if UI hierarchy is incomplete or regressed.

## Task-list traceability (plan-only row)

When the write model for a task is **task-list**, do **not** open a new GitHub
issue for that task. Instead, ensure the parent issue or the plan documents the
task as a checklist item. Minimum plan-side record:

- Workflow table row: `Issue ref` = `task-list`, `Write model` = `task-list`,
  `Status` = `task-list`.
- Per-task line: `GitHub Task Issue: task-list`.
- In the task section body, add a short bullet if not already present:

```markdown
- [ ] **(task-list)** This task is tracked as a checklist item on the parent issue or in this plan; no child issue number.
```

## Plan file fragments

### Machine handoff comment

Replace placeholders before writing:

```html
<!-- phase4-handoff parent="OWNER/REPO#PARENT_NUMBER" model="linked-issue" capability="REST sub_issues unavailable; using gh issue create + parent URL in body" updated="2026-04-08T12:00:00Z" -->
```

### Workflow table shape (`## GitHub Task Issues`)

```markdown
## GitHub Task Issues

<!-- phase4-handoff parent="acme/app#42" model="linked-issue" capability="..." updated="2026-04-08T12:00:00Z" -->

| Task | Issue ref | Title | Write model | Status | Dependencies | Priority |
| ---- | --------- | ----- | ----------- | ------ | ------------ | -------- |
| 1    | acme/app#100 | Task 1: Set up database schema | linked-issue | OPEN | None | High |
| 2    | Not Created | Task 2: Implement API layer | linked-issue | Not Created | 1 | High |
| 3    | task-list | Task 3: Polish copy | task-list | task-list | None | Low |
```

**Column order is normative** for machine-friendly parsing.

### Per-task inline line (immediately after `## Task <N>:` heading)

```markdown
GitHub Task Issue: acme/app#100
```

For failures or task-list:

```markdown
GitHub Task Issue: Not Created
```

```markdown
GitHub Task Issue: task-list
```
