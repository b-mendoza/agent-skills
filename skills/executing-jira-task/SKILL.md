---
name: "executing-jira-task"
description: 'Execute exactly one planned Jira task using pre-produced planning artifacts and a specialist pipeline. Use when the user says "execute task 2", "implement task 4", "work on task 1 for PROJ-123", or when `orchestrating-jira-workflow` reaches the per-task execution phase. Requires `docs/<TICKET_KEY>-tasks.md` from `planning-jira-tasks` plus per-task artifacts from `planning-jira-task`. Phase 7 begins with an explicit execution kickoff that performs readiness checks and the first execution-side mutations, then continues through implementation, review gates, and reporting for one task only.'
---

# Executing Jira Task

This skill is the per-task execution orchestrator for a Jira workflow. It does
exactly three things: **validate** that the selected task is ready, **dispatch**
the right specialist for each phase, and **decide** whether to advance, run a
targeted fix cycle, or escalate. Phase 7 starts with an explicit
**execution kickoff**: the first execution-side mutation boundary where the
workflow confirms readiness, applies safe startup state changes, and only then
hands off to the implementer. The orchestrator keeps only concise summaries in
memory; the subagents do the heavy work in isolation.

## Inputs

| Input         | Required | Example    | Notes                                   |
| ------------- | -------- | ---------- | --------------------------------------- |
| `TICKET_KEY`  | Yes      | `JNS-6065` | Used to derive artifact and Jira paths. |
| `TASK_NUMBER` | Yes      | `3`        | Exactly one task per invocation.        |

### Required artifacts

| Artifact                                  | Required | Purpose                                      |
| ----------------------------------------- | -------- | -------------------------------------------- |
| `docs/<KEY>.md`                           | Yes      | Ticket snapshot and Jira context.            |
| `docs/<KEY>-tasks.md`                     | Yes      | Source of truth for task selection/status.   |
| `docs/<KEY>-task-<N>-brief.md`            | Yes      | Scope, DoD, and execution constraints.       |
| `docs/<KEY>-task-<N>-execution-plan.md`   | Yes      | Approved implementation approach.            |
| `docs/<KEY>-task-<N>-test-spec.md`        | Yes      | Required behavior coverage.                  |
| `docs/<KEY>-task-<N>-refactoring-plan.md` | Yes      | Approved structural prep and cleanup.        |
| `docs/<KEY>-task-<N>-decisions.md`        | No       | Expected after Phase 6 critique; optional only for direct or legacy execution paths. |

Read `./references/contracts.md` when validating task readiness or artifact
shape.

## Output Contract

After a successful run, this skill leaves behind these deliverables:

- **Category B implementation artifacts:** committed source code, tests, config
  changes, and in-code documentation.
- **Category A orchestration artifacts:** updated on disk but left
  uncommitted, including task status, implementation summary, file list, and
  optional Jira tracking.
- **Kickoff summary:** a returned execution-kickoff record covering readiness,
  workspace state, and whether the Jira subtask was moved to `In Progress`.
- **Task-only completion report:** a concise user-facing report summarising the
  selected task's execution, commits, and gate verdicts.

## Workflow Overview

These are internal execution steps inside the parent workflow's Phase 7.
Read `./references/pipeline.md` for the full run -> check -> fix -> re-check
order and `./references/contracts.md` for readiness gates.

| Internal step | Goal                                          | Primary result                            |
| ------------- | --------------------------------------------- | ----------------------------------------- |
| 0             | Validate prerequisites and task readiness     | Ready-to-run task or explicit blocker     |
| 1             | Kick off execution and apply first side effects | `KICKOFF_REPORT`                        |
| 2             | Implement the planned change                  | `EXECUTION_REPORT`                        |
| 3             | Document, commit, and update tracking         | `DOCUMENTATION_REPORT`                    |
| 4             | Verify requirements coverage                  | `VERIFICATION_RESULT`                     |
| 5             | Run clean-code, architecture, security gates  | Review verdicts and actionable feedback   |
| 6             | Run targeted fix cycles only where needed     | Re-validated task or escalation           |
| 7             | Report final outcome to the user              | One concise task completion summary       |

Requirements gaps are resolved after internal step 4 and before internal step 5.
Quality-gate fix cycles happen after internal step 5.

## Subagent Registry

