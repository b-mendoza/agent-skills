# Phase 4 I/O Contracts (GitHub)

> Read this file when validating standalone Phase 4 execution or interpreting the
> `task-issue-creator` summary.
>
> **Reminder:** Keep only artifact shapes and structured verdicts in the
> orchestrator context. Plan parsing, `gh` / API operations, and plan-file edits stay
> inside `task-issue-creator`.
>
> This skill is self-contained. When a parent workflow drives the phase,
> its own data contract should consume the output artifact shapes below; this
> skill does not depend on the parent's files being present.

## Input Contract

Primary input artifacts:

```text
ISSUE_URL   — parent issue (authoritative for owner/repo/number)
docs/<ISSUE_SLUG>-tasks.md
```

Derive these stable identifiers from `ISSUE_URL`:

- **OWNER:** path segment after `github.com/` (lowercase for slug stability)
- **REPO:** next path segment (lowercase)
- **PARENT_NUMBER:** numeric segment after `/issues/`
- **ISSUE_SLUG:** `<owner>-<repo>-<parent_number>`

For normal Phase 4 execution, the plan is expected to contain:

| Expected section / element                         | Produced by                     | Why it matters                                    |
| -------------------------------------------------- | ------------------------------- | ------------------------------------------------- |
| `## Tasks` with numbered `## Task <N>:` headings   | Upstream planning phase         | Each parsed task maps to one workflow row         |
| `## Execution Order Summary`                       | Upstream planning phase         | Preserves task ordering context                   |
| `## Decisions Log`                                 | Clarification / critique phase  | Indicates critique completed before GitHub writes |

The parent workflow is responsible for validating the normal Phase 4
precondition before this skill runs. If this skill is used standalone and the plan
is missing or malformed, the subagent returns `TASK_ISSUES: BLOCKED`. If
`## Decisions Log` is missing, the subagent continues with `TASK_ISSUES: WARN`:
the plan is still parseable, but the normal workflow precondition was skipped.

## Platform Behavior

The subagent attempts these write models, in order:

1. **Native child / sub-issues** — GitHub’s hierarchical sub-issue relationship,
   when the environment supports creating or attaching them non-interactively
   (see `../subagents/task-issue-creator.md` for detection; do not assume this
   is always available).
2. **Linked issues** — standalone issues created with `gh issue create`, with
   explicit parent traceability in the child body (and, when practical, a
   parent-side comment linking the child).
3. **Task-list references** — no new GitHub issue for that task; traceability is
   recorded only in the plan (and optionally the parent issue body) using a
   checklist-style reference defined in the templates file.

The orchestrator does not pick the model per run. The subagent records which
path was used in the machine handoff comment and per-row `Write model` column.

When a task resolves to **task-list** traceability only:

- The workflow table row uses `Issue ref = task-list`,
  `Write model = task-list`, and `Status = task-list`
- The task section uses `GitHub Task Issue: task-list`
- The optional checklist note shown in the templates file is a local traceability
  aid, not a separate contract surface

## Output Artifact Contract

Primary output artifact:

```text
docs/<ISSUE_SLUG>-tasks.md
```

After successful or partial Phase 4 completion, the plan file must include:

| Addition | Consumed by | Purpose |
| -------- | ----------- | ------- |
| `## GitHub Task Issues` section with machine handoff comment + workflow table | Downstream validation, progress tracking, and task execution phases | Phase 4 postcondition; resumable linkage |
| Exactly one `GitHub Task Issue: …` line per numbered task section (immediately after the task heading) | Downstream validation and execution | Per-task inline reference required for every row |

### Machine handoff comment (required)

Immediately after the `## GitHub Task Issues` heading, include **one** HTML
comment on its own line (stable key-value shape for scripts and validators):

```html
<!-- phase4-handoff parent="owner/repo#N" model="linked-issue" capability="<short free-text>" updated="<ISO-8601 UTC>" -->
```

- **parent:** canonical parent reference, same repo as the parent issue /
  workflow repository unless the skill explicitly documented a cross-repo
  exception.
- **model:** the **dominant** write model for this run (`native-sub-issue`,
  `linked-issue`, or `task-list`). If the run mixed models after partial
  failure, set `model="mixed"` and explain in `capability`.
- **capability:** one short sentence stating what was detected (for example
  `REST sub_issues GET 404`, `gh-sub-issue present`, or `fallback linked-issue`).
- **updated:** UTC timestamp when Phase 4 last wrote this section.

### Workflow table (required)

Use the example `## GitHub Task Issues` section in
`../subagents/task-issue-creator-templates.md`. Column order is fixed:

