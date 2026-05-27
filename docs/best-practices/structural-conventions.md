# Structural Conventions

## What it is

Follow a consistent section ordering for skills and subagents so that agents
(and humans) can quickly locate information and understand the structure of
any new definition.

## Skill section order

```
1. YAML frontmatter (name, description)
2. # Title + purpose paragraph
3. ## Inputs (table: name, required, example)
4. ## Pipeline / Workflow overview (if multi-phase)
5. ## Subagent Registry (table: name, path, purpose)
6. ## How This Skill Works (behavioral description, identity)
7. ## Execution steps or Phase guide
8. ## Example (dispatch round-trip)
```

## Subagent section order

```
1. YAML frontmatter (name, description)
2. # Title + mental model paragraph
3. ## Inputs (table or list)
4. ## Instructions / How to [action] (step-by-step)
5. ## Output Format (structured template with example)
6. ## Scope (allow-list: "Your job is to...")
7. ## Escalation (failure categories with report format)
```

## Why this order matters

The ordering reflects a natural reading flow, not an absolute safety rule:

- **Identity first** (frontmatter + title) — what is this and when does it
  trigger?
- **Contracts next** (inputs, outputs, registry) — what does it consume and
  produce?
- **Behavior then** (instructions, dispatch tables) — how does it work?
- **Boundaries nearby and complete** (scope, escalation) — where does it stop?

Detailed scope and escalation sections often work best after the agent
understands its purpose and procedure. For high-risk skills, also include a
short boundary summary near the top, close to the identity or inputs, so the
most important mutation, permission, safety, or runtime limits are visible
before execution details begin.

## Subagent Registry format

Every skill that dispatches to subagents needs a registry table. Place it near
the top of the skill body, after the overview:

```markdown
## Subagent Registry

| Subagent        | Path                           | Purpose                             |
| --------------- | ------------------------------ | ----------------------------------- |
| `log-analyzer`  | `./subagents/log-analyzer.md`  | Extract errors from build/test logs |
| `code-reviewer` | `./subagents/code-reviewer.md` | Review changed files for issues     |
```

The orchestrator uses this table to choose the right subagent without reading
every definition file. Paths are relative to the skill folder.

## Naming conventions

This is a repo style convention, not an evidence-backed universal standard.
Use it for first-party skills in this repository so file listings, registry
tables, and dispatch prompts stay predictable.

- **Skills use gerund form** because they describe ongoing activities:
  `analyzing-data`, `deploying-service`, `creating-jira-subtasks`,
  `orchestrating-jira-workflow`.
- **Subagents use role nouns** because they describe specialists performing
  work: `log-analyzer`, `code-reviewer`, `task-executor`,
  `progress-tracker`.
- **Frontmatter names use kebab-case** and match the directory or file name
  exactly.

```yaml
---
name: "orchestrating-jira-workflow"
---
```
