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

Inside Phase 4, keep only the routing verdicts plus the caller-facing rollup.
For GitHub, that means the parent / artifact identifiers, creation totals,
warnings or failures, the linkage rollup the caller needs for progress
tracking, and the effective write-path / capability outcome when it matters for
auditability.

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

That bundled reference file is the only normative Phase 4 contract source for
this skill. `SKILL.md` covers dispatch, routing, and reporting only. The
subagent defines how to achieve the contract but does not replace it.

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
- Any result paired with `Validation: NOT_RUN`: treat the phase as incomplete;
  no trustworthy local post-write artifact was produced for downstream use.

### 3. Report only the summary

Using only the subagent's structured summary, tell the caller:

- Use the subagent summary as routing input; do not rewrite its contract schema
  inside `SKILL.md`.
- Surface the caller-facing rollup: parent reference, `ISSUE_SLUG`, updated
  plan-file path, creation totals, warnings or failures, and the reminder that
  no implementation has started.
- Include the effective **write model** / **capability** outcome when it helps
  explain which GitHub creation path ran.

Dispatch `task-issue-creator` as a subagent. If the environment cannot invoke
subagents, report the skill as blocked rather than reproducing the subagent
inline.

## Example

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/42` (the subagent derives `ISSUE_SLUG=acme-app-42`)

1. Read `./subagents/task-issue-creator.md`
2. Dispatch `task-issue-creator` with `ISSUE_URL`
3. Subagent returns the contract-defined summary from
   `./references/phase-4-io-contracts.md`, for example:

   TASK_ISSUES: PASS
   Validation: PASS
   Parent: acme/app#42
   ISSUE_SLUG: acme-app-42
   Plan file: docs/acme-app-42-tasks.md
   Write model: linked-issue
   Capability: native sub-issue REST unavailable; gh-sub-issue not installed
   ...

4. Route on that summary, then relay only the caller-facing rollup. Include the
   write-path / capability outcome when it helps explain the GitHub result.
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

Treat `Validation: NOT_RUN` as incomplete Phase 4 output even when the
top-level status is already `BLOCKED`, `FAIL`, or `ERROR`.
