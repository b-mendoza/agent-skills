# Subtask Creator Templates

> Read this file only when constructing Jira descriptions or refreshing the
> local plan's `## Jira Subtasks` section.

These are literal fragments and examples. Phase 4 artifact semantics live in
`../references/phase-4-io-contracts.md`. If a Jira REST transport requires
Atlassian Document Format, fetch the ADF source from
`../references/external-sources.md` and convert these same sections into ADF
block nodes without changing their meaning.

## Jira Description Section Order

The following order is normative; the exact markup is whatever the active
Jira transport accepts (plain text, wiki markup, or ADF).

```text
h3. Objective
<Objective text>

h3. Relevant Requirements and Context
<Bullet list or paragraph>

h3. Dependencies / Prerequisites
<Content or "None">

h3. Questions to Answer Before Starting
<Content or "None - all resolved">

h3. Implementation Notes
<Current plan content>

h3. Definition of Done
<Checklist or bullets>

h3. Likely Files / Artifacts Affected
<List>
```

## Example `## Jira Subtasks` Section

```markdown
## Jira Subtasks

| Task | Subtask Key | Title | Status | Dependencies | Priority |
| ---- | ----------- | ----- | ------ | ------------ | -------- |
| 1    | PROJ-200    | Task 1: Set up database schema | To Do       | None         | High     |
| 2    | Not Created | Task 2: Implement API layer    | Not Created | 1            | High     |
```

## Example Per-Task Inline Lines

```markdown
Jira Subtask: PROJ-200
```

```markdown
Jira Subtask: Not Created
```
