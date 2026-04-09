---
name: "executing-github-task"
description: 'Execute exactly one planned GitHub workflow task using pre-produced planning and critique artifacts and a specialist pipeline. Use when the user says "execute task 2", "implement task 4", "work on task 1 for acme-app-42", or when `orchestrating-github-workflow` reaches Phase 7 for a task. Requires the four Phase 5 artifacts and two Phase 6 artifacts from `planning-github-task` and `clarifying-assumptions` (critique mode). Phase 7 begins with an explicit execution kickoff—the first mutation boundary after critique approval—that performs readiness checks and GitHub-side startup updates via `gh`, then continues through implementation, review gates, and reporting for one task only.'
---

# Executing GitHub Task

This skill is the per-task execution orchestrator for the GitHub workflow. It
does exactly three things: **validate** that the selected task is ready,
**dispatch** the right specialist for each phase, and **decide** whether to
advance, run a targeted fix cycle, or escalate.

**Execution kickoff** is the first point at which the workflow may mutate GitHub
issue state or otherwise cross from critique-only work into active execution.
Everything through Phase 6 remains critique and planning on disk; **kickoff is
the first execution mutation boundary after the user approves implementation**
(see `../orchestrating-github-workflow/references/task-loop.md`). The
orchestrator running this skill keeps only concise summaries in memory;
subagents do the heavy work in isolation.

## Inputs

| Input          | Required | Example       | Notes                                      |
| -------------- | -------- | ------------- | ------------------------------------------ |
| `ISSUE_SLUG`   | Yes      | `acme-app-42` | Workflow key; derives artifact paths.      |
| `TASK_NUMBER`  | Yes      | `3`           | Exactly one task per invocation.           |

### Required artifacts (normal Phase 7 path)

These match the orchestrator **6 → 7 readiness** gate in
`../orchestrating-github-workflow/references/data-contracts.md`:

| Artifact                                      | Phase | Purpose                                      |
| --------------------------------------------- | ----- | -------------------------------------------- |
| `docs/<ISSUE_SLUG>.md`                        | 1     | Issue snapshot and GitHub context.           |
| `docs/<ISSUE_SLUG>-tasks.md`                  | 2–4   | Task plan, `## GitHub Task Issues`, statuses. |
| `docs/<ISSUE_SLUG>-task-<N>-brief.md`         | 5     | Scope, DoD, execution constraints.           |
| `docs/<ISSUE_SLUG>-task-<N>-execution-plan.md` | 5    | Approved implementation approach.            |
| `docs/<ISSUE_SLUG>-task-<N>-test-spec.md`     | 5     | Required behavior coverage.                  |
| `docs/<ISSUE_SLUG>-task-<N>-refactoring-plan.md` | 5  | Approved structural prep and cleanup.      |
| `docs/<ISSUE_SLUG>-task-<N>-critique.md`       | 6     | Task-level critique record.                  |
| `docs/<ISSUE_SLUG>-task-<N>-decisions.md`     | 6     | Critique outcomes and confirmed decisions.   |

Read `./references/contracts.md` when validating task readiness or artifact
shape.

## Workflow Overview

These are internal execution steps inside the parent workflow's Phase 7. Read
`./references/pipeline.md` for the full run → check → fix → re-check order and
`./references/contracts.md` for readiness gates.

| Internal step | Goal                                              | Primary result                          |
| ------------- | ------------------------------------------------- | --------------------------------------- |
| 0             | Validate prerequisites and task readiness       | Ready-to-run task or explicit blocker   |
| 1             | Kick off execution and apply first side effects   | `KICKOFF_REPORT`                        |
| 2             | Implement the planned change                      | `EXECUTION_REPORT`                      |
| 3             | Document, commit, and update tracking               | `DOCUMENTATION_REPORT`                  |
| 4             | Verify requirements coverage                        | `VERIFICATION_RESULT`                   |
| 5             | Run clean-code, architecture, security gates        | Review verdicts and actionable feedback |
| 6             | Run targeted fix cycles only where needed         | Re-validated task or escalation         |
| 7             | Report final outcome to the user                    | One concise task completion summary     |