| Task | Issue ref | Title | Write model | Status | Dependencies | Priority |
| ---- | --------- | ----- | ----------- | ------ | ------------ | -------- |

Column semantics:

| Column | Allowed values / notes |
| ------ | ---------------------- |
| Task | Integer task index matching `## Task <N>:` |
| Issue ref | `owner/repo#number` for a concrete issue; `Not Created` if creation failed; `task-list` when that task uses task-list traceability only |
| Title | Task heading text, typically `Task <N>: <Short title>` |
| Write model | `native-sub-issue` \| `linked-issue` \| `task-list` \| `mixed` (per-row; usually matches the task’s actual linkage) |
| Status | GitHub state when known (`OPEN`, `CLOSED`) or `Not Created` / `task-list` |
| Dependencies | Same normalized form as the plan (`None`, `1`, `1,2`, etc.) |
| Priority | From plan or `Unknown` |

Exactly **one row per** parsed `## Task <N>:` section.

Use `Not Created` in both `Issue ref` and `Status` when a concrete issue create
attempt failed. Use `task-list` in `Issue ref`, `Write model`, and `Status`
only when the task is intentionally recorded as plan-only traceability.

This plan-file workflow table is intentionally different from the structured
summary table returned by the subagent. The artifact table records current
platform `Status`; the summary table records Phase 4 `Outcome`.

### Per-task inline reference (required)

In each `## Task <N>:` section, on the **first** line after the heading, include
exactly one line of this form (no variation in the prefix):

```text
GitHub Task Issue: <owner/repo#number | Not Created | task-list>
```

Rules:

- Use `owner/repo#number` iff the workflow table row for that task has a concrete
  `Issue ref` in the same form.
- Use `Not Created` iff the table row uses `Not Created`.
- Use `task-list` iff the table row uses `task-list` for `Issue ref`.

This line is the **exact format** consumed by downstream Phase 4 postcondition
checks and validation references.

## Structured Summary Contract

The subagent returns a structured summary with:

- `TASK_ISSUES: PASS | WARN | FAIL | BLOCKED | ERROR`
- `Validation: PASS | FAIL | NOT_RUN`
- `Parent: owner/repo#N`
- `ISSUE_SLUG: <issue_slug>`
- `Plan file: <path | not updated>`
- `Write model:` and `Capability:` lines mirroring the handoff comment semantics
- Counts: tasks in plan, already linked, created now, failed creates
- `Decisions Log: PRESENT | MISSING`
- `Reason: <one line>`
- `Created/Linked Task Issues:` markdown table with **Task**, **Issue ref**,
  **Title**, **Write model**, **Dependencies**, **Priority**, **Outcome**
- Explicit `Warnings:` and `Failures:` sections

`ISSUE_SLUG:` is required on every summary, including early exits. `Write model:`
and `Capability:` remain required even when the run stops before concrete
creation or validation.

When the run stops before concrete creation or validation, populate `Write
model:` and `Capability:` with the best detected or intended write path so the
summary shape stays stable.

Treat `TASK_ISSUES: ERROR` as an unexpected tool or environment failure. The
orchestrator stops and surfaces the reason instead of interpreting the run as a
degraded success.

When the run stops before plan updates or create attempts complete,
`Created/Linked Task Issues` may be header-only. This is still contract-valid
for early `BLOCKED`, `FAIL`, or `ERROR` exits.

The `Created/Linked Task Issues` table is the structured handoff downstream
progress tracking uses after Phase 4 completion. Preserve **Dependencies** and
**Priority** columns for every row.

When the plan file was updated, include one summary row per parsed task. For
tasks without a concrete issue, use `Not Created` or `task-list` in `Issue ref`
and an `Outcome` that makes the result explicit, such as `Create failed` or
`Task list only`.

If the run stops before create attempts begin, report `Failed creates: 0`.

## Status and Validation Semantics

- **PASS:** every task has a valid handoff row and matching per-task line;
  validation passed; no blocking warnings
- **WARN:** validation passed, but the run had non-fatal issues such as a
  missing `## Decisions Log`, mixed / degraded linkage, some `Not Created`
  rows, or other recoverable GitHub degradation
- **BLOCKED:** the plan is missing, malformed, unsupported, or contains unsafe
  existing refs that cannot be reused safely
- **FAIL:** parent verification failed, auth failed, `gh` is unavailable, all
  concrete-expected tasks remained unlinked after attempts, or post-write
  validation could not be repaired
- **ERROR:** an unexpected filesystem, tool, or environment failure interrupted
  the run

Use `Validation: NOT_RUN` only when the run failed before any plan-file update
or post-write validation could occur.
