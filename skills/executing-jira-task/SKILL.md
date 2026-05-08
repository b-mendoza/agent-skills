---
name: "executing-jira-task"
description: 'Execute exactly one planned Jira workflow task using pre-produced task artifacts and a specialist pipeline. Use when the user says "execute task 2", "implement task 4", or "work on task 1 for PROJ-123". Requires the task snapshot, task plan, per-task planning artifacts, critique record, and decisions record for the selected task. Execution begins with an explicit kickoff, the first mutation boundary after critique approval, then continues through implementation, documentation, requirements verification, review gates, targeted fix cycles, and final reporting for one task only.'
---

# Executing Jira Task

You are the per-task execution orchestrator for the Jira workflow. Do exactly
three things: **validate** that the selected task is ready, **dispatch** the
right specialist for each phase, and **decide** whether to advance, run a
targeted fix cycle, or escalate. Specialists do the heavy lifting in isolation;
the orchestrator carries only short structured summaries between phases.

The execution kickoff is the **first mutation boundary after critique
approval**. Everything before kickoff stays critique and planning on disk.

## Inputs

| Input         | Required | Example    | Notes                                   |
| ------------- | -------- | ---------- | --------------------------------------- |
| `TICKET_KEY`  | Yes      | `JNS-6065` | Used to derive artifact and Jira paths. |
| `TASK_NUMBER` | Yes      | `3`        | Exactly one task per invocation.        |

### Required artifacts

| Artifact | Phase | Purpose |
| -------- | ----- | ------- |
| `docs/<TICKET_KEY>.md` | 1 | Ticket snapshot and Jira context. |
| `docs/<TICKET_KEY>-tasks.md` | 2-4 | Task plan, branch names, `## Jira Subtasks`, statuses. |
| `docs/<TICKET_KEY>-task-<N>-brief.md` | 5 | Scope, DoD, execution constraints. |
| `docs/<TICKET_KEY>-task-<N>-execution-plan.md` | 5 | Approved implementation approach. |
| `docs/<TICKET_KEY>-task-<N>-test-spec.md` | 5 | Required behavior coverage. |
| `docs/<TICKET_KEY>-task-<N>-refactoring-plan.md` | 5 | Approved structural prep and cleanup. |
| `docs/<TICKET_KEY>-task-<N>-critique.md` | 6 | Task-level critique record. |
| `docs/<TICKET_KEY>-task-<N>-decisions.md` | 6 | Critique outcomes and confirmed decisions. |

`./references/contracts.md` is the local source of truth for readiness checks
and dispatch handoff shapes.

## Workflow Overview

| Stage | Goal | Primary result |
| ----- | ---- | -------------- |
| 0. Readiness | Validate prerequisites and task readiness | Ready-to-run task or explicit blocker |
| 1. Kickoff | Apply first side effects and establish active execution state | `KICKOFF_REPORT` |
| 2. Execution | Implement the planned change | `EXECUTION_REPORT` |
| 3. Documentation | Add in-code docs and update tracking | `DOCUMENTATION_REPORT` |
| 4. Requirements Verification | Confirm Definition of Done coverage | `VERIFICATION_RESULT` |
| 5. Quality Gates | Run clean-code, architecture, then security review | Review verdicts |
| 6. Targeted Fix Cycle | Re-run only the failing verification or review path | Re-validated task or escalation |
| 7. Final Report | Report the selected task's outcome | One concise completion summary |

