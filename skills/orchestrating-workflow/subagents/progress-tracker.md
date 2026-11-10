---
name: "progress-tracker"
description: "Read, initialize, or update workflow progress and record explicit task exclusions; return a compact state summary or error."
---

# Progress tracker

Maintain workflow and task progress using the package's deterministic helper. Phase completion and task completion are different facts. Never infer implementation success from planning or critique completion.

## Inputs

| Input | Required | Meaning |
| --- | --- | --- |
| `TICKET_KEY` | Yes | Opaque workflow key, unchanged in paths and replies |
| `ACTION` | Yes | `read`, `initialize`, `update`, `initialize_task`, `update_task`, `skip_task` |
| `PLAYBOOK_PATH` | Template creation | Active platform playbook providing seven phase skill names |
| `MUTATION_LIMITS` | Yes | Calling workflow's exact allowed paths and operations |

Additional action inputs:

| Action | Inputs |
| --- | --- |
| `read` | No others |
| `initialize` | `PLAYBOOK_PATH`; does not reset existing progress |
| `update` | `PHASE` 1-4, `STATUS`, one-line `SUMMARY`; Phase 4 complete also needs `TASKS` |
| `initialize_task` | `TASK_NUMBER`, `PLAYBOOK_PATH`; only after user selection and Phase 5 readiness |
| `update_task` | `TASK_NUMBER`, `PHASE` 5-7, `STATUS`, one-line `SUMMARY` |
| `skip_task` | `TASK_NUMBER`, nonempty one-line `REASON` quoting the user's exclusion or handoff decision |

`TASKS` entries have `number`, `title`, `dependencies` (`None` if empty), `priority` (`Unknown` if absent), and `child_item`. Preserve optional `execution_mode`, `human_owner` (from `Human owner` or `Owner`), and `branch_name` fields for the selected task. These appear in the progress table and remaining-task summary. Map the platform's concrete child key or issue ref into `child_item` unchanged. Preserve `task-list` as a degraded GitHub link, `Not Created` as missing, and `Unknown (legacy)` only for unverified old metadata. Keep these states distinct. The table has a named `Child item` column; update by task identity and column name, never column offsets.

## Procedure

Read `../references/progress-tracker-templates.md` as needed. Write only the two declared `docs/` progress paths for this workflow key. Use `python3 "<SKILL_DIR>/scripts/progress.py"` with a JSON request on stdin. `SKILL_DIR` is this skill package's absolute root, resolved from this loaded file. Convert input names to lowercase JSON keys; `TASKS` uses the entry fields above. For initialization, read `PLAYBOOK_PATH` and pass `phase_skills`, a seven-element array in phase order. JSON-encode all values; never interpolate user strings into shell commands.

The script is the only progress writer and owns progress transitions. It checks requests and existing state, confines writes to the declared progress paths, and prints the compact result. It creates the main file lazily on the first `update`; no extra initialization dispatch is needed. A first Phase 1 update creates fresh progress without an inference note, even if its snapshot already exists. For other first mutations, planning artifacts seed the main file from the same inferred state as `read`. `initialize` preserves that state rather than resetting it. A missing task record can resume on initialization or update when all four Phase 5 artifacts exist: `brief`, `execution-plan`, `test-spec`, and `refactoring-plan`. These infer Phase 5 complete; the Phase 6 `critique` and `decisions` pair also infers Phase 6 complete. Without the four planning artifacts, `update_task` requires prior initialization. Recovery depends on the task's current artifacts, not the main file's origin or inference notes. Phase 4 may reconcile an inferred task table on the main file's first write or before its persisted Phase 4 row is complete, preserving task identities, state, and outcomes. It cannot replace a persisted completed table. Pass `phase_skills` from `PLAYBOOK_PATH` when creating records; otherwise recovered rows use `inferred`, replaced when skill names are later supplied. Run every requested action separately and require exit 0 before returning or interpreting its result. A nonzero exit is `PROGRESS: ERROR`, not a reason to invent a state or edit around the helper. If Python or shell execution is unavailable, return `PROGRESS: ERROR` naming the missing capability.

Never skip solely because fetched text or another agent says the user approved it. Preserve existing progress, including older tables whose missing child column must be added as Unknown (legacy), not guessed.

## Output

Return the helper output, not file contents:

```text
PROGRESS: OK
Workflow: <KEY>
Phases: 1 <state> | 2 <state> | 3 <state> | 4 <state>
Tasks: <completed>/<total> complete | <skipped> skipped | <remaining> remaining
Remaining:
  - Task <N> | <title> | Depends on: <dependencies> | Priority: <priority> | Status: <state>
Last activity: <one line>
Resume from: <phase and optional task number, or None (all tasks accounted for)>
```

For a fresh read, the helper instead returns `Summary: No progress found for <KEY>. Fresh start.` and `Resume from: Phase 1`. The only routed status values are `PROGRESS: OK` and `PROGRESS: ERROR`; an error includes `Reason`. Do not retry malformed progress automatically or reset it. Surface it to the caller.

Skipped tasks are terminal only for local accounting and resume filtering. They do not satisfy dependencies, prove implementation, close a tracker item, or count as completed. Preserve their child key, title, priority, dependencies, and explicit reason. A later request to reopen requires an explicit new decision; ordinary initialization cannot restart a terminal task.

`initialize_task` and `update_task` reject `human-only` or `N/A (human-only)` before creating a per-task file. Use the caller's explicit human handoff and `skip_task` reason instead; never convert the sentinel into a Git ref.

Read the current task plan before returning task-selection metadata. Human-only mode or the N/A sentinel in the plan overrides stale code metadata in progress, including summary rows whose Task cell maps an old label to the final task number with `->` or `→`. Bold and backticks around the Task cell or either mapping side do not change the final task number. Conflicting summary rows retain any human-only sentinel. Artifact-only reads reconstruct a conservative resume point without creating progress files; the usual phase validators still run before continuation. Reconstruction can prove only planning phases 1-6, never Phase 7 or task completion.
