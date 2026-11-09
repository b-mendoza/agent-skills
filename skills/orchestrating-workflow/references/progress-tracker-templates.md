# Progress file contract

> Current-state reference. Update this file when `../scripts/progress.py` changes the written schema. The script owns updates and state projection; these examples describe its output, not a second writer.

Progress remains persistent workflow state under `docs/`. The first `update` lazily creates the main file with four phase rows; explicit `initialize` is optional and never resets existing work.

## Main progress

Path: `docs/<KEY>-progress.md`

```markdown
# <KEY> — Workflow Progress

| Phase | Skill | Status | Completed at | Notes |
| --- | --- | --- | --- | --- |
| 1 | <Phase 1 skill> | Pending | — | — |
| 2 | <Phase 2 skill> | Pending | — | — |
| 3 | clarifying-assumptions | Pending | — | — |
| 4 | <Phase 4 skill> | Pending | — | — |

## Task Execution (Phases 5–7)

_No tasks yet_

## Execution Log
```

The actual status values carry the established display markers. Phase 4 completion inserts one row per `TASKS` entry:

```markdown
| Task | Title | Dependencies | Priority | Child item | Current Phase | Status | Detail | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Implement validation | None | High | acme/app#101 | — | Pending | `docs/<KEY>-task-1-progress.md` | — |
| 2 | Manual verification | 1 | Low | OPS-202 | — | Pending | `docs/<KEY>-task-2-progress.md` | — |
```

`Child item` preserves a concrete platform identifier, `task-list`, or `Not Created`. `Unknown (legacy)` means the old file lacked linkage evidence; it is not a missing-child verdict. Update rows by `Task` and named columns. Preserve extra columns. Never shift metadata because an older table omitted a column. The Detail path is a prospective locator, not proof that the per-task file exists.

## Per-task progress

Path: `docs/<KEY>-task-<N>-progress.md`. `initialize_task` creates it only after user selection and Phase 5 readiness. It contains phase rows 5, 6, 7, followed by `## Re-plan History` and `## Activity Log`.

Phase labels are `5/7 Plan`, `6/7 Critique`, and `7/7 Execute`. Current Phase points to the next unfinished phase after a successful update. Only successful Phase 7 yields a completed task:

| Update | Phase row | Task row | Next resume |
| --- | --- | --- | --- |
| Phase 5 complete | Complete | Active | Phase 6, same task |
| Phase 6 complete | Complete | Active | Phase 7, same task |
| Phase 7 complete | Complete | Complete | Task selection or terminal |
| Any phase active | Active | Active | Same phase |
| Any phase failed | Failed | Failed | Same phase |
| `skip_task` | Existing phase rows unchanged | Skipped, explicit reason in Outcome/log | Excluded from resume |

`skip_task` works before initialization as well as after an attempted phase. It requires a user-recorded reason and does not create an unstarted task's per-task file. It never fabricates Phase 5, 6, or 7 completion and never closes a remote work item. A skipped prerequisite remains unsatisfied unless the user explicitly resolves the dependent task's readiness through the normal planning/clarification contract.

## Summary accounting

Report completed, skipped, and remaining counts separately. Filter skipped tasks out of resume and task-selection candidates, not out of the historical table. An all-skipped or mixed complete/skipped workflow is accounted for, not fully implemented. Preserve the distinction in the final summary. Read legacy task completion from the per-task phase rows, since older main tables incorrectly displayed Complete after planning or critique.

The table also preserves `Execution mode`, `Human owner`, and `Branch name`. Legacy tasks default to code only when no human-only marker or sentinel is present; the caller must extract those markers from the task plan before selection. Human-only tasks cannot initialize per-task code execution.
