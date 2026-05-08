# Dependency and Branch Guide

Read this file when `dependency-prioritizer` is turning the stage 1 plan into
the ordered stage 2 plan.

> **Reminder:** Apply the operational rules below first. Fetch a URL from
> `./external-sources.md` only when you need background (for example
> `git-check-ref-format` for branch-name validity edge cases, `topological-sort`
> for ordering rationale, `rice-scoring` for prioritization rationale, or
> `feature-branch-workflow` for the `feature/` prefix convention).

## Optional Source Lookups

The local rules below are enough for normal execution. Use these source keys
only when an edge case or explanation needs source-backed support:

| Need | Source key in `./external-sources.md` |
| ---- | ------------------------------------- |
| Git ref validity edge case | `git-check-ref-format` |
| `feature/` branch convention background | `feature-branch-workflow` |
| Topological-sort definition or cycle handling | `topological-sort` |
| Prioritization scoring rationale | `rice-scoring` |
| GitHub parent / sub-issue behavior | `github-sub-issues` |

## Dependency Classes

| Class | Meaning |
| ----- | ------- |
| Hard | This task cannot start until the dependency completes |
| Soft | Useful ordering, but not strictly required |
| Parallel | Tasks can proceed independently |

Be conservative. If unsure whether a relationship is hard or soft, call it soft
unless an upstream output or shared-file risk makes the order mandatory.

## Prioritization

Score each task from 1 to 5 on Risk, Complexity, Value unlock, and Dependency.
Total is the sum out of 20.

Apply ordering rules in this order:

1. Respect hard dependencies.
2. Front-load high-risk tasks to surface blockers early.
3. Front-load high-value-unlock tasks that unblock other work.
4. Defer low-risk, low-complexity tasks when nothing depends on them.
5. Group related tasks when it reduces context switching and keeps the graph valid.

The final order must be a valid topological sort.

## Branch Naming

Generate branch names after tasks have final numbers.

Default parent-issue branch format:

```text
feature/<issue-slug-lower>-task-<n>-<short-task-slug>
```

Example:

```text
feature/acme-app-42-task-1-auth-schema
```

Rules:

- Use an explicit team prefix from the snapshot or `DECISIONS` if provided;
  otherwise use `feature/`.
- Lowercase the issue slug.
- Slugify the task title as short kebab-case; prefer a short slug over copying
  the full title.
- Branch names must be valid Git refs: no spaces, no `..`, no leading or
  trailing `/`, no trailing `.lock`, and none of `~`, `^`, `:`, `?`, `*`, `[`,
  or backslash. Fetch `git-check-ref-format` only for edge cases not covered
  here.

## Current-Child-Issue Mode

If the stage 1 plan notes that the issue is already a GitHub child issue or
sub-issue, use a single branch for all tasks:

```text
feature/<issue-slug-lower>-<short-issue-slug>
```

Repeat the same `**Branch name:**` value in every task and add this line to
`## Execution Order Summary`:

```markdown
Child-issue creation mode: skip downstream GitHub child-issue creation because
this issue is already child work. Execute all tasks on `<branch-name>` in one PR.
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
- Creating separate task branches when current-child-issue mode requires one branch.
