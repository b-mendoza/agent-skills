---
name: "planning-github-issue-tasks"
description: "Phase 2 of the GitHub planning workflow. Reads a GitHub issue snapshot, dispatches a plan/prioritize/validate pipeline, and writes docs/<ISSUE_SLUG>-tasks.md with branch names for every planned child issue."
---

# Planning GitHub Issue Tasks

Plan a GitHub issue into a structured execution artifact at
`docs/<ISSUE_SLUG>-tasks.md`. This skill is the Phase 2 orchestrator in the
GitHub workflow: it dispatches specialist subagents, validates each artifact
boundary, preserves planning artifacts for resume and critique, and returns
concise handoff summaries to the parent workflow.

The orchestrator does three things: **route** to the right stage, **dispatch**
subagents with explicit file paths, and **decide** whether to advance, retry, or
escalate from concise verdicts. Detailed contracts, retry rules, templates, and
external source links are loaded only when needed.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `ISSUE_SLUG` | Yes | `acme-app-42` |
| `RE_PLAN` | No | `true` |
| `DECISIONS` | No | `SSO decision changes task dependencies` |

Phase 2 is file-driven. `docs/<ISSUE_SLUG>.md` must already exist as the GitHub
issue snapshot. Load `./references/output-contract.md` when you need the exact
snapshot, final-plan, or branch-name contract.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Exact final artifact contract, required sections, branch-name policy, current-child-issue behavior | `./references/output-contract.md` |
| Normal execution path, dispatch payloads, gate handling, retry loop, example | `./references/execution-guide.md` |
| Critique-driven re-plan or recovery from preserved stage artifacts | `./references/re-plan-cycle.md` |
| Static source links for progressive disclosure, Git branch syntax, GitHub child issues, or agent-skill patterns | `./references/external-sources.md` |

Subagent definitions are loaded only when dispatching that subagent. Subagents
load their own phase references just in time.

Subagent-owned references:

| Reference | Loaded by |
| --------- | --------- |
| `./references/task-planning-guide.md` | `task-planner` during analysis |
| `./references/task-planner-template.md` | `task-planner` during document assembly |
| `./references/dependency-and-branch-guide.md` | `dependency-prioritizer` during analysis |
| `./references/dependency-prioritizer-template.md` | `dependency-prioritizer` during document assembly |
| `./references/validation-checks.md` | `stage-validator` and `task-validator` during checks |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `task-planner` | `./subagents/task-planner.md` | Decompose the issue and draft the stage 1 plan |
| `dependency-prioritizer` | `./subagents/dependency-prioritizer.md` | Add dependency order, priority, and branch names |
| `task-validator` | `./subagents/task-validator.md` | Validate the prioritized plan and append QA findings |
| `stage-validator` | `./subagents/stage-validator.md` | Check preflight, inter-stage, and final structural gates |

## Workflow Overview

```text
docs/<ISSUE_SLUG>.md
       |
       v
stage-validator preflight
       |
       v
task-planner -> docs/<ISSUE_SLUG>-stage-1-detailed.md
       |
       v
dependency-prioritizer -> docs/<ISSUE_SLUG>-stage-2-prioritized.md
       |
       v
task-validator -> docs/<ISSUE_SLUG>-tasks.md
       |
       v
stage-validator postpipeline
```

Each stage writes a Category A orchestration artifact that stays on disk for
critique, targeted retries, and workflow resume:

| Stage | File | Produced by |
| ----- | ---- | ----------- |
| 1 | `docs/<ISSUE_SLUG>-stage-1-detailed.md` | `task-planner` |
| 2 | `docs/<ISSUE_SLUG>-stage-2-prioritized.md` | `dependency-prioritizer` |
| 3 | `docs/<ISSUE_SLUG>-tasks.md` | `task-validator` |

Preserve these artifacts on disk. They are workflow state, not implementation
outputs, and stay out of git history.

## Branch and Child-Issue Policy

The final plan must list a `**Branch name:**` for every numbered task that may
become a GitHub child issue. The dependency-prioritizer generates those names
after task numbering is stable.

When the source snapshot is itself a GitHub child issue or sub-issue, keep the
work scoped to the current issue: use one branch for all task sections and state
that downstream child-issue creation should be skipped. This avoids creating
subtasks of a subtask and keeps direct child-issue execution inside a single
PR/branch.

## Execution Paths

| Path | When | Next reference |
| ---- | ---- | -------------- |
| Normal | `RE_PLAN` is absent or `false` | `./references/execution-guide.md` |
| Re-plan | `RE_PLAN=true` with critique decisions | `./references/re-plan-cycle.md`, then `./references/execution-guide.md` |

Use targeted fix loops only. When a gate fails, re-dispatch the stage that
produced the failing artifact, pass only the validator's issues list, and rerun
only the failing gate. Stop after 3 failed cycles for the same gate.

## Return Format

Return only this phase handoff. Use `PLANNING: PASS` only when every stage and
stage-validation gate has passed.

```text
PLANNING: PASS | FAIL
ISSUE_SLUG: <ISSUE_SLUG>
File: <final file path or "not written">
Tasks: <N>
Branches: <N unique branch names>
Cross-cutting questions: <N>
Validation warnings: <N>
Failure category: PREFLIGHT | STAGE_1 | STAGE_2 | STAGE_3 | POSTPIPELINE | NONE
Reason: <one line>
Artifacts preserved: <comma-separated paths>
```

## Example

<example>
Input: `ISSUE_SLUG=acme-app-42`

1. Load `./references/execution-guide.md`.
2. Dispatch `stage-validator` for `preflight`; it returns `STAGE_VALIDATION: PASS`.
3. Dispatch `task-planner`; it writes `docs/acme-app-42-stage-1-detailed.md`.
4. Dispatch `dependency-prioritizer`; it writes `docs/acme-app-42-stage-2-prioritized.md` with branch names such as `feature/acme-app-42-task-1-auth-schema`.
5. Dispatch `task-validator`; it writes `docs/acme-app-42-tasks.md` and appends `## Validation Report`.
6. Dispatch `stage-validator` for `postpipeline`; it returns `STAGE_VALIDATION: PASS`.
7. Return the concise `PLANNING: PASS` handoff.
</example>
