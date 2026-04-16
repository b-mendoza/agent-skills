# Naming Conventions

## Skills

Use **gerund form** (present participle) — describes the ongoing activity:

- `analyzing-data`
- `deploying-service`
- `creating-jira-subtasks`
- `orchestrating-jira-workflow`

## Subagents

Use **role nouns** — describes the specialist performing the work:

- `log-analyzer`
- `code-reviewer`
- `task-executor`
- `progress-tracker`

## Why the distinction

The naming convention signals the artifact type at a glance. Gerunds describe
processes (skills coordinate processes). Role nouns describe actors (subagents
are specialists that execute). This makes registry tables, file listings, and
dispatch instructions self-documenting.

## Frontmatter naming

The `name` field in YAML frontmatter uses kebab-case and matches the directory
or file name exactly:

```yaml
---
name: "orchestrating-jira-workflow" # matches skills/orchestrating-jira-workflow/
---
```
