---
name: "creating-github-child-issues"
description: "Creates or reconciles GitHub child task issues for an approved Phase 4 task plan. Use after docs/<ISSUE_SLUG>-tasks.md is clarified and the user has approved GitHub writes; dispatches task-issue-creator and returns a compact status summary."
---

# Creating GitHub Child Issues

You are a Phase 4 GitHub child-issue orchestration skill. Your job is to keep the
caller-facing workflow small: derive identifiers from `ISSUE_URL`, load only the
local contract or external source map when needed, dispatch `task-issue-creator`,
and relay the structured result.

The subagent owns plan parsing, `gh` operations, API capability probes, plan-file
edits, and validation. The orchestrator keeps only verdicts, paths, counts,
write-path metadata, warnings, and failures.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `ISSUE_URL` | Yes | `https://github.com/acme/app/issues/42` |

Derive these values only for routing and reporting:

- **OWNER:** path segment after `github.com/`, lowercased for slug stability
- **REPO:** next path segment, lowercased for slug stability
- **PARENT_NUMBER:** numeric segment after `/issues/`
- **ISSUE_SLUG:** `<owner>-<repo>-<parent_number>`

Pass the full `ISSUE_URL` to the subagent. It is the authoritative context for
`gh --repo` and parent issue verification.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Phase 4 artifact shape, summary fields, or status semantics | `./references/phase-4-io-contracts.md` |
| Current GitHub CLI, REST sub-issue, task-list, or prompt-disclosure docs | `./references/external-sources.md`, then fetch only the relevant URL |
| Child issue creation or reconciliation | `./subagents/task-issue-creator.md` |

External URLs are optional just-in-time sources. This skill remains executable
from its bundled files when network access is unavailable.

## Subagent Registry

Read a subagent definition only when dispatching that subagent.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `task-issue-creator` | `./subagents/task-issue-creator.md` | Reconciles the clarified plan with GitHub task issues and returns the Phase 4 summary |

## Workflow

1. Confirm `ISSUE_URL` is present and derive `ISSUE_SLUG` for local reporting.
2. Read `./references/phase-4-io-contracts.md` only when interpreting an output,
   validating Phase 4, or explaining the required artifact shape.
3. Read `./subagents/task-issue-creator.md` and dispatch it with `ISSUE_URL`.
4. Route on the returned `TASK_ISSUES` and `Validation` lines.
5. Report a concise Phase 4 rollup: parent, `ISSUE_SLUG`, plan path, counts,
   write model, capability note, warnings, failures, and the reminder that
   implementation work has not begun.

## Routing Rules

| Result | Orchestrator action |
| ------ | ------------------- |
| `TASK_ISSUES: PASS` with `Validation: PASS` | Report success and proceed |
| `TASK_ISSUES: WARN` with `Validation: PASS` | Report usable output with visible warnings or failed/degraded task links |
| `TASK_ISSUES: BLOCKED` | Stop and surface the plan-shape or unsafe-linkage issue |
| `TASK_ISSUES: FAIL` | Stop and surface the fatal GitHub or validation failure |
| `TASK_ISSUES: ERROR` or `Validation: FAIL` | Stop and surface the unexpected failure or local contract failure |

Treat `Validation: NOT_RUN` as incomplete Phase 4 output even when the top-level
status is already `BLOCKED`, `FAIL`, or `ERROR`.

## Output Contract

Return only the subagent's structured summary plus a short caller-facing rollup.
The full summary schema lives in `./references/phase-4-io-contracts.md`.

Include `Write model:` and `Capability:` when reporting GitHub results, because
GitHub child-issue support varies by CLI version, repository, API availability,
and installed extensions.

## Example

<example>
Input: `ISSUE_URL=https://github.com/acme/app/issues/42`

1. The orchestrator derives `ISSUE_SLUG=acme-app-42` for reporting.
2. The orchestrator dispatches `task-issue-creator` with `ISSUE_URL`.
3. The subagent returns:

```markdown
TASK_ISSUES: PASS
Validation: PASS
Parent: acme/app#42
ISSUE_SLUG: acme-app-42
Plan file: docs/acme-app-42-tasks.md
Write model: linked-issue
Capability: REST sub_issues unavailable; using gh issue create + parent URL in body
```

4. The orchestrator reports success, write path, creation/link counts,
   warnings/failures if any, and that no implementation has started.
</example>
