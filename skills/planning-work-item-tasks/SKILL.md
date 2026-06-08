---
name: "planning-work-item-tasks"
description: "Phase 2 of the planning workflow for Jira tickets or GitHub issues. Reads a work-item snapshot, detects the platform, dispatches a plan/prioritize/validate pipeline, and writes docs/<KEY>-tasks.md with branch names for every planned task. Loads the matching platform playbook just-in-time."
---

# Planning Work Item Tasks

Plan a work-item snapshot into `docs/<KEY>-tasks.md`. This is the Phase 2
orchestrator for the planning workflow: it detects the platform, routes stages,
dispatches specialists, preserves stage artifacts for resume and critique, and
returns a concise handoff. `<KEY>` is the Jira ticket key or GitHub issue slug
the active playbook defines.

The orchestrator keeps only workflow state, subagent verdicts, paths, counts,
and user decisions in context. Detailed contracts, templates, validation checks,
and source-backed background are loaded just in time from bundled references or
optional external URLs.

## Platform Detection

Detect the platform from the input and load the matching playbook for every
per-platform decision. Pass the resolved `PLAYBOOK_PATH` to every dispatched
subagent.

| Signal | Platform | Playbook |
| ------ | -------- | -------- |
| `TICKET_KEY` matching a Jira key shape `<PROJECT>-<N>` | `jira` | [`./references/jira-playbook.md`](./references/jira-playbook.md) |
| `ISSUE_SLUG` matching `<owner>-<repo>-<N>` | `github` | [`./references/github-playbook.md`](./references/github-playbook.md) |

The active playbook's `Inputs and Identifier` section defines the primary input
and how the workflow key `<KEY>` is derived. If the platform is ambiguous, ask
one targeted clarification question before dispatching.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TICKET_KEY` | Yes | `JNS-6065` (Jira) or `acme-app-42` (GitHub issue slug, passed under this alias) |
| `RE_PLAN` | No | `true` |
| `DECISIONS` | No | `SSO decision changes task dependencies` |

Phase 2 is file-driven. `docs/<KEY>.md` must already exist as the Phase 1
work-item snapshot.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Platform contract (identifier, vocabulary, consumed sections, branch slug, external URLs) | `./references/jira-playbook.md` or `./references/github-playbook.md` |
| Normal run, dispatch payloads, retry loop | `./references/execution-guide.md` |
| Final artifact contract, branch policy, child-item handling | `./references/output-contract.md` |
| Critique-driven re-plan or recovery from stage artifacts | `./references/re-plan-cycle.md` |
| Source-backed background or current platform syntax | `./references/external-sources.md` |
| Subagent-specific guides, templates, or validation checks | Load only from the dispatched subagent |

Bundled paths in this file are relative to this `SKILL.md`; files loaded later
use paths relative to their own locations. All bundled files travel with the
package. External URLs are optional progressive enhancement: fetch them only
when local contracts need background or current syntax, and proceed from bundled
references when network access is unavailable.

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `task-planner` | `./subagents/task-planner.md` | Decompose the work item and draft the stage 1 plan |
| `dependency-prioritizer` | `./subagents/dependency-prioritizer.md` | Add dependency order, priority, and branch names |
| `task-validator` | `./subagents/task-validator.md` | Validate the prioritized plan and append QA findings |
| `stage-validator` | `./subagents/stage-validator.md` | Check preflight, inter-stage, and final structural gates |

Every subagent dispatch passes `PLAYBOOK_PATH` so platform tokens resolve.

## Workflow

| Path | When | Next reference |
| ---- | ---- | -------------- |
| Normal | `RE_PLAN` is absent or `false` | `./references/execution-guide.md` |
| Re-plan | `RE_PLAN=true` with critique decisions | `./references/re-plan-cycle.md`, then `./references/execution-guide.md` |

The normal path is: preflight snapshot validation, Stage 1 detailed planning,
Stage 1 validation, Stage 2 dependency/branch planning, Stage 2 validation,
Stage 3 final validation report, Stage 3 validation, postpipeline validation,
handoff.

Preserve `docs/<KEY>-stage-1-detailed.md`, `docs/<KEY>-stage-2-prioritized.md`,
and `docs/<KEY>-tasks.md` on disk. They are orchestration state for resume,
critique, and targeted retries; they are not implementation outputs.

Use targeted fix loops only. Re-dispatch the stage that produced the failing
artifact, pass only the validator's issue list, rerun only the failing gate, and
stop after 3 failed cycles for the same gate.

## Return Format

Return only this phase handoff. Use `PLANNING: PASS` only when every stage and
stage-validation gate has passed.

```text
PLANNING: PASS | FAIL
WORK_ITEM: <KEY>
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
Input: `TICKET_KEY=JNS-6065`

1. Detect `jira`; load `./references/jira-playbook.md`.
2. Load `./references/execution-guide.md` for the dispatch payloads.
3. Dispatch `stage-validator` for `preflight` (with `PLAYBOOK_PATH`); it returns `STAGE_VALIDATION: PASS`.
4. Dispatch `task-planner`, `dependency-prioritizer`, and `task-validator` in sequence (each with `PLAYBOOK_PATH`), validating after each produced artifact.
5. Dispatch `stage-validator` for `postpipeline`; it returns `STAGE_VALIDATION: PASS`.
6. Return the concise `PLANNING: PASS` handoff with preserved artifact paths.
</example>
