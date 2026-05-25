# Contracts and Preconditions

> Read this file when validating task readiness or interpreting pipeline
> artifacts.
>
> Reminder: the orchestrator coordinates; subagents produce the work and return
> concise summaries.

This file is the local source of truth for required artifacts, kickoff
semantics, and dispatch shapes. For background on idempotent operations, the
feature-branch model, or Jira subtask semantics, see
`./external-sources.md`.

## Required input shape

The orchestrator starts with exactly two explicit inputs:

| Input         | Required | Example    |
| ------------- | -------- | ---------- |
| `TICKET_KEY`  | Yes      | `JNS-6065` |
| `TASK_NUMBER` | Yes      | `3`        |

All standard artifact paths derive from `TICKET_KEY` and `TASK_NUMBER`.

## Required artifacts

| Path pattern | Why it matters |
| ------------ | -------------- |
| `docs/<TICKET_KEY>.md` | Ticket snapshot and Jira context. |
| `docs/<TICKET_KEY>-tasks.md` | Task source of truth, `## Jira Subtasks`, per-task `Jira Subtask:` lines, and planner-generated branch names. |
| `docs/<TICKET_KEY>-task-<N>-brief.md` | Scope, context, and DoD. |
| `docs/<TICKET_KEY>-task-<N>-execution-plan.md` | Approved implementation approach. |
| `docs/<TICKET_KEY>-task-<N>-test-spec.md` | Required behavior coverage. |
| `docs/<TICKET_KEY>-task-<N>-refactoring-plan.md` | Approved prep and cleanup work. |
| `docs/<TICKET_KEY>-task-<N>-critique.md` | Task-level critique record. |
| `docs/<TICKET_KEY>-task-<N>-decisions.md` | Decisions and confirmed plan after critique. |

If any required artifact is missing, stop before dispatching subagents and name
which upstream phase or skill must run first.

## Task readiness checklist

Confirm all of the following before kickoff:

1. `docs/<TICKET_KEY>-tasks.md` contains a `## Task <N>:` heading consistent
   with the plan format.
2. The task is not already marked complete unless the user asked to re-run.
3. Prerequisite tasks referenced in the plan are already complete.
4. Per-task planning artifacts align with the task section. Material conflicts
   between plan and per-task files: stop and escalate.
5. Questions for the selected task are resolved, explicitly waived, or
   recorded as conscious follow-ups.
6. If `docs/<TICKET_KEY>-task-<N>-decisions.md` differs from the Phase 2 task
   plan, treat `decisions.md` as authoritative.
7. **Jira subtask reference** (optional for code work, required for full
   traceability): resolve from the task section's
   `Jira Subtask: <SUBTASK_KEY>` line first, or from the matching row in
   `## Jira Subtasks` if the inline line is absent. Missing Jira linkage does
   not block local implementation; it limits what `execution-starter` and
   `documentation-writer` can do for Jira-side updates.
8. **Planner-generated branch name** (required): resolve from the selected
   task section's `**Branch name:**` line first, or from the matching row in
   `## Execution Order Summary`. Missing or conflicting branch names block
   kickoff. In current-subtask mode, the repeated branch for the selected task
   row is the branch to enter.

## Execution kickoff boundary

Kickoff is the **first execution mutation boundary after critique approval**.
Before kickoff, do not transition Jira subtasks or post start-of-execution
comments.

At kickoff, the workflow may:

- confirm or adjust branch/worktree readiness when policy is explicit
- switch or check out the planner-generated branch for the selected task
- apply dirty-worktree handling only when the policy is clear
- perform Jira-side startup updates when a concrete subtask exists
  (transition to `In Progress`, optional kickoff comment)

If tracker capability is unavailable, record skips in the kickoff report and
continue when the workspace is otherwise ready.

Kickoff is **idempotent**: if startup conditions are already satisfied or
Jira state already reflects `In Progress`, record the current state and
continue rather than reapplying mutations. See `./external-sources.md` for
the idempotency reference.

## Dispatch contracts

