---
name: "executing-jira-task"
description: 'Execute exactly one planned Jira task using pre-produced planning artifacts and a specialist pipeline. Use when the user says "execute task 2", "implement task 4", "work on task 1 for PROJ-123", or when `orchestrating-jira-workflow` reaches the per-task execution phase. Requires `docs/<TICKET_KEY>-tasks.md` plus per-task artifacts from `planning-jira-task`. Implements one task only, commits only implementation artifacts, updates orchestration artifacts on disk, and stops after reporting the result.'
---

# Executing Jira Task

This skill is the per-task execution orchestrator for a Jira workflow. It does
exactly three things: **validate** that the selected task is ready, **dispatch**
the right specialist for each phase, and **decide** whether to advance, run a
targeted fix cycle, or escalate. The orchestrator keeps only concise summaries
in memory; the subagents do the heavy work in isolation.

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
| `docs/<KEY>-task-<N>-decisions.md`        | No       | Per-task clarifications from critique steps. |

Read `./references/contracts.md` when validating task readiness or artifact
shape.

## Output Contract

After a successful run, this skill leaves behind:

- Category B implementation artifacts committed to git: source code, tests,
  config changes, and in-code documentation.
- Category A orchestration artifacts updated on disk but left uncommitted:
  task status, implementation summary, file list, and optional Jira tracking.
- A concise user-facing report summarising execution, commits, and gate
  verdicts for the selected task only.

## Workflow Overview

| Phase | Goal                                          | Primary result                            |
| ----- | --------------------------------------------- | ----------------------------------------- |
| 0     | Validate prerequisites and task readiness     | Ready-to-run task or explicit blocker     |
| 1     | Implement the planned change                  | `EXECUTION_REPORT`                        |
| 2     | Document, commit, and update tracking         | `DOCUMENTATION_REPORT`                    |
| 3     | Verify requirements coverage                  | `VERIFICATION_RESULT`                     |
| 4     | Run clean-code, architecture, security gates  | Review verdicts and actionable feedback   |
| 5     | Run targeted fix cycles only where needed     | Re-validated task or escalation           |
| 6     | Report final outcome to the user              | One concise task completion summary       |

## Subagent Registry

| Subagent                | Path                                   | Purpose                                                                        |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------ |
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
| The normal execution flow and fix-loop order     | `./references/pipeline.md`                |
| Status handling, retries, and user escalations   | `./references/retry-and-escalation.md`    |
| Shared reviewer expectations for quality gates   | `./references/review-gate-policy.md`      |

## Example

```markdown
Input:
- `TICKET_KEY=JNS-6065`
- `TASK_NUMBER=3`

1. Validate that `docs/JNS-6065-task-3-*.md` artifacts exist and Task 3 is not complete.
2. Dispatch `task-executor` with the artifact paths.
3. Dispatch `documentation-writer` with `EXECUTION_REPORT`, `TICKET_KEY`, and `TASK_NUMBER`.
4. Dispatch `requirements-verifier`.
5. Run `clean-code-reviewer`, then `architecture-reviewer`, then `security-auditor`.
6. If `clean-code-reviewer` and `security-auditor` return `NEEDS FIXES`, consolidate only those issues, re-dispatch `task-executor`, then `documentation-writer`, then re-run just those failing gates.
7. Report the final verdicts, commits, files changed, and any skipped Jira updates.
```

## Safety Rules

- Execute one task per invocation and stop after reporting the result.
- Keep the task plan as the source of truth. If execution reveals a plan change
  is needed, escalate instead of silently rewriting the plan.
- Preserve Category A artifacts on disk and out of git history.
- Keep fix cycles targeted. Re-run only the failing verification or review
  steps, not the entire pipeline.
- Treat missing required skills, missing MCP capability, or unresolved
  ambiguity as orchestration decisions. Surface them clearly and stop.
