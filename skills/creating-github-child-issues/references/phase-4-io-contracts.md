# Phase 4 I/O Contracts (GitHub)

> Read this file when validating standalone Phase 4 execution, updating the
> plan artifact, or interpreting the `task-issue-creator` summary.
>
> **Reminder:** the orchestrator only retains artifact paths and the structured
> verdict. Plan parsing, `gh` and REST operations, and plan-file edits stay
> inside `task-issue-creator`.

This skill is self-contained: the contract below remains local and normative
even when network access is unavailable. External URLs in
`./external-sources.md` are optional just-in-time sources for current platform
syntax; they never override what is specified here.

## Input Contract

Primary inputs:

```text
ISSUE_URL
docs/<ISSUE_SLUG>-tasks.md
```

Derive stable identifiers from `ISSUE_URL`:

- **OWNER:** path segment after `github.com/`, lowercased for slug stability
- **REPO:** next path segment, lowercased for slug stability
- **PARENT_NUMBER:** numeric segment after `/issues/`
- **ISSUE_SLUG:** `<owner>-<repo>-<parent_number>`

Expected normal-workflow plan shape:

| Expected section / element | Why it matters |
| -------------------------- | -------------- |
| `## Tasks` with numbered `## Task <N>:` headings | Each task maps to one GitHub task issue row |
| `## Execution Order Summary` | Preserves task ordering context |
| `## Decisions Log` | Indicates critique or clarification happened before GitHub writes |

If the plan is missing or malformed, return `TASK_ISSUES: BLOCKED`. If the plan
is parseable but lacks `## Decisions Log`, continue with a warning.

## Platform Behavior

The subagent chooses the best confirmed write path in this order:

1. **Native sub-issue:** GitHub records a child/sub-issue relationship.
2. **Linked issue:** A normal issue is created with explicit parent
   traceability in its body, and optional parent-side comments when practical.
3. **Task-list:** No concrete child issue is created for that task; the plan
   records checklist-style traceability.

The orchestrator does not choose the model. The subagent records the effective
path in the machine handoff comment, per-row `Write model`, and summary
`Write model:` / `Capability:` lines.

For current CLI flags, REST sub-issue endpoint behavior, or task-list markdown
syntax, read `./external-sources.md` and fetch only the relevant GitHub source.

## Output Artifact Contract

Primary output artifact:

```text
docs/<ISSUE_SLUG>-tasks.md
```

After successful or partial completion, the plan file includes:

| Addition | Purpose |
| -------- | ------- |
| `## GitHub Task Issues` section with machine handoff comment and workflow table | Phase 4 postcondition and resumable linkage |
| One `GitHub Task Issue: ...` line per numbered task section | Per-task reference consumed by downstream phases |

### Machine Handoff Comment

Immediately after `## GitHub Task Issues`, include one HTML comment:

```html
<!-- phase4-handoff parent="owner/repo#N" model="linked-issue" capability="<short free-text>" updated="<ISO-8601 UTC>" -->
```

Field semantics:

| Field | Meaning |
| ----- | ------- |
| `parent` | Canonical parent reference |
| `model` | Dominant run model: `native-sub-issue`, `linked-issue`, `task-list`, or `mixed` |
| `capability` | Short detection result, such as `native unavailable` or `fallback linked-issue` |
| `updated` | UTC timestamp for the last Phase 4 write |

### Workflow Table

Use the example in `../subagents/task-issue-creator-templates.md`. Column order
is fixed:

| Task | Issue ref | Title | Write model | Status | Dependencies | Priority |
| ---- | --------- | ----- | ----------- | ------ | ------------ | -------- |

Column semantics:

| Column | Allowed values / notes |
| ------ | ---------------------- |
| Task | Integer task index matching `## Task <N>:` |
| Issue ref | `owner/repo#number`, `Not Created`, or `task-list` |
| Title | Task heading text, typically `Task <N>: <Short title>` |
| Write model | `native-sub-issue`, `linked-issue`, `task-list`, or `mixed` |
| Status | GitHub state when known (`OPEN`, `CLOSED`), `Not Created`, or `task-list` |
| Dependencies | Normalized plan dependency value, such as `None`, `1`, or `1,2` |
| Priority | Plan priority or `Unknown` |

The table contains exactly one row per parsed task. Use `Not Created` in both
`Issue ref` and `Status` when a concrete issue create attempt failed. Use
`task-list` in `Issue ref`, `Write model`, and `Status` only for intentional
plan-only traceability.

### Per-Task Inline Reference

In each `## Task <N>:` section, the first line after the heading uses this
exact form:

```text
GitHub Task Issue: <owner/repo#number | Not Created | task-list>
```

The inline value matches that task's workflow-table `Issue ref`.

## Structured Summary Contract

The subagent returns:

- `TASK_ISSUES: PASS | WARN | FAIL | BLOCKED | ERROR`
- `Validation: PASS | FAIL | NOT_RUN`
- `Parent: owner/repo#N`
- `ISSUE_SLUG: <issue_slug>`
- `Plan file: <path | not updated>`
- `Write model: native-sub-issue | linked-issue | task-list | mixed | unknown`
- `Capability: <short detection summary>`
- `Tasks in plan: <n>`
- `Already linked: <n>`
- `Created now: <n>`
- `Failed creates: <n>`
- `Decisions Log: PRESENT | MISSING`
- `Reason: <one line>`
- `Created/Linked Task Issues:` markdown table with **Task**, **Issue ref**,
  **Title**, **Write model**, **Dependencies**, **Priority**, and **Outcome**
- Explicit `Warnings:` and `Failures:` sections

`ISSUE_SLUG:`, `Write model:`, and `Capability:` are required on every summary,
including early exits. When the run stops before create attempts begin, report
`Failed creates: 0` and use a header-only linkage table if no task rows are
safe to report.

When the plan file was updated, include one summary row per parsed task. For
tasks without a concrete issue, use `Not Created` or `task-list` in `Issue ref`
and an explicit `Outcome`, such as `Create failed` or `Task list only`.

## Status and Validation Semantics

| Status | Meaning |
| ------ | ------- |
| `PASS` | Every task has valid traceability and validation passed |
| `WARN` | Validation passed with non-fatal issues such as missing decisions log, mixed/degraded linkage, `Not Created`, or `task-list` rows |
| `BLOCKED` | Plan shape or existing refs are unsafe to proceed |
| `FAIL` | Parent verification, auth, `gh`, all expected creates, or post-write validation failed |
| `ERROR` | Unexpected tool or environment failure interrupted the run |

Use `Validation: NOT_RUN` only when no plan-file update or post-write
validation could occur.

## Validation Checklist

- Exactly one `## GitHub Task Issues` section exists.
- The machine handoff comment appears immediately under the section heading.
- The table columns match the fixed order above.
- The table has one row per parsed task.
- Every concrete issue ref resolves and is consistent with the parent.
- Every workflow-table value has a matching per-task `GitHub Task Issue:` line.
