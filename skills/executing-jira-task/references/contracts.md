# Contracts and Preconditions

> Read this file when validating task readiness or interpreting pipeline
> artifacts.
>
> Reminder: the orchestrator coordinates; the subagents produce the work and
> return concise summaries.

## Required input shape

The orchestrator starts with exactly two explicit inputs:

| Input         | Required | Example    |
| ------------- | -------- | ---------- |
| `TICKET_KEY`  | Yes      | `JNS-6065` |
| `TASK_NUMBER` | Yes      | `3`        |

All other inputs are derived from those values.

## Upstream artifacts

The table below distinguishes artifacts required for every run from artifacts
that are expected only on certain entry paths:

| Path pattern                               | Produced by                     | Why it matters                               |
| ------------------------------------------ | ------------------------------- | -------------------------------------------- |
| `docs/<KEY>.md`                            | `fetching-jira-ticket`          | Ticket snapshot and Jira context.            |
| `docs/<KEY>-tasks.md`                      | `planning-jira-tasks`           | Task source of truth and downstream status.  |
| `docs/<KEY>-task-<N>-brief.md`             | `planning-jira-task`            | Scope, context, and DoD.                     |
| `docs/<KEY>-task-<N>-execution-plan.md`    | `planning-jira-task`            | Approved implementation approach.            |
| `docs/<KEY>-task-<N>-test-spec.md`         | `planning-jira-task`            | Required behavior coverage.                  |
| `docs/<KEY>-task-<N>-refactoring-plan.md`  | `planning-jira-task`            | Approved prep/cleanup work.                  |
| `docs/<KEY>-task-<N>-decisions.md`         | `clarifying-assumptions`        | Expected after a full Phase 6 critique pass; optional only for direct or legacy execution paths. |

If any artifact marked as required is missing, stop before dispatching
subagents and tell the user which upstream skill must run first. If a
conditional artifact is absent, follow the note in its row instead of blocking
automatically.

In the normal orchestrated workflow, Phase 6 critique produces
`docs/<KEY>-task-<N>-decisions.md` before Phase 7 begins. The optional note
applies only when execution is entered directly or resumed from an older path
that predates the critique artifact.

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

| Subagent                | Required inputs                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `execution-starter`     | `TICKET_KEY`, `TASK_NUMBER`, ticket snapshot path, task plan path, execution brief path, optional readiness summaries |
| `task-executor`         | Brief path, execution plan path, test spec path, refactoring plan path, optional decisions path, optional fix brief, optional previous report |
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

1. Execution kickoff either moved the Jira subtask to `In Progress` or reported
   clearly why that step was skipped.
2. Category B changes are committed.
3. The task section in `docs/<KEY>-tasks.md` includes:
   - `**Status:** ✅ Complete (<date>)`
   - `**Implementation summary:**`
   - `**Files changed:**`
4. If a `## Jira Subtasks` table exists, the selected row is updated to `Done`.
5. Optional Jira transition/comment work is either completed or reported as
   skipped with a reason.
