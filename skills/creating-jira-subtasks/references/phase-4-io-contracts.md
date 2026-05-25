# Phase 4 I/O Contracts (Jira)

> Read this file when validating standalone Phase 4 execution, updating the
> plan artifact, or interpreting the `subtask-creator` summary.
>
> **Reminder:** the orchestrator only retains artifact paths and the structured
> verdict. Plan parsing, Jira operations, and plan-file edits stay inside
> `subtask-creator`.

This skill is self-contained: the contract below remains local and normative
even when network access is unavailable. External URLs in
`./external-sources.md` are optional just-in-time sources for current platform
syntax; they never override what is specified here.

## Input Contract

Primary inputs:

```text
JIRA_URL
docs/<TICKET_KEY>-tasks.md
```

Derive stable identifiers from `JIRA_URL`:

- **Workspace:** subdomain before `.atlassian.net`
- **Project:** prefix before the dash in the ticket key
- **TICKET_KEY:** full path segment, such as `PROJ-123`

Mutation approval is a precondition: Jira subtask writes and the scoped update
to `docs/<TICKET_KEY>-tasks.md` must already be approved by the caller or user.
If approval is unclear in a direct invocation, return `SUBTASKS: BLOCKED` with
`Validation: NOT_RUN` rather than creating or editing anything.

Expected normal-workflow plan shape:

| Expected section / element | Why it matters |
| -------------------------- | -------------- |
| `## Tasks` with numbered `## Task <N>:` headings | Each task maps to one Jira subtask row |
| `## Execution Order Summary` | Preserves task ordering context |
| `## Decisions Log` | Indicates critique or clarification happened before Jira writes |

If the plan is missing or malformed, return `SUBTASKS: BLOCKED`. If the plan
is parseable but lacks `## Decisions Log`, continue with a warning.

## Platform Behavior

Jira Phase 4 uses the project's native subtask relationship. A concrete task
is linked when the plan records a Jira subtask key whose parent is
`TICKET_KEY`. Tasks that could not be created are recorded as `Not Created`.

When a task needs a new subtask, verify the project's current create metadata
before writing:

| Runtime condition | Status |
| ----------------- | ------ |
| No createable subtask issue type, or subtasks disabled for the project | `SUBTASKS: FAIL` with `Validation: NOT_RUN` |
| Multiple createable subtask issue types and no deterministic configured or approved choice | `SUBTASKS: BLOCKED` with `Validation: NOT_RUN` |
| Multiple createable subtask issue types with a deterministic configured or approved choice | Continue and record a warning |
| Required create fields cannot be satisfied from the plan, parent, defaults, or metadata | `SUBTASKS: FAIL` with `Validation: NOT_RUN` |

The Jira summary does not include GitHub-style `Write model:` or `Capability:`
lines.

For current REST payload details, ADF requirements, or subtask configuration,
read `./external-sources.md` and fetch the smallest relevant URL. Local
templates define semantic sections, not a mandatory transport encoding.

## Output Artifact Contract

Primary output artifact:

```text
docs/<TICKET_KEY>-tasks.md
```

After successful or partial completion, the plan file includes:

| Addition | Purpose |
| -------- | ------- |
| `## Jira Subtasks` workflow table | Phase 4 postcondition and resumable linkage |
| One `Jira Subtask: ...` line per numbered task section | Per-task reference consumed by downstream phases |

### Workflow Table

Use the example in `../subagents/subtask-creator-templates.md`. Column order
is fixed:

| Task | Subtask Key | Title | Status | Dependencies | Priority |
| ---- | ----------- | ----- | ------ | ------------ | -------- |

Column semantics:

| Column | Allowed values / notes |
| ------ | ---------------------- |
| Task | Integer task index matching `## Task <N>:` |
| Subtask Key | Jira issue key for a concrete subtask, or `Not Created` |
| Title | Task heading text, typically `Task <N>: <Short title>` |
| Status | Jira workflow status when known, or `Not Created` |
| Dependencies | Normalized plan dependency value, such as `None`, `1`, or `1,2` |
| Priority | Plan priority or `Unknown` |

The table contains exactly one row per parsed task. Use `Not Created` in both
`Subtask Key` and `Status` when a create attempt failed.

### Per-Task Inline Reference

In each `## Task <N>:` section, the first line after the heading uses this
exact form:

```text
Jira Subtask: <KEY | Not Created>
```

The inline value matches that task's workflow-table `Subtask Key`.

## Structured Summary Contract

The subagent returns:

- `SUBTASKS: PASS | WARN | FAIL | BLOCKED | ERROR`
- `Validation: PASS | FAIL | NOT_RUN`
- `Parent: <TICKET_KEY>`
- `TICKET_KEY: <TICKET_KEY>`
- `Plan file: <path | not updated>`
- `Tasks in plan: <n>`
- `Already linked: <n>`
- `Created now: <n>`
- `Failed creates: <n>`
- `Decisions Log: PRESENT | MISSING`
- `Reason: <one line>`
- `Created/Linked Subtasks:` markdown table with **Task**, **Subtask Key**,
  **Title**, **Dependencies**, **Priority**, and **Outcome**
- Explicit `Warnings:` and `Failures:` sections

`TICKET_KEY:` is required on every summary, including early exits. When the
run stops before create attempts begin, report `Failed creates: 0` and use a
header-only linkage table if no task rows are safe to report.

When the plan file was updated, include one summary row per parsed task. For
tasks without a concrete Jira key, use `Not Created` in `Subtask Key` and an
explicit `Outcome`, such as `Create failed`.

## Status and Validation Semantics

| Status | Meaning |
| ------ | ------- |
| `PASS` | Every task is linked to a valid Jira subtask and validation passed |
| `WARN` | Validation passed with non-fatal issues, such as missing decisions log, deterministic subtask-type choice warnings, or failed individual creates recorded as `Not Created` |
| `BLOCKED` | Approval, plan shape, existing linkage, or ambiguous subtask-type selection is unsafe to proceed |
| `FAIL` | Parent lookup, auth, Jira tooling, no createable subtask type, unsatisfied required fields, all creates, or post-write validation failed |
| `ERROR` | Unexpected tool or environment failure interrupted the run |

Use `Validation: NOT_RUN` only when no plan-file update or post-write
validation could occur.

`SUBTASKS: WARN` with `Validation: PASS` means the handoff artifact is
structurally valid. Linked tasks are usable, but any task whose row says
`Not Created` needs manual resolution or a successful rerun before that task is
selected for execution.

## Validation Checklist

- Exactly one `## Jira Subtasks` table exists.
- The table columns match the fixed order above.
- The table has one row per parsed task.
- Every concrete Jira key in the plan exists and belongs to `TICKET_KEY`.
- Every workflow-table value has a matching per-task `Jira Subtask:` line.
- `Not Created` values are structurally valid only when they appear in both the
  workflow table and the matching per-task inline line, and the final status is
  `SUBTASKS: WARN`.
