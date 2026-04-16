# Subtask Creator Templates

> Read this file only when you reach the description/body construction or
> plan-update steps in `subtask-creator.md`.
>
> These are literal fragments and examples. Phase 4 contract semantics live in
> `../references/phase-4-io-contracts.md`.

## Jira Wiki-Markup description fragment

```text
h3. Objective
<Objective text>

h3. Relevant Requirements and Context
<Bullet list or paragraph>

h3. Dependencies / Prerequisites
<Content or "None">

h3. Questions to Answer Before Starting
<Content or "None — all resolved">

h3. Implementation Notes
<Current plan content>

h3. Definition of Done
<Checklist or bullets>

h3. Likely Files / Artifacts Affected
<List>
```

## Example `## Jira Subtasks` section

```markdown
## Jira Subtasks

| Task | Subtask Key | Title | Status | Dependencies | Priority |
| ---- | ----------- | ----- | ------ | ------------ | -------- |
| 1    | PROJ-200    | Task 1: Set up database schema | To Do       | None         | High     |
| 2    | Not Created | Task 2: Implement API layer    | Not Created | 1            | High     |
```

## Example per-task inline lines

```markdown
Jira Subtask: PROJ-200
```

```markdown
Jira Subtask: Not Created
```