| Subagent                | Path                                   | Purpose                                                                        |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
| `execution-starter`     | `./subagents/execution-starter.md`     | Performs execution kickoff: readiness checks, safe startup state changes, and Jira `In Progress` transition when possible. |
| `task-executor`         | `./subagents/task-executor.md`         | Implements the scoped change and tests from the approved planning artifacts.   |
| `documentation-writer`  | `./subagents/documentation-writer.md`  | Adds in-code documentation, commits Category B files, and updates tracking.    |
| `requirements-verifier` | `./subagents/requirements-verifier.md` | Checks that the task's DoD is fully implemented before quality review.         |
| `clean-code-reviewer`   | `./subagents/clean-code-reviewer.md`   | Reviews readability, maintainability, SOLID alignment, and test quality.       |
| `architecture-reviewer` | `./subagents/architecture-reviewer.md` | Reviews domain boundaries, composition, and architectural fit.                 |
| `security-auditor`      | `./subagents/security-auditor.md`      | Audits the committed change set for exploitable security weaknesses.           |

Read only the subagent you are about to dispatch. Do not preload all
definitions.

## How This Skill Works

The orchestrator uses direct reads only to load this skill, the reference file
for the current phase, and the specific subagent it is about to dispatch.
Everything else is delegated. Pass file paths and short summaries between
subagents instead of raw file contents or command output.

Every task run follows the same validation loop: confirm readiness, cross the
execution boundary deliberately, verify Definition of Done coverage before the
review gates, and re-run only the failing phase when a targeted fix is needed.

Treat artifacts in two categories:

- **Category A: orchestration artifacts.** `docs/<KEY>*.md`, progress files,
  plans, briefs, test specs, refactoring plans, and decision logs. These stay
  on disk, are never committed, and are never deleted.
- **Category B: implementation artifacts.** Source code, tests, config changes,
  and in-code documentation. These are committed normally.

If a selected task is already complete, blocked by unmet prerequisites, or
produces a repeated unresolved blocker, stop and report that state instead of
forcing the pipeline forward.

## Phase Guide

| When you need...                                 | Read...                                   |
| ------------------------------------------------ | ----------------------------------------- |
| Artifact contracts and task readiness checks     | `./references/contracts.md`               |
| The normal execution flow, kickoff, and fix-loop order | `./references/pipeline.md`          |
| Status handling, retries, and user escalations   | `./references/retry-and-escalation.md`    |
| Shared reviewer expectations for quality gates   | `./references/review-gate-policy.md`      |

## Example

```markdown
Input:
- `TICKET_KEY=JNS-6065`
- `TASK_NUMBER=3`

1. Validate that `docs/JNS-6065-task-3-*.md` artifacts exist and Task 3 is not complete.
2. Dispatch `execution-starter` to confirm readiness and perform the first side effects.
   - `KICKOFF_REPORT` -> `READY`
3. Dispatch `task-executor` with the artifact paths.
   - `EXECUTION_REPORT` -> `COMPLETE`
4. Dispatch `documentation-writer` with `EXECUTION_REPORT`, `TICKET_KEY`, and `TASK_NUMBER`.
5. Dispatch `requirements-verifier`.
   - `VERIFICATION_RESULT` -> `PASS`
6. Run `clean-code-reviewer`, then `architecture-reviewer`, then `security-auditor`.
   - Example gate path: `clean-code-reviewer` -> `NEEDS FIXES`
7. If one or more review gates return `NEEDS FIXES`, consolidate only the blocking issues from the failing gates, re-dispatch `task-executor`, then `documentation-writer`, then re-run only those failing gates in order.
   - Re-run example: `clean-code-reviewer` -> `PASS WITH SUGGESTIONS`
8. Report the kickoff outcome, final verdicts, commits, files changed, and any skipped Jira updates.
```

## Operating Constraints

This skill stays reliable by keeping scope tight, preserving artifact
boundaries, and fixing only the phase that actually failed.

- Execute one task per invocation and stop after reporting the result.
- Keep the task plan as the source of truth. If execution reveals a plan change
  is needed, escalate instead of silently rewriting the plan.
- Preserve Category A artifacts on disk and out of git history.
- Keep fix cycles targeted. Re-run only the failing verification or review
  steps, not the entire pipeline.
- Treat missing required skills, missing MCP capability, or unresolved
  ambiguity as orchestration decisions. Surface them clearly and stop.
