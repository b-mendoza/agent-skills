---
description: >
  Create an implementation task plan from a previously retrieved Jira ticket
  document. Breaks the ticket into the smallest practical set of focused,
  independent, and executable tasks. Use when the user says "plan the ticket",
  "create tasks", "break down the ticket", "create an implementation plan", or
  "plan JNS-1234". Requires that the ticket information has already been
  retrieved into docs/<TICKET_KEY>.md. This skill produces a plan ONLY — it
  does NOT implement anything.
allowed-tools:
  - Read
  - Write
  - Grep
  - agent
---

# Planning Jira Tasks

## Purpose

Read the ticket snapshot at `docs/<TICKET_KEY>.md` and produce a detailed,
self-contained task plan at `docs/<TICKET_KEY>-tasks.md`. Each task must carry
enough local context that a future agent with zero prior knowledge can execute
it in isolation.

## Inputs

| Input        | Source              | Required | Example    |
| ------------ | ------------------- | -------- | ---------- |
| `TICKET_KEY` | User / `$ARGUMENTS` | Yes      | `JNS-6065` |

The ticket snapshot file must already exist at `docs/<TICKET_KEY>.md`.
If it does not, tell the user to run the **fetching-jira-ticket** skill first.

## Output

```
docs/<TICKET_KEY>-tasks.md
```

## Execution

### 1. Delegate to the task-planner subagent

Use the `task-planner` subagent to do the heavy analysis:

```
agent task-planner "Create task plan from docs/<TICKET_KEY>.md and write output to docs/<TICKET_KEY>-tasks.md"
```

The subagent isolates the large read of the ticket file and the detailed
reasoning from the main agent's context.

### 2. Review the output

After the subagent completes, read the first 50 lines of the output file to
verify the structure is correct:

- Has a `# <TICKET_KEY> Task Plan` heading
- Has a `## Ticket Summary` section
- Has at least one `## Task N:` section
- Each task has all required subsections

### 3. Report to user

Tell the user:

- File path written
- Total number of tasks created
- Number of open questions flagged across all tasks
- Remind them that no implementation has started

## Task-Planning Rules (enforced by subagent)

These rules are also embedded in the subagent definition, but are listed here
for reference:

- Keep tasks as small, focused, and independent as possible.
- Do not combine unrelated work into a single task.
- Prefer tasks that can be started, paused, reassigned, or clarified in isolation.
- If a task depends on missing information, call that out explicitly.
- Preserve traceability: each task references which requirement(s) it addresses.
- Include enough task-local context for zero-context execution.
- Order tasks in a sensible implementation sequence.
- Split large or ambiguous tasks until they are practical and self-contained.
