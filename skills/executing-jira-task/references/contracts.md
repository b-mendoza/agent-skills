# Contracts and Preconditions

> Read this file when validating task readiness or interpreting pipeline
> artifacts.
>
> Reminder: the orchestrator coordinates; the subagents produce the work and
> return concise summaries.

## Alignment with the parent workflow

Phase 7 preconditions come from the parent orchestrator's data contracts
(per-task rows for the planning and critique phases) and its task-loop
readiness gate. This file is the execution skill's authoritative breakdown of
paths, kickoff semantics, and dispatch inputs; it must not contradict those
parent contracts.[^1]

[^1]: The concrete parent orchestrator for this skill is
    `orchestrating-jira-workflow`. Its filesystem layout is intentionally
    unreferenced here so this skill stays portable across harnesses.

## Required input shape

The orchestrator starts with exactly two explicit inputs:

| Input         | Required | Example    |
| ------------- | -------- | ---------- |
| `TICKET_KEY`  | Yes      | `JNS-6065` |
| `TASK_NUMBER` | Yes      | `3`        |

All other inputs are derived from those values.

## Upstream artifacts

| Path pattern                               | Produced by                        | Why it matters                               |
| ------------------------------------------ | ---------------------------------- | -------------------------------------------- |
| `docs/<KEY>.md`                            | `fetching-jira-ticket`             | Ticket snapshot and Jira context.            |
| `docs/<KEY>-tasks.md`                      | `planning-jira-tasks`              | Task source of truth and downstream status.  |
| `docs/<KEY>-task-<N>-brief.md`             | `planning-jira-task`               | Scope, context, and DoD.                     |
| `docs/<KEY>-task-<N>-execution-plan.md`    | `planning-jira-task`               | Approved implementation approach.            |
| `docs/<KEY>-task-<N>-test-spec.md`         | `planning-jira-task`               | Required behavior coverage.                  |
| `docs/<KEY>-task-<N>-refactoring-plan.md`  | `planning-jira-task`               | Approved prep/cleanup work.                  |
| `docs/<KEY>-task-<N>-critique.md`          | `clarifying-assumptions` (critique) | Task-level critique record.                  |
| `docs/<KEY>-task-<N>-decisions.md`         | `clarifying-assumptions` (critique) | Decisions and confirmed plan after critique. |

**Normal orchestrated path:** all of the above through `decisions.md` are
required before kickoff. Phase 6 critique produces `critique.md` and
`decisions.md` before Phase 7 begins.

If any required artifact is missing, stop before dispatching subagents and name
which upstream phase or skill must run first.

## Task readiness checklist

Confirm all of the following before the kickoff step:

1. `docs/<KEY>-tasks.md` contains a `## Task <N>:` section for the selected
   task.
2. The task is not already marked complete unless the user explicitly asked to
   re-run or revise it.
3. Any dependencies or prerequisite tasks referenced in the plan are already
   marked complete.
4. The task section still matches the planning artifacts. If the plan and the
   per-task artifacts disagree materially, stop and escalate.
5. A Jira subtask key is optional. When Jira linkage exists, resolve it from the
   selected task section's `Jira Subtask: <KEY>` line first, or from the
   matching row in `## Jira Subtasks` if the inline line is absent. Missing
   Jira linkage does not block code execution; it only affects
   kickoff/tracking updates later.

## Execution kickoff boundary

Phase 7 begins with an explicit kickoff inside `executing-jira-task`. This is
the first point where the workflow is allowed to perform execution-side
mutations, such as:

- confirming or adjusting branch/worktree readiness
- resolving explicit dirty-worktree handling rules
- moving the Jira subtask to `In Progress` when capability exists

Everything before kickoff remains planning or critique. Everything after kickoff
assumes the task is actively in execution.

## Dispatch contracts

Pass structured inputs only. Use file paths when the downstream specialist can
read the source artifact itself; use short reports when the downstream step
needs a prior verdict or summary.

Report labels such as `KICKOFF_REPORT`, `EXECUTION_REPORT`, and `CODE_REVIEW`
are symbolic handoff names for the full markdown outputs returned by those
subagents.

`EXECUTION_REPORT` and `DOCUMENTATION_REPORT` may carry blocked-state
information. Downstream steps must preserve those statuses instead of inferring
success from partial file changes alone.

| Subagent                | Required inputs                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `execution-starter`     | `TICKET_KEY`, `TASK_NUMBER`, ticket snapshot path, task plan path, execution brief path, optional readiness summaries |
| `task-executor`         | Brief path, execution plan path, test spec path, refactoring plan path, decisions path; optional critique path, fix brief, previous execution report |
| `documentation-writer`  | `EXECUTION_REPORT`, `TICKET_KEY`, `TASK_NUMBER`                                                                  |
| `requirements-verifier` | Brief path, test spec path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`                                           |
| `clean-code-reviewer`   | Brief path, test spec path, refactoring plan path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT` |
| `architecture-reviewer` | Brief path, execution plan path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW` |
| `security-auditor`      | Brief path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW`, `ARCHITECTURE_REVIEW` |

## Artifact lifecycle

| Category | Contents                                                                                 | Git behavior        | Lifecycle |
| -------- | ---------------------------------------------------------------------------------------- | ------------------- | --------- |
| A        | `docs/<KEY>*.md`, progress files, briefs, plans, test specs, refactoring plans, decisions | Never committed     | Never deleted |
| B        | Source files, test files, config changes, in-code docs                                   | Committed normally  | Normal project rules |

The `documentation-writer` may update Category A artifacts on disk so the
workflow can resume later, but those files stay out of git history.

## Successful completion contract

After a successful run, all of the following should be true:

1. `EXECUTION_REPORT` and `DOCUMENTATION_REPORT` both indicate successful
   completion rather than blocked partial progress.
2. Execution kickoff either moved the Jira subtask to `In Progress` or reported
   clearly why that step was skipped.
3. Category B changes are committed.
4. The task section in `docs/<KEY>-tasks.md` includes:
   - `**Status:** ✅ Complete (<date>)`
   - `**Implementation summary:**`
   - `**Files changed:**`
5. If a `## Jira Subtasks` table exists, the selected row is updated to `Done`.
6. Optional Jira transition/comment work is either completed or reported as
   skipped with a reason.

Partial progress alone does not satisfy successful completion. If a required
task step, test, or validation command could not run because a capability or
prerequisite was unavailable, the task remains blocked until that dependency is
resolved.
