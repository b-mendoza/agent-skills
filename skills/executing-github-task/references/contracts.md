# Contracts and Preconditions

> Read this file when validating task readiness or interpreting pipeline
> artifacts.
>
> Reminder: the orchestrator coordinates; subagents produce the work and return
> concise summaries.

This file is the local source of truth for required artifacts, kickoff
semantics, and dispatch shapes. For background on idempotent operations, the
feature-branch model, GitHub child-issue semantics, or `gh` syntax, see
`./external-sources.md`.

## Required input shape

The orchestrator starts with exactly two explicit inputs:

| Input         | Required | Example       |
| ------------- | -------- | ------------- |
| `ISSUE_SLUG`  | Yes      | `acme-app-42` |
| `TASK_NUMBER` | Yes      | `3`           |

All standard artifact paths derive from `ISSUE_SLUG` and `TASK_NUMBER`.

## Required artifacts

| Path pattern | Why it matters |
| ------------ | -------------- |
| `docs/<ISSUE_SLUG>.md` | Issue snapshot and GitHub context. |
| `docs/<ISSUE_SLUG>-tasks.md` | Task source of truth, `## GitHub Task Issues`, per-task `GitHub Task Issue:` lines, and planner-generated branch names. |
| `docs/<ISSUE_SLUG>-task-<N>-brief.md` | Scope, context, and DoD. |
| `docs/<ISSUE_SLUG>-task-<N>-execution-plan.md` | Approved implementation approach. |
| `docs/<ISSUE_SLUG>-task-<N>-test-spec.md` | Required behavior coverage. |
| `docs/<ISSUE_SLUG>-task-<N>-refactoring-plan.md` | Approved prep and cleanup work. |
| `docs/<ISSUE_SLUG>-task-<N>-critique.md` | Task-level critique record. |
| `docs/<ISSUE_SLUG>-task-<N>-decisions.md` | Decisions and confirmed plan after critique. |

If any required artifact is missing, stop before dispatching subagents and name
which upstream phase or skill must run first.

## Task readiness checklist

Confirm all of the following before kickoff:

1. `docs/<ISSUE_SLUG>-tasks.md` contains a `## Task <N>:` heading consistent
   with the plan format.
2. The task is not already marked complete unless the user asked to re-run.
3. Prerequisite tasks referenced in the plan are already complete.
4. Per-task planning artifacts align with the task section. Material conflicts
   between plan and per-task files: stop and escalate.
5. Questions for the selected task are resolved, explicitly waived, or
   recorded as conscious follow-ups.
6. If `docs/<ISSUE_SLUG>-task-<N>-decisions.md` differs from the Phase 2 task
   plan, treat `decisions.md` as authoritative.
7. **GitHub task issue reference** (optional for code work, required for full
   traceability): resolve from the task section's `GitHub Task Issue: <value>`
   line first, or from the matching row in `## GitHub Task Issues`. Values may
   be `owner/repo#number`, `Not Created`, or `task-list`. Missing or
   `Not Created` does not block local implementation; it limits what
   `execution-starter` and `documentation-writer` can do with `gh`.
8. **Planner-generated branch name** (required): resolve from the selected
   task section's `**Branch name:**` line first, or from the matching row in
   `## Execution Order Summary`. Missing or conflicting branch names block
   kickoff. In current-child-issue mode, the repeated branch for the selected
   task row is the branch to enter.

## Execution kickoff boundary

Kickoff is the **first execution mutation boundary after critique approval**.
Before kickoff, do not label, assign, or comment on GitHub issues for the
purpose of starting implementation.

At kickoff, the workflow may:

- confirm or adjust branch/worktree readiness when policy is explicit
- switch or check out the planner-generated branch for the selected task
- apply dirty-worktree handling only when the policy is clear
- perform GitHub-side startup updates via `gh` when a concrete task issue
  exists (labels, assignee, kickoff comment on child or parent, project or
  milestone updates only when the brief calls for them)

Use `gh` as the primary transport. If tracker capability is unavailable or
unauthenticated, record skips in the kickoff report and continue when the
workspace is otherwise ready.

Kickoff is **idempotent**: if GitHub already shows the intended "started"
state (label present, kickoff comment posted), record that and return `READY`
without duplicating mutations. See `./external-sources.md` for the
idempotency reference.

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
| `execution-starter` | `ISSUE_SLUG`, `TASK_NUMBER`, issue snapshot path, task plan path with branch names, execution brief path |
| `task-executor` | Paths to brief, execution plan, test spec, refactoring plan, decisions; optional critique, fix brief, previous execution report |
| `documentation-writer` | Mode-specific inputs; see below. |
| `requirements-verifier` | Brief path, test spec path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT` |
| `clean-code-reviewer` | Brief, test spec, refactoring plan paths, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT` |
| `architecture-reviewer` | Brief, execution plan paths, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW` |
| `security-auditor` | Brief path, `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW`, `ARCHITECTURE_REVIEW` |

`documentation-writer` mode inputs:

- `Mode=UPDATE_TRACKING`: `EXECUTION_REPORT`, `ISSUE_SLUG`, `TASK_NUMBER`,
  execution brief path, and task plan path.
- `Mode=FINALIZE_TRACKER`: `EXECUTION_REPORT`, previous
  `DOCUMENTATION_REPORT`, `VERIFICATION_RESULT`, `CODE_REVIEW`,
  `ARCHITECTURE_REVIEW`, `SECURITY_AUDIT`, `ISSUE_SLUG`, `TASK_NUMBER`,
  execution brief path, and task plan path.

## Artifact lifecycle

| Category | Contents | Git behavior | Lifecycle |
| -------- | -------- | ------------ | --------- |
| A1 | `docs/<ISSUE_SLUG>*.md`, briefs, plans, test specs, refactoring plans, critique, decisions | Keep out of git history | Preserve for resumability unless the user approves cleanup |
| B | Source, tests, config, in-code docs | Changed by this workflow | Normal project rules |

`documentation-writer` may update Category A1 artifacts on disk so the workflow
can resume later; those files stay out of git history.

## Successful completion contract

After a successful run, all of these should be true:

1. `FINAL_TASK_REPORT` has status `COMPLETE`.
2. `EXECUTION_REPORT`, `DOCUMENTATION_REPORT`, and `FINAL_TRACKING_REPORT`
   indicate successful completion rather than blocked partial progress.
3. Execution kickoff either performed the planned GitHub startup actions via
   `gh` or reported clearly why each was skipped.
4. Category B changes are present and reflected in the reports.
5. The task section in `docs/<ISSUE_SLUG>-tasks.md` includes completion
   metadata (status, implementation summary, files changed).
6. If `## GitHub Task Issues` exists, the row for this task is updated to
   reflect current tracker state or completion notes.
7. Optional `gh` completion steps (comment, child-issue close, label changes)
   are completed after requirements and quality gates pass, or reported as
   skipped with a reason.
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
  quality gate verdicts that ran, and final tracker completion when attempted.
- Retry counts: requirements, clean-code, architecture, and security attempts,
  using `0` for gates that never entered a fix cycle.
- Changed files: Category B paths or `None`.
- Category A tracking paths: updated workflow artifacts or `None`.
- Tracker updates: GitHub startup and final completion actions taken with `gh`
  or skipped.
- Blockers or unresolved items.
- Next required action.
