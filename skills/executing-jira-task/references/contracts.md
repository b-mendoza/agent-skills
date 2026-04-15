# Contracts and Preconditions

> Read this file when validating task readiness or interpreting pipeline
> artifacts.
>
> Reminder: the orchestrator coordinates; subagents produce the work and
> return concise summaries.

## Alignment with the parent workflow

Phase 7 preconditions come from the parent orchestrator's data contracts
(per-task rows for phases 5–7) and its task-loop readiness section
(**6 → 7 readiness**). This file is the execution skill's authoritative
breakdown of paths, kickoff semantics, and dispatch inputs; it must not
contradict those parent contracts.[^1]

[^1]: The concrete parent orchestrator for this skill is
    `orchestrating-jira-workflow`. Its filesystem layout is intentionally
    unreferenced here so this skill stays portable across harnesses.

## Required input shape

The orchestrator starts with exactly two explicit inputs:

| Input         | Required | Example    |
| ------------- | -------- | ---------- |
| `TICKET_KEY`  | Yes      | `JNS-6065` |
| `TASK_NUMBER` | Yes      | `3`        |

All standard artifact paths derive from `TICKET_KEY` and `TASK_NUMBER`.

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
required before kickoff; the parent workflow's Phase 7 precondition check
expects the ticket snapshot, the task plan, the four Phase 5 files, and
`critique.md` plus `decisions.md`.

If any required artifact is missing, stop before dispatching subagents and name
which upstream phase or skill must run first.

## Task readiness checklist

Confirm all of the following before the kickoff step:

1. `docs/<KEY>-tasks.md` contains a `## Task <N>:` (or equivalent numbered task
   heading) for the selected task, consistent with the plan format.
2. The task is not already marked complete unless the user explicitly asked to
   re-run or revise it.
3. Dependencies or prerequisite tasks referenced in the plan are already
   complete where the plan requires it.
4. Per-task planning artifacts align with the task section. Material conflicts
   between plan and per-task files → stop and escalate.
5. Questions for the selected task are resolved, explicitly waived, or recorded
   as conscious follow-ups in the task plan or critique decisions.
6. If `docs/<KEY>-task-<N>-decisions.md` records a later decision that differs
   from the Phase 2 task plan, treat `decisions.md` as authoritative.
7. **Jira subtask reference** (optional for code work, required for full
   traceability): resolve from the task section's `Jira Subtask: <KEY>` line
   first, or from the matching row in `## Jira Subtasks` if the inline line is
   absent. Missing Jira linkage does not block local implementation; it limits
   what `execution-starter` and `documentation-writer` can do for Jira-side
   kickoff and completion updates.

## Execution kickoff boundary

Phase 7 kickoff inside `executing-jira-task` is the **first execution
mutation boundary after critique approval**. Before kickoff, do not transition
Jira subtasks or leave start-of-execution comments for the purpose of starting
implementation, except what the parent orchestrator already defined outside
this skill.

At kickoff, the workflow may:

- confirm or adjust branch/worktree readiness (when policy is explicit)
- apply dirty-worktree handling only when the policy is clear
- perform Jira-side startup updates when a concrete subtask exists, for example:
  - move the Jira subtask to `In Progress`
  - add a short comment when the brief or team policy calls for it

If tracker capability is unavailable, record skips in the kickoff report and
continue when the workspace is otherwise ready.

Everything after a `READY` kickoff assumes the task is actively in execution.

## Dispatch contracts

Pass structured inputs only. Use file paths when the downstream specialist can
read the source artifact itself; use short reports when the downstream step
needs a prior verdict or summary.

Symbolic handoff names (`KICKOFF_REPORT`, `EXECUTION_REPORT`, etc.) refer to
the full markdown outputs returned by those subagents.

`EXECUTION_REPORT` and `DOCUMENTATION_REPORT` may carry blocked-state
information. Downstream steps must preserve those statuses instead of inferring
success from partial file changes alone.

| Subagent                | Required inputs                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `execution-starter`     | `TICKET_KEY`, `TASK_NUMBER`, ticket snapshot path, task plan path, execution brief path; optional readiness summaries from the parent |
| `task-executor`         | Paths to brief, execution plan, test spec, refactoring plan, decisions path; optional critique path, fix brief, previous execution report |
| `documentation-writer`  | `EXECUTION_REPORT`, `TICKET_KEY`, `TASK_NUMBER`                                                                  |
| `requirements-verifier` | Brief path, test spec path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`                                           |
| `clean-code-reviewer`   | Brief path, test spec path, refactoring plan path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT` |
| `architecture-reviewer` | Brief path, execution plan path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW` |
| `security-auditor`      | Brief path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW`, `ARCHITECTURE_REVIEW` |

## Artifact lifecycle

| Category | Contents | Git behavior | Lifecycle |
| -------- | -------- | ------------ | --------- |
| A        | `docs/<KEY>*.md`, progress files, briefs, plans, test specs, refactoring plans, critique, decisions | Never committed | Never deleted |
| B        | Source, tests, config, in-code docs | Committed normally | Normal project rules |

`documentation-writer` may update Category A artifacts on disk so the
workflow can resume later, but those files stay out of git history.

## Successful completion contract

After a successful run, all of the following should be true:

1. `EXECUTION_REPORT` and `DOCUMENTATION_REPORT` both indicate successful
   completion rather than blocked partial progress.
2. Execution kickoff either moved the Jira subtask to `In Progress` or reported
   clearly why that step was skipped.
3. Category B changes are committed.
4. The task section in `docs/<KEY>-tasks.md` includes completion metadata
   consistent with your team template (e.g. status, implementation summary,
   files changed).
5. If a `## Jira Subtasks` table exists, the selected row is updated to `Done`.
6. Optional Jira transition/comment work is either completed or reported as
   skipped with a reason.

Partial progress alone does not satisfy successful completion. If a required
task step, test, or validation command could not run because a capability or
prerequisite was unavailable, the task remains blocked until that dependency is
resolved.
