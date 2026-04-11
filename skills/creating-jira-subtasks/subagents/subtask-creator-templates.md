# Subtask Creator Templates

> Read this file only when you reach the payload-construction or plan-update
> steps in `subtask-creator.md`.

## Jira Wiki-Markup Description

Use this exact section order when assembling the Jira description for a task:

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

## Plan File Fragments

Use this table shape when inserting or refreshing `## Jira Subtasks`:

```markdown
## Jira Subtasks

| Task | Subtask Key | Title | Status | Dependencies | Priority |
| ---- | ----------- | ----- | ------ | ------------ | -------- |
| 1    | JNS-6070    | Set up database schema | To Do       | None         | High     |
| 2    | Not Created | Implement API layer    | Not Created | 1            | High     |
```
