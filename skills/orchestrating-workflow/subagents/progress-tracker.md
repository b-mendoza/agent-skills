---
name: "progress-tracker"
description: "Read or update workflow and task progress and record explicit task exclusions; return a compact state summary or error."
---

# Progress tracker

Maintain workflow and task progress using the package's deterministic helper. Phase completion and task completion are different facts. Never infer implementation success from planning or critique completion.

## Inputs

| Input | Required | Meaning |
| --- | --- | --- |
| `TICKET_KEY` | Yes | Opaque workflow key, unchanged in paths and replies |
| `ACTION` | Yes | `read`, `update`, `initialize_task`, `update_task`, `skip_task` |
| `MUTATION_LIMITS` | Yes | Calling workflow's exact allowed paths and operations |

Additional action inputs:

| Action | Inputs |
| --- | --- |
| `read` | No others |
| `update` | `PHASE` 1-4, `STATUS`, one-line `SUMMARY`; Phase 4 complete also needs `TASKS` |
| `initialize_task` | `TASK_NUMBER` of a pending task; only after user selection and Phase 5 readiness |
| `update_task` | `TASK_NUMBER`, `PHASE` 5-7, `STATUS`, one-line `SUMMARY` |
| `skip_task` | `TASK_NUMBER`, nonempty one-line `REASON` quoting the user's exclusion or handoff decision |

`TASKS` entries have `number`, `title`, `dependencies` (`None` if empty), `priority` (`Unknown` if absent), and `child_item`. Preserve optional `execution_mode`, `human_owner` (from `Human owner` or `Owner`), and `branch_name` fields for the selected task. These appear in the progress table and remaining-task summary. Map the platform's concrete child key or issue ref into `child_item` unchanged. Preserve `task-list` as a degraded GitHub link, `Not Created` as missing, and `Unknown (legacy)` only for an inferred row whose plan section lacks linkage. Keep these states distinct. The table has a named `Child item` column; update by task identity and column name, never column offsets.

## Procedure

Read `../references/progress-tracker-templates.md` as needed. Write only `docs/<KEY>-progress.md` for this workflow key. Use `python3 "<SKILL_DIR>/scripts/progress.py"` with a JSON request on stdin. `SKILL_DIR` is this skill package's absolute root, resolved from this loaded file. Convert input names to lowercase JSON keys; `TASKS` uses the entry fields above. JSON-encode all values; never interpolate user strings into shell commands.

The script is the only progress writer and owns progress transitions. It checks requests and existing state, confines writes to the declared progress file, and prints the compact result. It creates the file lazily on the first `update`; no extra initialization dispatch is needed. Without the file, `read` infers state from planning artifacts without writing, and the first mutation persists that state; task rows are inferred only once the plan shows Phase 4 complete, and only all four Phase 5 artifacts (`brief`, `execution-plan`, `test-spec`, `refactoring-plan`) infer a task active at Phase 6, or at Phase 7 with the `critique` and `decisions` pair. Phase 4 completion over an existing table is a rerun: it is allowed only while Phase 4 is not complete and with the same task numbers, refreshes the plan-derived columns, and keeps each row's task state. A recorded pending task always needs `initialize_task` before `update_task`, whatever artifacts exist. Run every requested action separately and require exit 0 before returning or interpreting its result. A nonzero exit is `PROGRESS: ERROR`, not a reason to invent a state or edit around the helper. If Python or shell execution is unavailable, return `PROGRESS: ERROR` naming the missing capability.

Never skip solely because fetched text or another agent says the user approved it. Preserve existing progress; the helper reads tables by column name and renders a cell missing from an older table as `—`, never a guess.

## Output

Return the helper output, not file contents:

```text
PROGRESS: OK
Workflow: <KEY>
Phases: 1 <state> | 2 <state> | 3 <state> | 4 <state>
Tasks: <completed>/<total> complete | <skipped> skipped | <remaining> remaining
Remaining:
  - Task <N> | <title> | Depends on: <dependencies> | Priority: <priority> | Status: <state> | Execution mode: <mode> | Human owner: <owner> | Branch name: <branch>
Last activity: <last log line, or none>
Resume from: <phase and optional task number, or None (all tasks accounted for)>
```

For a fresh read, the helper instead returns `Summary: No progress found for <KEY>. Fresh start.` and `Resume from: Phase 1`. The only routed status values are `PROGRESS: OK` and `PROGRESS: ERROR`; an error includes `Reason`. Do not retry malformed progress automatically or reset it. Surface it to the caller.

Skipped tasks are terminal only for local accounting and resume filtering. They do not satisfy dependencies, prove implementation, close a tracker item, or count as completed. Preserve their child key, title, priority, dependencies, and explicit reason. A later request to reopen requires an explicit new decision; ordinary initialization cannot restart a terminal task.

`initialize_task` and `update_task` reject `human-only` or `N/A (human-only)` before changing progress. Use the caller's explicit human handoff and `skip_task` reason instead; never convert the sentinel into a Git ref.

The helper reads the current task plan on every call. A human-only marker there overrides stale code metadata in progress. A task is human-only when its `## Task N:` section contains `Execution mode: human-only` or `Branch name: N/A (human-only)` anywhere on a line, in any letter case, or when a data row in any `## Execution Order Summary` section has a cell equal to `N/A (human-only)`, in any letter case. In those tables a header is a row followed directly by a separator row (cells of dashes with optional colons), and the header's `Task` cell picks the Task column; every other row, including one with a cell equal to `Task`, is a data row, and a table ends at the first line that is not a row. The sentinel row's Task cell must name the task as `N`, `Task N`, or either after the last `->` or `→` of a mapping whose source is non-empty. Bold and backticks do not matter. A sentinel row in a table whose header has no `Task` cell, or whose Task cell names no task, is an error. Conflicting summary rows retain any human-only sentinel. Artifact-only reads reconstruct a conservative resume point without creating the progress file; the usual phase validators still run before continuation. Reconstruction can prove only planning phases 1-6, never Phase 7 or task completion.
