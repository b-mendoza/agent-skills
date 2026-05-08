# Dependency and Branch Guide

Read this file when `dependency-prioritizer` is turning the stage 1 plan into
the ordered stage 2 plan.

## Dependency Classes

| Class | Meaning |
| ----- | ------- |
| Hard | This task cannot start until the dependency completes |
| Soft | Useful ordering, but not strictly required |
| Parallel | Tasks can proceed independently |

Be conservative. If unsure whether a relationship is hard or soft, call it soft
unless an upstream output or shared-file risk makes the order mandatory.

## Prioritization

Score each task from 1 to 5 on:

- Risk
- Complexity
- Value unlock
- Dependency

Apply ordering rules in this order:

1. Respect hard dependencies.
2. Front-load high-risk tasks to surface blockers early.
3. Front-load high-value-unlock tasks that unblock other work.
4. Defer low-risk, low-complexity tasks when nothing depends on them.
5. Group related tasks when it reduces context switching and keeps the graph valid.

The final order must be a valid topological sort.

## Branch Naming

Generate branch names after tasks have final numbers.

Default parent-ticket branch format:

```text
feature/<ticket-key-lower>-task-<n>-<short-task-slug>
```

Example:

```text
feature/jns-6065-task-1-auth-schema
```

Rules:

- Use an explicit team prefix from the snapshot or `DECISIONS` if provided;
  otherwise use `feature/`.
- Lowercase the Jira key.
- Slugify the task title as short kebab-case.
- Keep branch names deterministic and valid for Git refs: no spaces, no trailing
  slash or dot, no `..`, and no characters such as `~`, `^`, `:`, `?`, `*`, `[`,
  or backslash.
- Keep names readable; prefer a short slug over copying the full task title.

## Current-Subtask Mode

If the stage 1 plan notes that the ticket is already a Jira subtask, use a
single branch for all tasks:

```text
feature/<ticket-key-lower>-<short-ticket-slug>
```

Repeat the same `**Branch name:**` value in every task and add this line to
`## Execution Order Summary`:

```markdown
Subtask creation mode: skip downstream Jira subtask creation because this ticket
is already a subtask. Execute all tasks on `<branch-name>` in one PR.
```

## Quality Self-Check

Before writing the stage 2 file, verify:

- Every task has `**Priority:**`.
- Every task has `**Branch name:**`.
- Every task has `**Dependencies / prerequisites:**`.
- Every task heading uses `## Task <N>: <Title>`.
- Every dependency reference points to a valid renumbered task.
- No hard dependency is violated by the final order.
- `## Execution Order Summary` includes a branch column.
- `## Dependency Graph` is present.
- Original stage 1 task content is preserved except for required annotations,
  renumbering, and branch names.

## Common Mistakes

- Ordering purely by score and violating a hard dependency.
- Marking every relationship as hard to be safe.
- Ignoring shared-file conflict risk.
- Leaving stale letter references after renumbering.
- Generating branch names before final task numbering is stable.
- Creating separate task branches when current-subtask mode requires one branch.
