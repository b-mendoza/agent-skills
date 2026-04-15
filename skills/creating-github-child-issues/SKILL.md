---
name: "creating-github-child-issues"
description: 'Phase 4 skill for clarified GitHub task plans. Use after the task plan has been clarified and the user has explicitly approved GitHub writes. This skill reads only its bundled files, dispatches the `task-issue-creator` subagent with `ISSUE_URL`, and returns a concise phase summary after GitHub task issues are created or reconciled and `docs/<ISSUE_SLUG>-tasks.md` is updated with the Phase 4 output contract.'
---

# Creating GitHub Child Issues

Create or reconcile GitHub task issues for a clarified plan at
`docs/<ISSUE_SLUG>-tasks.md`. This skill coordinates Phase 4 by dispatching one
specialist subagent, keeping only its structured summary, and reporting the
outcome the parent workflow needs for progress tracking.

The orchestrator does four things directly: read its bundled files, derive
identifiers from `ISSUE_URL`, dispatch `task-issue-creator`, and relay the
subagent's summary. Plan parsing, `gh` calls, GitHub API probes, and plan-file
edits all stay inside `task-issue-creator` after dispatch.

## Inputs

| Input       | Required | Example                                 |
| ----------- | -------- | --------------------------------------- |
| `ISSUE_URL` | Yes      | `https://github.com/acme/app/issues/42` |

Derive these values from the URL when you need to describe the parent issue:

- **OWNER:** path segment after `github.com/` (lowercase for slug stability).
- **REPO:** next path segment (lowercase).
- **PARENT_NUMBER:** numeric segment after `/issues/`.
- **ISSUE_SLUG:** `<owner>-<repo>-<parent_number>`.

Prefer passing the full `ISSUE_URL` downstream. It is the authoritative context
for `gh --repo` and for verifying the parent issue.

## Workflow Overview

```text
1. Read the task-issue-creator definition
2. Dispatch it with ISSUE_URL
3. Interpret its structured result
4. Report only the concise phase summary to the caller
```

## Subagent Registry

Read a subagent definition only when you are about to dispatch it.

| Subagent             | Path                                    | Purpose                                                         |
| -------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `task-issue-creator` | `./subagents/task-issue-creator.md`     | Reconcile the clarified plan with GitHub and return a structured Phase 4 summary |

## How This Skill Works

This skill is intentionally narrow. The parent workflow is responsible for
Phase 4 gating and progress tracking; this skill assumes the Phase 3 approval
step has already happened before GitHub writes begin.

Inside Phase 4, keep only:

- The structured `TASK_ISSUES` verdict
- The validation verdict
- The task / issue ref / write model / title / dependency / priority / outcome rows needed for progress reporting
- Any warning or fatal reason that requires user attention
- Any platform-specific creation metadata the subagent returns (for auditability)

Relay only the structured fields the subagent returns. Raw `gh` JSON, full API
responses, raw file contents, and intermediate parse details stay inside
`task-issue-creator` unless the user explicitly asks for them.

## Phase 4 Contract

Primary artifact:

```text
docs/<ISSUE_SLUG>-tasks.md
```

For the complete standalone input contract, output contract, and summary-field
definitions, read `./references/phase-4-io-contracts.md`.

That bundled reference file is the authoritative local I/O contract for this
skill. Placement and repair rules remain defined in the subagent. Do not rely
on any out-of-band spec document to run Phase 4.

The short version:

- The plan is expected to contain numbered `## Task <N>:` sections under
  `## Tasks`.
- Normal Phase 4 plans are also expected to include
  `## Execution Order Summary`, although Phase 4 parsing keys off numbered
  task sections rather than that summary.
- Standalone malformed or missing plans resolve to `TASK_ISSUES: BLOCKED`.
- A missing `## Decisions Log` downgrades the run to `TASK_ISSUES: WARN` rather
  than blocking it.
- Successful Phase 4 output is still the validated presence of
  `## GitHub Task Issues` with the required machine handoff comment and
  workflow table, plus `GitHub Task Issue: …` lines in task sections,
  per `./references/phase-4-io-contracts.md`.

## Execution Steps

### 1. Dispatch `task-issue-creator`

Read `./subagents/task-issue-creator.md`, then dispatch it with:

- `ISSUE_URL`

