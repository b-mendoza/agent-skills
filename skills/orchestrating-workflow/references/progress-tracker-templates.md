# Progress file contract

> Current-state reference. Update this file when `../scripts/progress.py` changes the written schema. The script owns updates and state projection; these examples describe its output, not a second writer.

Progress is one persistent file under `docs/`. The first `update` creates it lazily; no separate initialization action exists. Without the file, `read` infers planning progress from artifacts on disk and writes nothing, and the first successful mutation persists that inferred state. A task action still requires progress or planning artifacts; it cannot start from an empty workspace.

Every write re-renders the whole file from its parsed phases, tasks, and log. Tables are read by header name; a cell missing from an older table renders as `—`. Unknown columns and free text are dropped on rewrite.

## Main progress

Path: `docs/<KEY>-progress.md`

```markdown
# <KEY> — Workflow Progress

| Phase | Name | Status | Completed at | Notes |
| --- | --- | --- | --- | --- |
| 1 | Fetch work item | ✅ Complete | <timestamp> | <summary> |
| 2 | Plan tasks | ⬜ Pending | — | — |
| 3 | Clarify and critique | ⬜ Pending | — | — |
| 4 | Create child items | ⬜ Pending | — | — |

## Task Execution (Phases 5–7)

_No tasks yet_

## Execution Log
<timestamp> — Phase 1: complete — <summary>
```

The `Name` column is static. Phase 4 completion writes one row per `TASKS` entry. Over an existing table it is a rerun, allowed only while Phase 4 is not complete and only with the same task numbers: it refreshes `Title`, `Dependencies`, `Priority`, `Child item`, `Execution mode`, `Human owner`, and `Branch name` and keeps each row's `Current Phase`, `Status`, and `Outcome`. Otherwise it fails with `Phase 4 task table already exists; reconcile explicitly, never reset progress`. Inferred progress shows Phase 4 complete whenever it has task rows, so it cannot be rerun before Phase 4 is recorded as not complete. Inference builds task rows only when the plan shows Phase 4 complete (`## GitHub Task Issues` or `## Jira Subtasks`).

```markdown
| Task | Title | Dependencies | Priority | Child item | Current Phase | Status | Outcome | Execution mode | Human owner | Branch name |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Implement validation | None | High | acme/app#101 | 6/7 Critique | 🔄 Active | — | code | Not specified | task/acme-1 |
| 2 | Manual verification | 1 | Low | OPS-202 | — | ⏭️ Skipped | <user's reason> | human-only | Operations | N/A (human-only) |
```

`Child item` preserves a concrete platform identifier, `task-list`, or `Not Created`. `Unknown (legacy)` means an inferred row's plan section lacked linkage evidence; it is not a missing-child verdict. Rows are matched by `Task` and named columns, never by column offset.

## Task phases

The task row holds all task phase state. Phase labels are `5/7 Plan`, `6/7 Critique`, and `7/7 Execute`. `initialize_task` turns a pending row active at `5/7 Plan` and rejects any other row. `update_task` rejects a pending row and a phase past the row's `Current Phase`; an earlier phase is allowed and moves the row back. Only successful Phase 7 yields a completed task, and a `Complete` row must sit at `7/7 Execute`:

| Update | Task row | Next resume |
| --- | --- | --- |
| Phase 5 complete | Active, `6/7 Critique` | Phase 6, same task |
| Phase 6 complete | Active, `7/7 Execute` | Phase 7, same task |
| Phase 7 complete | Complete, `7/7 Execute` | Task selection or terminal |
| Any phase active | Active, same phase | Same phase |
| Any phase failed | Failed, same phase | Same phase |
| `skip_task` | Skipped, explicit reason in Outcome and log | Excluded from resume |

Without a progress file, an inferred task is pending unless all four Phase 5 artifacts exist (`brief`, `execution-plan`, `test-spec`, `refactoring-plan`), which infer it active at `6/7 Critique`; the Phase 6 `critique` and `decisions` pair advances that to `7/7 Execute`. A persisted pending row never fast-forwards from artifacts; it still needs `initialize_task`.

`skip_task` works before initialization as well as after an attempted phase. It requires a user-recorded reason, never fabricates Phase 5, 6, or 7 completion, and never closes a remote work item. A skipped prerequisite remains unsatisfied unless the user explicitly resolves the dependent task's readiness through the normal planning/clarification contract.

## Summary accounting

Report completed, skipped, and remaining counts separately. Filter skipped tasks out of resume and task-selection candidates, not out of the historical table. An all-skipped or mixed complete/skipped workflow is accounted for, not fully implemented. Preserve the distinction in the final summary. `Last activity` is the last log line, or `none`.

The table also stores `Execution mode`, `Human owner`, and `Branch name`. On every call the helper reads the current task plan, and a human-only marker there overrides stale code metadata. A task is human-only when its `## Task N:` section contains `Execution mode: human-only` or `Branch name: N/A (human-only)` anywhere on a line, in any letter case, or when a data row in any `## Execution Order Summary` section has a cell equal to `N/A (human-only)`, in any letter case. In those tables a header is a row followed directly by a separator row (cells of dashes with optional colons), and the header's `Task` cell picks the Task column; every other row, including one with a cell equal to `Task`, is a data row, and a table ends at the first line that is not a row. The sentinel row's Task cell must name the task as `N`, `Task N`, or either after the last `->` or `→` of a mapping whose source is non-empty. Bold and backticks do not matter. A sentinel row in a table whose header has no `Task` cell, or whose Task cell names no task, is an error. Human-only tasks cannot start Phases 5-7.