Requirements gaps are resolved after internal step 4 and before internal step 5.
Quality-gate fix cycles happen after internal step 5.

## Subagent Registry

| Subagent                  | Path                                     | Purpose                                                                 |
| ------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `execution-starter`       | `./subagents/execution-starter.md`       | Execution kickoff: readiness, workspace checks, **first `gh`-based GitHub updates** (labels, assignees, comments, child-issue fields) when appropriate. |
| `task-executor`           | `./subagents/task-executor.md`           | Implements the scoped change and tests from the approved planning artifacts. |
| `documentation-writer`    | `./subagents/documentation-writer.md`    | In-code docs, commits Category B, updates `docs/<ISSUE_SLUG>-tasks.md`, optional `gh` completion updates on the task issue. |
| `requirements-verifier`   | `./subagents/requirements-verifier.md`   | Confirms DoD before quality review.                                     |
| `clean-code-reviewer`     | `./subagents/clean-code-reviewer.md`     | Readability, maintainability, SOLID alignment, test quality.            |
| `architecture-reviewer`   | `./subagents/architecture-reviewer.md`   | Domain boundaries, composition, architectural fit.                      |
| `security-auditor`      | `./subagents/security-auditor.md`        | Exploitable weaknesses in the committed change set.                   |

Use this registry as a lookup table. Read exactly one subagent definition per
dispatch, then pass only the inputs that subagent needs.

## How This Skill Works

The orchestrator uses direct reads only to load this skill, the reference file
for the current phase, and the specific subagent it is about to dispatch.
Everything else is delegated. Pass file paths and short summaries between
subagents instead of raw file contents or command output.

In practice, the orchestrator does only three kinds of work directly: load the
current instructions, dispatch the next specialist, and carry forward the
smallest summary needed for the next decision. Execution, mutation, analysis,
and artifact updates stay inside the specialist subagents.

Every task run follows the same validation loop: confirm readiness, cross the
**kickoff mutation boundary** deliberately after critique approval, verify
Definition of Done coverage before the review gates, and re-run only the failing
phase when a targeted fix is needed.

Treat artifacts in two categories:

- **Category A:** `docs/<ISSUE_SLUG>*.md`, progress files, briefs, plans, test
  specs, refactoring plans, critique, and decisions. Stay on disk, never
  committed, never deleted.
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
  including task status, implementation summary, file list, and optional
  GitHub tracking updates recorded in the plan.
- **Kickoff summary:** a returned `KICKOFF_REPORT` covering readiness,
  workspace state, and GitHub kickoff actions (or documented skips).
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
   execution boundary (including Phase 7 precondition alignment with
   `orchestrating-github-workflow` when invoked from that skill).
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
- Treat missing required skills, missing tooling (`gh` auth), or unresolved
  ambiguity as orchestration decisions. Surface them clearly and stop.

## Example

```markdown
Input:
- `ISSUE_SLUG=acme-app-42`
- `TASK_NUMBER=3`

1. Validate Phase 5 + 6 artifacts exist; Task 3 is not already complete.
2. Dispatch `execution-starter` for kickoff (first `gh` mutations after critique).
   - `KICKOFF_REPORT` -> `READY`
3. Dispatch `task-executor` with artifact paths under `docs/acme-app-42-task-3-*.md`.
   - `EXECUTION_REPORT` -> `COMPLETE`
4. Dispatch `documentation-writer` with `EXECUTION_REPORT`, `ISSUE_SLUG`, `TASK_NUMBER`.
5. Dispatch `requirements-verifier`.
   - `VERIFICATION_RESULT` -> `PASS`
6. Run `clean-code-reviewer`, then `architecture-reviewer`, then `security-auditor`.
   - Example: `clean-code-reviewer` -> `NEEDS FIXES`
7. Consolidate blocking issues, re-dispatch `task-executor`, then `documentation-writer`,
   then re-run only failing gates in order.
8. Report kickoff outcome, final verdicts, commits, files changed, and any skipped GitHub updates.
```
