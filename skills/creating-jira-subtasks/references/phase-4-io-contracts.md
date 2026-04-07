# Phase 4 I/O Contracts

> Read this file when validating standalone Phase 4 execution or interpreting
> the `subtask-creator` summary.
>
> **Reminder:** Keep only artifact shapes and structured verdicts in the
> coordinator context. Plan parsing, Jira operations, and plan-file edits stay
> inside `subtask-creator`.

## Input Contract

Primary input artifact:

```text
docs/<TICKET_KEY>-tasks.md
```

For normal Phase 4 execution, the plan is expected to contain:

| Expected section / element                          | Produced by            | Why it matters                               |
| --------------------------------------------------- | ---------------------- | -------------------------------------------- |
| `## Tasks` with numbered `## Task <N>:` headings    | planning-jira-tasks    | Each task maps to one Jira subtask           |
| `## Execution Order Summary`                        | planning-jira-tasks    | Preserves task ordering context              |
| `## Decisions Log`                                  | clarifying-assumptions | Indicates critique is complete before Jira writes |

The parent orchestrator is responsible for validating the normal Phase 4
precondition before this skill runs. If this skill is used standalone and the
plan is missing or malformed, the subagent returns `SUBTASKS: BLOCKED`. If
`## Decisions Log` is missing, the subagent continues with `SUBTASKS: WARN`:
the plan is still parseable, but the normal workflow precondition was skipped.

## Output Contract

Primary output artifact:

```text
docs/<TICKET_KEY>-tasks.md
```

After successful or partial Phase 4 completion, the plan file must include:

| Addition                                                       | Consumed by                         | Purpose                                            |
| -------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------- |
| `## Jira Subtasks` table (Task, Subtask Key, Title, Status)    | artifact-validator, executing-jira-task | Supports Phase 4 validation and later Jira status updates |
| `Jira Subtask: <KEY>` line in each linked task section         | executing-jira-task                 | Identifies the Jira issue to transition later      |

The overall Phase 4 completion signal remains the validated presence of
`## Jira Subtasks` in `docs/<TICKET_KEY>-tasks.md`.

## Structured Summary Contract

The subagent returns a structured summary with:

- `SUBTASKS: PASS | WARN | FAIL | BLOCKED | ERROR`
- `Validation: PASS | FAIL | NOT_RUN`
- Counts for tasks in plan, already-linked tasks, newly created tasks, and
  failed creates
- A `Created/Linked Subtasks` table with task number, key, title,
  dependencies, priority, and outcome
- Explicit `Warnings` and `Failures` sections

Treat `SUBTASKS: ERROR` as an unexpected tool or environment failure. The
coordinator stops and surfaces the reason instead of trying to interpret the
run as a degraded success.

That table is the handoff the parent workflow uses to populate progress
tracking.
