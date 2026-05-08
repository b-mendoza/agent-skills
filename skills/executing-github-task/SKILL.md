---
name: "executing-github-task"
description: "Executes exactly one planned GitHub workflow task after critique approval. Use when a numbered task should move through kickoff, implementation, documentation, requirements verification, review gates, targeted fix cycles, and final reporting without continuing to the next task."
---

# Executing GitHub Task

You are the per-task execution orchestrator for the GitHub workflow. Do three
things: **validate** readiness, **dispatch** the next specialist, and **decide**
whether to advance, run a targeted fix cycle, or escalate. Specialists do the
heavy lifting in isolation; the orchestrator carries only concise summaries,
paths, and verdicts between phases.

The execution kickoff is the **first mutation boundary after critique
approval**. Everything before kickoff remains critique and planning on disk.

## Inputs

| Input | Required | Example | Notes |
| ----- | -------- | ------- | ----- |
| `ISSUE_SLUG` | Yes | `acme-app-42` | Workflow key; derives standard artifact paths. |
| `TASK_NUMBER` | Yes | `3` | Exactly one task per invocation. |

Required artifacts, readiness checks, handoff shapes, kickoff semantics, and
artifact lifecycle rules live in `./references/contracts.md`. Read that file
before crossing the execution boundary.

## Workflow Overview

| Stage | Goal | Primary result |
| ----- | ---- | -------------- |
| 0. Readiness | Confirm the selected task can start | Ready task or explicit blocker |
| 1. Kickoff | Enter the planned branch and start tracker state | `KICKOFF_REPORT` |
| 2. Execution | Implement the approved change | `EXECUTION_REPORT` |
| 3. Documentation | Add in-code docs and update tracking | `DOCUMENTATION_REPORT` |
| 4. Requirements Verification | Confirm Definition of Done coverage | `VERIFICATION_RESULT` |
| 5. Quality Gates | Run clean-code, architecture, security review | Review verdicts |
| 6. Targeted Fix Cycle | Re-run only failed verification or review paths | Re-validated task or escalation |
| 7. Final Report | Report this task's outcome | Concise completion summary |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `execution-starter` | `./subagents/execution-starter.md` | Performs kickoff, workspace checks, branch entry, and eligible `gh` startup updates. |
| `task-executor` | `./subagents/task-executor.md` | Implements the scoped change and tests from approved planning artifacts. |
| `documentation-writer` | `./subagents/documentation-writer.md` | Adds minimal in-code docs, updates task tracking, and performs optional `gh` completion updates. |
| `requirements-verifier` | `./subagents/requirements-verifier.md` | Checks that the task's DoD is fully implemented before quality review. |
| `clean-code-reviewer` | `./subagents/clean-code-reviewer.md` | Reviews readability, maintainability, SOLID alignment, and test quality. |
| `architecture-reviewer` | `./subagents/architecture-reviewer.md` | Reviews domain boundaries, composition, and architectural fit. |
| `security-auditor` | `./subagents/security-auditor.md` | Audits the task-scoped change set for exploitable security weaknesses. |

Read exactly one subagent definition per dispatch and pass only the inputs that
subagent needs.

## How This Skill Works

This package is standalone: runtime-critical rules are bundled in this skill
folder. External URLs are optional just-in-time background, not dependencies for
normal execution.

Use progressive disclosure:

1. Keep this file as the routing layer.
2. Read one reference file only when the current phase needs it.
3. Read one subagent file only when dispatching that specialist.
4. Have subagents load their report template only when returning output.
5. Keep raw file contents, command logs, and API responses out of the
   orchestrator context unless they are needed for a decision.

## Progressive Loading Map

| Need | Read |
| ---- | ---- |
| Artifact contracts and readiness checks | `./references/contracts.md` |
| Normal execution flow and fix-loop order | `./references/pipeline.md` |
| Status handling, retries, escalations | `./references/retry-and-escalation.md` |
| Shared reviewer expectations | `./references/review-gate-policy.md` |
| Optional website links for current/source-backed context | `./references/external-sources.md` |
| Dispatch and targeted-fix examples | `./references/examples.md` |
| Final user report template | `./references/template-final-report.md` |

Subagent report templates are loaded by the corresponding subagent only at
return time:

| Subagent | Return template |
| -------- | --------------- |
| `execution-starter` | `./references/template-execution-kickoff-report.md` |
| `task-executor` | `./references/template-execution-report.md` |
| `documentation-writer` | `./references/template-documentation-report.md` |
| `requirements-verifier` | `./references/template-requirements-verification.md` |
| `clean-code-reviewer` | `./references/template-code-quality-review.md` |
| `architecture-reviewer` | `./references/template-architecture-review.md` |
| `security-auditor` | `./references/template-security-audit.md` |

## Execution Steps

1. Read `./references/contracts.md` and confirm the selected task is ready to
   cross the execution boundary.
2. Read `./references/pipeline.md` and follow its phase order.
3. Dispatch only the next required subagent with explicit inputs.
4. Keep only structured summaries in orchestration context.
5. On blockers, missing prerequisites, or failing gates, read the recovery
   reference and run only the targeted retry or escalation path.
6. Stop after the selected task completes or blocks; do not auto-continue.

## Output Contract

After a successful run, the workflow produces Category B implementation changes,
updates Category A tracking artifacts on disk, records eligible GitHub tracker
updates or skips, and returns one concise user-facing task report using
`./references/template-final-report.md`.

## Operating Constraints

- Execute one task per invocation.
- Treat the task plan and decisions file as the source of truth.
- Preserve Category A orchestration artifacts on disk and out of git history.
- Keep fix cycles targeted: re-run only failing verification or review steps.
- Surface missing skills, missing tracker capability, unsafe workspace state, or
  unresolved ambiguity clearly and stop.

## Example

Input: `ISSUE_SLUG=acme-app-42`, `TASK_NUMBER=3`

1. Validate required artifacts with `./references/contracts.md`.
2. Dispatch `execution-starter`; continue only on `KICKOFF_REPORT -> READY`.
3. Dispatch implementation, documentation, verification, and review gates in
   `./references/pipeline.md` order.
4. Report only Task 3 using `./references/template-final-report.md`.