The subagent owns plan parsing, `gh` availability checks, parent verification,
write-model capability detection, idempotent reuse of existing linkage,
sequential creation of missing task issues (when the write model creates
issues), plan-file updates, and post-write validation.

### 2. Interpret the structured result

Handle the returned summary this way:

- `TASK_ISSUES: PASS` with `Validation: PASS`: report success and proceed.
- `TASK_ISSUES: WARN` with `Validation: PASS`: report partial success or degraded
  input clearly. Phase 4 may still be usable if the plan file now satisfies the
  local Phase 4 output contract, but make failed tasks visible so the user can
  retry before executing them.
- `TASK_ISSUES: BLOCKED`: stop and relay the artifact or data-shape problem. This
  usually means the plan is missing, malformed, or contains unsafe existing issue
  references that need manual correction.
- `TASK_ISSUES: FAIL`: stop and relay the fatal GitHub or validation failure.
- `TASK_ISSUES: ERROR`: stop and relay the unexpected failure.
- Any result paired with `Validation: FAIL`: treat the phase as incomplete even
  if some GitHub writes succeeded, because the local plan contract is not
  trustworthy yet.

### 3. Report only the summary

Using only the subagent's structured summary, tell the caller:

- The parent issue reference (`owner/repo#number`), `ISSUE_SLUG`, and updated plan-file path
- Total tasks in plan, already linked tasks, newly created issues, and failed creates
- The `Created/Linked Task Issues` table, including dependency and priority
  metadata for each task
- Any platform-specific creation metadata the subagent returned, including the
  effective **write model** and **capability detection** outcome (short)
- Any warnings or failures
- That no implementation has started and new issues remain open at their
  GitHub state unless already closed

Dispatch `task-issue-creator` as a subagent. If the environment cannot invoke
subagents, report the skill as blocked rather than reproducing the subagent
inline.

## Example

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/42` (the subagent derives `ISSUE_SLUG=acme-app-42`)

1. Read `./subagents/task-issue-creator.md`
2. Dispatch `task-issue-creator` with `ISSUE_URL`
3. Subagent returns:

   TASK_ISSUES: PASS
   Validation: PASS
   Parent: acme/app#42
   Plan file: docs/acme-app-42-tasks.md
   Write model: linked-issue
   Capability: native sub-issue REST unavailable; gh-sub-issue not installed
   Tasks in plan: 4
   Already linked: 1
   Created now: 3
   Failed creates: 0
   Decisions Log: PRESENT
   Reason: All tasks are now traced to GitHub issues or explicit task-list rows per contract.

   Created/Linked Task Issues:
   | Task | Issue ref | Title | Write model | Dependencies | Priority | Outcome |
   | ---- | --------- | ----- | ----------- | ------------ | -------- | ------- |
   | 1    | acme/app#100 | Task 1: Set up schema | linked-issue | None | High | Already linked |
   | 2    | acme/app#101 | Task 2: Implement API layer | linked-issue | 1 | High | Created now |
   | 3    | acme/app#102 | Task 3: Add integration tests | linked-issue | 2 | Medium | Created now |
   | 4    | acme/app#103 | Task 4: Update docs | linked-issue | None | Medium | Created now |

   Warnings:
   - None

   Failures:
   - None

4. Report:
   "Phase 4 complete for `acme/app#42` (`acme-app-42`).
   `docs/acme-app-42-tasks.md` now satisfies the GitHub Task Issues handoff.
   Write model: linked issues (native sub-issues not available in this environment).
   1 task was already linked and 3 issues were created now.
   No implementation has started."
</example>

## Escalation

Use the subagent's structured verdict as the only routing input:

| Summary state | Orchestrator action |
| ------------- | ------------------ |
| `TASK_ISSUES: PASS` with `Validation: PASS` | Report success and proceed |
| `TASK_ISSUES: WARN` with `Validation: PASS` | Report usable output with warnings and make failed or skipped linkage visible |
| `TASK_ISSUES: BLOCKED` | Stop and surface the plan-shape or unsafe-linkage issue |
| `TASK_ISSUES: FAIL` | Stop and surface the fatal GitHub or validation failure |
| `TASK_ISSUES: ERROR` or `Validation: FAIL` | Stop and surface the unexpected failure or local contract failure |