Pass structured inputs only. Use file paths when the downstream specialist can
read the source artifact itself; use short reports when the downstream step
needs a prior verdict.

Symbolic handoff names (`KICKOFF_REPORT`, `EXECUTION_REPORT`, etc.) refer to
the full markdown outputs returned by those subagents. `FINAL_TASK_REPORT`
refers to the full markdown output returned by this skill to the parent
orchestrator. `EXECUTION_REPORT` and `DOCUMENTATION_REPORT` may carry
blocked-state information; downstream steps must preserve those statuses instead
of inferring success from partial file changes.

| Subagent | Required inputs |
| -------- | --------------- |
| `execution-starter` | `TICKET_KEY`, `TASK_NUMBER`, ticket snapshot path, task plan path with branch names, execution brief path |
| `task-executor` | Paths to brief, execution plan, test spec, refactoring plan, decisions; optional critique, fix brief, previous execution report |
| `documentation-writer` | `EXECUTION_REPORT`, `TICKET_KEY`, `TASK_NUMBER` |
| `requirements-verifier` | Brief path, test spec path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT` |
| `clean-code-reviewer` | Brief, test spec, refactoring plan paths, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT` |
| `architecture-reviewer` | Brief, execution plan paths, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW` |
| `security-auditor` | Brief path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW`, `ARCHITECTURE_REVIEW` |

## Artifact lifecycle

| Category | Contents | Git behavior | Lifecycle |
| -------- | -------- | ------------ | --------- |
| A | `docs/<TICKET_KEY>*.md`, briefs, plans, test specs, refactoring plans, critique, decisions | Keep out of git history | Never deleted |
| B | Source, tests, config, in-code docs | Changed by this workflow | Normal project rules |

`documentation-writer` may update Category A artifacts on disk so the workflow
can resume later; those files stay out of git history.

## Successful completion contract

After a successful run, all of these should be true:

1. `FINAL_TASK_REPORT` has status `COMPLETE`.
2. `EXECUTION_REPORT` and `DOCUMENTATION_REPORT` indicate successful
   completion rather than blocked partial progress.
3. Execution kickoff either performed the planned Jira startup actions or
   reported clearly why each was skipped.
4. Category B changes are present and reflected in the reports.
5. The task section in `docs/<TICKET_KEY>-tasks.md` includes completion
   metadata (status, implementation summary, files changed).
6. If `## Jira Subtasks` exists, the selected row is updated to reflect
   current Jira state, typically `Done` after successful completion.
7. Optional Jira completion updates are completed or reported as skipped.
8. The final report includes the parent-retained completion/blocker verdict,
   quality-gate summary, and implementation artifact summary.

Partial progress alone does not satisfy successful completion. If a required
step or validation could not run because of a missing capability or
prerequisite, the task remains blocked.

## Final task report contract

Every terminal path returns `FINAL_TASK_REPORT` with exactly one status:

| Status | Meaning | Parent orchestrator interpretation |
| ------ | ------- | ---------------------------------- |
| `COMPLETE` | The selected task completed implementation, documentation/tracking, requirements verification, and quality gates. | Mark Phase 7 complete for this task. |
| `BLOCKED` | The selected task cannot proceed because a prerequisite, capability, workspace state, tracker action, or required handoff is missing or unsafe. | Record a Phase 7 resume point and surface the blocker. |
| `STOPPED_FOR_USER_INPUT` | The next safe step requires a user or upstream planning decision. | Pause without treating the task as complete. |
| `ESCALATED` | A retry budget was exhausted or the recovery path is unsafe. | Stop Phase 7 and present accumulated findings. |

The report must include:

- Evidence checked: kickoff, execution, documentation/tracking, requirements,
  and quality gate verdicts that ran.
- Retry counts: requirements, clean-code, architecture, and security attempts,
  using `0` for gates that never entered a fix cycle.
- Changed files: Category B paths or `None`.
- Category A tracking paths: updated workflow artifacts or `None`.
- Tracker updates: Jira startup/completion actions taken or skipped.
- Blockers or unresolved items.
- Next required action.
