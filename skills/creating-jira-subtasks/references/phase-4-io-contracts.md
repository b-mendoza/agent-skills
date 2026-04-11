# Phase 4 I/O Contracts

> Read this file when validating standalone Phase 4 execution or interpreting
> the `subtask-creator` summary.
>
> **Reminder:** Keep only artifact shapes and structured verdicts in the
> coordinator context. Plan parsing, Jira operations, and plan-file edits stay
> inside `subtask-creator`.
>
> Orchestrator phase boundaries: align with
> `../../orchestrating-jira-workflow/references/data-contracts.md`.

## Input Contract

Primary input artifacts:

```text
JIRA_URL   — parent ticket (authoritative for workspace/project/key)
docs/<TICKET_KEY>-tasks.md
```

For normal Phase 4 execution, the plan is expected to contain:

| Expected section / element                          | Produced by            | Why it matters                               |
| --------------------------------------------------- | ---------------------- | -------------------------------------------- |
| `## Tasks` with numbered `## Task <N>:` headings    | planning-jira-tasks    | Each task maps to one Jira subtask           |
| `## Execution Order Summary`                        | planning-jira-tasks    | Preserves task ordering context              |
| `## Decisions Log`                                  | clarifying-assumptions | Indicates critique is complete before Jira writes |

The parent orchestrator is responsible for validating the normal Phase 4
precondition before this skill runs. If this skill is used standalone and the
plan is missing or malformed, the subagent returns `SUBTASKS: BLOCKED`. If
`## Decisions Log` is missing, the subagent continues with `SUBTASKS: WARN`:
the plan is still parseable, but the normal workflow precondition was skipped.

## Output Contract

Primary output artifact:

```text
docs/<TICKET_KEY>-tasks.md
```

After successful or partial Phase 4 completion, the plan file must include:

| Addition | Consumed by | Purpose |
| -------- | ----------- | ------- |
| `## Jira Subtasks` section with workflow table | artifact-validator, progress-tracker, executing-jira-task (later) | Phase 4 postcondition; resumable linkage |
| Exactly one `Jira Subtask: …` line per numbered task section (immediately after the task heading) | artifact-validator, downstream execution | Per-task inline reference required for every row |

### Workflow table (required)

Use the table shape in `./subagents/subtask-creator-templates.md` (`Plan File
Fragments`). Column semantics:

| Column | Allowed values / notes |
| ------ | ---------------------- |
| Task | Integer task index matching `## Task <N>:` |
| Subtask Key | Jira issue key (e.g., `PROJ-200`) for a concrete subtask; `Not Created` if creation failed |
| Title | Short title aligned with the task heading |
| Status | Jira workflow status when known (`To Do`, `In Progress`, `Done`, etc.) or `Not Created` |
| Dependencies | Same normalized form as the plan (`None`, `1`, `1,2`, etc.) |
| Priority | From plan or `Unknown` |

Exactly **one row per** parsed `## Task <N>:` section.

### Per-task inline reference (required)

In each `## Task <N>:` section, on the **first** line after the heading, include
exactly one line of this form (no variation in the prefix):

```text
Jira Subtask: <KEY | Not Created>
```

Rules:

- Use the Jira subtask key (e.g., `PROJ-200`) iff the workflow table row for
  that task has a concrete `Subtask Key` in the same form.
- Use `Not Created` iff the table row uses `Not Created`.

This line is the **exact format** referenced by
`orchestrating-jira-workflow/references/data-contracts.md` for Phase 4
postcondition checks.

## Structured Summary Contract

The subagent returns a structured summary with:

- `SUBTASKS: PASS | WARN | FAIL | BLOCKED | ERROR`
- `Validation: PASS | FAIL | NOT_RUN`
- `Ticket: <TICKET_KEY>`
- `Plan file: <path | not updated>`
- Counts: tasks in plan, already linked, created now, failed creates
- `Decisions Log: PRESENT | MISSING`
- `Created/Linked Subtasks:` markdown table with **Subtask Key**, **Title**,
  **Dependencies**, **Priority**, **Outcome**
- Explicit `Warnings:` and `Failures:` sections

Treat `SUBTASKS: ERROR` as an unexpected tool or environment failure. The
coordinator stops and surfaces the reason instead of interpreting the run as a
degraded success.

The `Created/Linked Subtasks` table is the handoff the parent workflow uses
for `progress-tracker` (`TASKS` on Phase 4 completion). Preserve **Dependencies**
and **Priority** columns for every row.