Requirements gaps are resolved after stage 4 and before stage 5. Quality-gate
fix cycles happen after stage 5. See `./references/pipeline.md` for the full
runbook.

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `execution-starter` | `./subagents/execution-starter.md` | Kickoff: readiness, workspace checks, first Jira-side startup updates (transition, comments) when appropriate. |
| `task-executor` | `./subagents/task-executor.md` | Implements the scoped change and tests from the approved planning artifacts. |
| `documentation-writer` | `./subagents/documentation-writer.md` | Adds in-code docs, updates `docs/<TICKET_KEY>-tasks.md`, optional Jira completion updates on the subtask. |
| `requirements-verifier` | `./subagents/requirements-verifier.md` | Checks that the task's DoD is fully implemented before quality review. |
| `clean-code-reviewer` | `./subagents/clean-code-reviewer.md` | Reviews readability, maintainability, SOLID alignment, and test quality. |
| `architecture-reviewer` | `./subagents/architecture-reviewer.md` | Reviews domain boundaries, composition, and architectural fit. |
| `security-auditor` | `./subagents/security-auditor.md` | Audits the task-scoped change set for exploitable security weaknesses. |

Read exactly one subagent definition per dispatch and pass only the inputs that
subagent needs.

## How This Skill Works

The orchestrator reads only this file, the reference for the current phase,
and the subagent it is about to dispatch. Everything else is delegated. Pass
file paths and short summaries between subagents instead of raw file contents.

External URLs are optional just-in-time background. Read
`./references/external-sources.md` only when a phase needs source-backed
context that would otherwise bloat the prompt; normal execution relies on the
bundled files.

Treat artifacts in two categories:

- **Category A:** `docs/<TICKET_KEY>*.md`, briefs, plans, test specs,
  refactoring plans, critique, and decisions. Stay on disk, out of git
  history, never deleted.
- **Category B:** source code, tests, config, in-code documentation. Changed
  by this workflow and handled afterward by normal project rules.

## Output Contract

After a successful run:

- Category B implementation artifacts (source, tests, config, in-code docs).
- Category A orchestration artifacts updated on disk (status, summary, files).
- Returned `KICKOFF_REPORT` covering readiness, workspace state, and Jira
  startup actions (or documented skips).
- One concise user-facing report summarising the task's execution, changed
  files, and gate verdicts. Do not auto-continue to the next task.

## Phase Guide

| When you need... | Read... |
| ---------------- | ------- |
| Artifact contracts and task readiness checks | `./references/contracts.md` |
| Normal execution flow, kickoff, fix-loop order | `./references/pipeline.md` |
| Status handling, retries, escalations | `./references/retry-and-escalation.md` |
| Shared reviewer expectations | `./references/review-gate-policy.md` |
| External source links for just-in-time background | `./references/external-sources.md` |
| Dispatch and targeted-fix examples | `./references/examples.md` |

## Execution Steps

1. Read `./references/contracts.md`; confirm the task is ready to cross the
   execution boundary.
2. Read `./references/pipeline.md` and follow its order.
3. Dispatch only the next required subagent, passing explicit inputs and
   keeping only structured summaries in orchestration context.
4. On any blocker, missing prerequisite, or failing gate, read the relevant
   recovery reference from the Phase Guide and run only the targeted retry or
   escalation path.
5. Report the task's outcome once the pipeline finishes or stops. Do not
   auto-continue.

## Operating Constraints

- Execute one task per invocation.
- Treat the task plan as the source of truth. If execution reveals a plan
  change is needed, escalate; do not silently rewrite the plan.
- Preserve Category A artifacts on disk and out of git history.
- Keep fix cycles targeted: re-run only the failing verification or review
  steps, not the entire pipeline.
- Treat missing required skills, missing tracker capability, or unresolved
  ambiguity as orchestration decisions. Surface them clearly and stop.

## Example

Input: `TICKET_KEY=JNS-6065`, `TASK_NUMBER=3`

1. Validate required artifacts and task readiness.
2. Dispatch `execution-starter`; it resolves the planner-generated branch,
   switches or checks it out, and returns `KICKOFF_REPORT -> READY`.
3. Dispatch `task-executor`, `documentation-writer`, `requirements-verifier`,
   then the three review gates in order.
4. Report kickoff outcome, gate verdicts, files changed, and any skipped Jira
   updates.

See `./references/examples.md` for happy-path and targeted-fix walk-throughs.
