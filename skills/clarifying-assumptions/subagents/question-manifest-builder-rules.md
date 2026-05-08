# Question Manifest Builder Rules

Read this file after the critique report is validated and before building
the manifest. These rules are static so the subagent definition can stay
compact until assembly time.

## Upfront Inventory

In `MODE=upfront`, include these in `Questions For Now`:

- Problem-framing critique items from the critique report
- Technology critique items from the critique report
- Cross-cutting open questions from the task plan
- Architectural assumptions from the task plan
- Validation `FAIL` items from the task plan
- Task 1 questions from the task plan

Collect these as deferred:

- Task 2+ questions
- Task 2+ assumptions that should not be resolved yet
- New future-task questions surfaced by the critique report

In upfront mode, `Irrelevant` is normally `0` because future-task items
are deferred instead of marked irrelevant. Keep the `## Resolved
Irrelevant` section in the output and leave it empty unless a specific
item is no longer applicable.

## Critique Inventory

In `MODE=critique`, include these in `Questions For Now`:

- Technology critique items for the current task
- User-impact critique items for the current task
- Deferred questions for `TASK_NUMBER` that still matter
- Current-task assumptions or open questions still unresolved

Collect these as irrelevant:

- Deferred questions already answered elsewhere in the plan
- Deferred questions invalidated by the current-task artifacts
- Deferred questions whose premise is no longer true

## Ordering

For `MODE=upfront`, order items like this:

1. Problem-framing `HIGH` severity
2. Problem-framing `MEDIUM`
3. Problem-framing `LOW`
4. Validation `FAIL`
5. Technology critique `HIGH`
6. Technology critique `MEDIUM`
7. Architectural assumptions
8. Cross-cutting questions
9. Task 1 questions
10. Dependency risks and non-blocking warnings

For `MODE=critique`, order items like this:

1. Critique `HIGH`
2. User-impact `HIGH`
3. Critique `MEDIUM`
4. User-impact `MEDIUM`
5. Remaining deferred questions
6. Low-severity awareness items

## Compact Briefs

For each item in the manifest, produce a short brief containing only what
the conversational skill needs:

- `Item ID`
- `Category`
- `Severity`
- `Model` (`A` or `B`)
- `Skippable`
- `Affected tasks`
- `Original decision or question`
- `Critique summary or context`
- `Fallback/default`

Do not copy entire artifact sections into the manifest.

## Item IDs

Preserve critique report IDs exactly:

- `PF<n>` for problem-framing items
- `TC<n>` for technology critique items
- `UI<n>` for user-impact items

Use deterministic IDs for plan-derived items:

- `A<n>` for assumptions
- `CQ<n>` for cross-cutting questions
- `V<n>` for validation items
- `TQ-<task>-<n>` for task questions
- `DQ-<task>-<n>` for deferred questions

Once assigned, keep the same `Item ID` throughout the manifest so the
conversation layer and `decision-recorder` can reuse it unchanged.

## Category Labels

Use human-readable labels that map directly to `decision-recorder`
categories.

| Manifest label | Recorder category |
| --- | --- |
| `Problem framing` | `problem-framing` |
| `Critique` | `critique` |
| `User impact` | `user-impact` |
| `Cross-cutting` | `cross-cutting` |
| `Assumption` | `assumption` |
| `Architectural assumption` | `assumption` |
| `Task question` | `task-question` |
| `Validation` | `validation` |
