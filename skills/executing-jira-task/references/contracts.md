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

## Required upstream artifacts

These files must exist before the execution pipeline can start:

| Path pattern                               | Produced by                     | Why it matters                               |
| ------------------------------------------ | ------------------------------- | -------------------------------------------- |
| `docs/<KEY>.md`                            | `fetching-jira-ticket`          | Ticket snapshot and Jira context.            |
| `docs/<KEY>-tasks.md`                      | `planning-jira-tasks`           | Task source of truth and downstream status.  |
| `docs/<KEY>-task-<N>-brief.md`             | `planning-jira-task`            | Scope, context, and DoD.                     |
| `docs/<KEY>-task-<N>-execution-plan.md`    | `planning-jira-task`            | Approved implementation approach.            |
| `docs/<KEY>-task-<N>-test-spec.md`         | `planning-jira-task`            | Required behavior coverage.                  |
| `docs/<KEY>-task-<N>-refactoring-plan.md`  | `planning-jira-task`            | Approved prep/cleanup work.                  |
| `docs/<KEY>-task-<N>-decisions.md`         | `clarifying-assumptions`        | Optional per-task clarifications.            |

If any required file is missing, stop before dispatching subagents and tell the
user which upstream skill must run first.

## Task readiness checklist

Confirm all of the following before phase 1:

1. `docs/<KEY>-tasks.md` contains a `## Task <N>:` section for the selected
   task.
2. The task is not already marked complete unless the user explicitly asked to
   re-run or revise it.
3. Any dependencies or prerequisite tasks referenced in the plan are already
   marked complete.
4. The task section still matches the planning artifacts. If the plan and the
   per-task artifacts disagree materially, stop and escalate.
5. A Jira subtask key is optional. Missing Jira linkage does not block code
   execution; it only affects tracking updates later.

## Dispatch contracts

Pass structured inputs only. Use file paths when the downstream specialist can
read the source artifact itself; use short reports when the downstream step
needs a prior verdict or summary.

| Subagent                | Required inputs                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
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

1. Category B changes are committed.
2. The task section in `docs/<KEY>-tasks.md` includes:
   - `**Status:** ✅ Complete (<date>)`
   - `**Implementation summary:**`
   - `**Files changed:**`
3. If a `## Jira Subtasks` table exists, the selected row is updated to `Done`.
4. Optional Jira transition/comment work is either completed or reported as
   skipped with a reason.
