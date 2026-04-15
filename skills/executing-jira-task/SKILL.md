---
name: "executing-jira-task"
description: 'Execute exactly one planned Jira workflow task using pre-produced planning and critique artifacts and a specialist pipeline. Use when the user says "execute task 2", "implement task 4", "work on task 1 for PROJ-123", or when `orchestrating-jira-workflow` reaches Phase 7 for a task. Requires the four Phase 5 artifacts and two Phase 6 artifacts from `planning-jira-task` and `clarifying-assumptions` (critique mode). Phase 7 begins with an explicit execution kickoff, the first mutation boundary after critique approval, that performs readiness checks and Jira-side startup updates when appropriate, then continues through implementation, review gates, and reporting for one task only.'
---

# Executing Jira Task

This skill is the per-task execution orchestrator for the Jira workflow. It
does exactly three things: **validate** that the selected task is ready,
**dispatch** the right specialist for each phase, and **decide** whether to
advance, run a targeted fix cycle, or escalate.

**Execution kickoff** is the first point at which the workflow may mutate Jira
state or otherwise cross from critique-only work into active execution.
Everything through Phase 6 remains critique and planning on disk; **kickoff is
the first execution mutation boundary after the user approves implementation**,
consistent with the parent orchestrator's task-loop readiness gate. The
orchestrator running this skill keeps only concise summaries in memory;
subagents do the heavy work in isolation.

## Inputs

| Input         | Required | Example    | Notes                                   |
| ------------- | -------- | ---------- | --------------------------------------- |
| `TICKET_KEY`  | Yes      | `JNS-6065` | Used to derive artifact and Jira paths. |
| `TASK_NUMBER` | Yes      | `3`        | Exactly one task per invocation.        |

### Required artifacts (normal Phase 7 path)

These match the parent orchestrator's **6 → 7 readiness** gate for per-task
execution:

| Artifact                                  | Phase | Required | Purpose                                    |
| ----------------------------------------- | ----- | -------- | ------------------------------------------ |
| `docs/<TICKET_KEY>.md`                           | 1     | Yes      | Ticket snapshot and Jira context.          |
| `docs/<TICKET_KEY>-tasks.md`                     | 2–4   | Yes      | Task plan, `## Jira Subtasks`, statuses.   |
| `docs/<TICKET_KEY>-task-<N>-brief.md`            | 5     | Yes      | Scope, DoD, and execution constraints.     |
| `docs/<TICKET_KEY>-task-<N>-execution-plan.md`   | 5     | Yes      | Approved implementation approach.          |
| `docs/<TICKET_KEY>-task-<N>-test-spec.md`        | 5     | Yes      | Required behavior coverage.                |
| `docs/<TICKET_KEY>-task-<N>-refactoring-plan.md` | 5     | Yes      | Approved structural prep and cleanup.      |
| `docs/<TICKET_KEY>-task-<N>-critique.md`         | 6     | Yes      | Task-level critique record.                |
| `docs/<TICKET_KEY>-task-<N>-decisions.md`        | 6     | Yes      | Critique outcomes and confirmed decisions. |

Read `./references/contracts.md` when validating task readiness or artifact
shape.

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
| `execution-starter`     | `./subagents/execution-starter.md`     | Execution kickoff: readiness, workspace checks, and first Jira-side startup updates (transition, comments) when appropriate. |
| `task-executor`         | `./subagents/task-executor.md`         | Implements the scoped change and tests from the approved planning artifacts.   |
| `documentation-writer`  | `./subagents/documentation-writer.md`  | Adds in-code documentation, commits Category B files, updates `docs/<TICKET_KEY>-tasks.md`, and performs optional Jira completion updates on the subtask. |
| `requirements-verifier` | `./subagents/requirements-verifier.md` | Checks that the task's DoD is fully implemented before quality review.         |
| `clean-code-reviewer`   | `./subagents/clean-code-reviewer.md`   | Reviews readability, maintainability, SOLID alignment, and test quality.       |
| `architecture-reviewer` | `./subagents/architecture-reviewer.md` | Reviews domain boundaries, composition, and architectural fit.                 |
| `security-auditor`      | `./subagents/security-auditor.md`      | Audits the committed change set for exploitable security weaknesses.           |

Use this registry as a lookup table. Read exactly one subagent definition per
dispatch, then pass only the inputs that subagent needs.

## How This Skill Works

The orchestrator uses direct reads only to load this skill, the reference file
for the current phase, and the specific subagent it is about to dispatch.
Everything else is delegated. Pass file paths and short summaries between
subagents instead of raw file contents or command output.

In practice, the orchestrator does only three kinds of work directly: load the
current instructions, dispatch the next specialist, and carry forward the smallest
summary needed for the next decision. Execution, mutation, analysis, and
artifact updates stay inside the specialist subagents.

Every task run follows the same validation loop: confirm readiness, cross the
**kickoff mutation boundary** deliberately after critique approval, verify
Definition of Done coverage before the review gates, and re-run only the failing
phase when a targeted fix is needed.

Treat artifacts in two categories:

- **Category A:** `docs/<TICKET_KEY>*.md`, progress files, briefs, plans, test
  specs,
  refactoring plans, critique, and decisions. Stay on disk, never committed,
  never deleted.
- **Category B:** source code, tests, config, in-code documentation. Committed
  normally.

If a selected task is already complete, blocked by unmet prerequisites, or
produces a repeated unresolved blocker, stop and report that state instead of
forcing the pipeline forward.

## Output Contract

After a successful run, this skill leaves behind these deliverables:

- **Category B implementation artifacts:** committed source code, tests, config
  changes, and in-code documentation.
- **Category A orchestration artifacts:** updated on disk but left uncommitted,
  including task status, implementation summary, file list, and optional Jira
  tracking.
- **Kickoff summary:** a returned `KICKOFF_REPORT` covering readiness,
  workspace state, and Jira kickoff actions (or documented skips).
- **Task-only completion report:** a concise user-facing report summarising the
  selected task's execution, commits, and gate verdicts.

## Phase Guide

| When you need...                                      | Read...                                |
| ----------------------------------------------------- | -------------------------------------- |
| Artifact contracts and task readiness checks          | `./references/contracts.md`            |
| Normal execution flow, kickoff, fix-loop order        | `./references/pipeline.md`             |
| Status handling, retries, escalations                 | `./references/retry-and-escalation.md` |
| Shared reviewer expectations                          | `./references/review-gate-policy.md`   |

## Execution Steps

1. Read `./references/contracts.md` and confirm the task is ready to cross the
   execution boundary (including Phase 7 precondition alignment with the parent
   orchestrator when invoked from that workflow).
2. Read `./references/pipeline.md` and follow its normal run order exactly.
3. Dispatch only the next required subagent, passing explicit inputs and
   keeping only structured summaries in orchestration context.
4. When a blocker, missing prerequisite, or failing gate appears, read the
   relevant recovery reference from `## Phase Guide` and run only the targeted
   retry or escalation path.
5. Report the selected task's outcome once the pipeline finishes or stops. Do
   not auto-continue to the next task.

## Operating Constraints

- Execute one task per invocation, then stop and wait for a new invocation for
  the next task.
- Keep the task plan as the source of truth. If execution reveals a plan change
  is needed, escalate instead of silently rewriting the plan.
- Preserve Category A artifacts on disk and out of git history.
- Keep fix cycles targeted. Re-run only the failing verification or review
  steps, not the entire pipeline.
- Treat missing required skills, missing tracker capability, or unresolved
  ambiguity as orchestration decisions. Surface them clearly and stop.

## Example

<example>
Happy path

Input:
- `TICKET_KEY=JNS-6065`
- `TASK_NUMBER=3`

1. Validate Phase 5 + 6 artifacts exist; Task 3 is not already complete.
2. Dispatch `execution-starter` to confirm readiness and perform the first side effects.
   - `KICKOFF_REPORT` -> `READY`
3. Dispatch `task-executor` with the artifact paths.
   - `EXECUTION_REPORT` -> `COMPLETE`
4. Dispatch `documentation-writer` with `EXECUTION_REPORT`, `TICKET_KEY`, and `TASK_NUMBER`.
5. Dispatch `requirements-verifier`.
   - `VERIFICATION_RESULT` -> `PASS`
6. Run `clean-code-reviewer`, then `architecture-reviewer`, then `security-auditor`.
   - All gates return a pass variant
7. Report the kickoff outcome, final verdicts, commits, files changed, and any skipped Jira updates.
</example>

<example>
Targeted fix path

Input:
- `TICKET_KEY=JNS-6065`
- `TASK_NUMBER=3`

1. `execution-starter` returns `READY`.
2. `task-executor` returns `COMPLETE`.
3. `documentation-writer` returns `COMPLETE`.
4. `requirements-verifier` returns `FAIL` because one DoD item is still untested.
5. Re-dispatch `task-executor` with only the verifier gap summary.
6. Re-dispatch `documentation-writer` for the new Category B delta.
7. Re-run `requirements-verifier`.
   - `VERIFICATION_RESULT` -> `PASS`
8. Continue into the review gates, and if one gate returns `NEEDS FIXES`, re-run
   only that gate's targeted fix cycle instead of the whole pipeline.
</example>
