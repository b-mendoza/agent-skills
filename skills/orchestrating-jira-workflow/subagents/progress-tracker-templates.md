# Progress Tracker — File Templates and Action Procedures

> This file contains the progress file templates and detailed action
> procedures. Read this when executing any action that creates or modifies
> progress files.
>
> Reminder: these are Category A orchestration artifacts. Update them on disk,
> preserve them across sessions, and summarize their state back to the
> orchestrator instead of returning raw file contents.

---

## Main Progress File Template

Location: `docs/<TICKET_KEY>-progress.md`

Used by the `initialize` action:

```markdown
# <TICKET_KEY> — Workflow Progress

| Phase | Skill                  | Status     | Completed at | Notes |
| ----- | ---------------------- | ---------- | ------------ | ----- |
| 1     | fetching-jira-ticket   | ⬜ Pending | —            | —     |
| 2     | planning-jira-tasks    | ⬜ Pending | —            | —     |
| 3     | clarifying-assumptions | ⬜ Pending | —            | —     |
| 4     | creating-jira-subtasks | ⬜ Pending | —            | —     |

## Task Execution (Phases 5–7)

_No tasks yet — populated after Phase 4 completes._

## Execution Log
```

---

## Task Execution Table Template

When Phase 4 completes (the `update` action receives `PHASE=4` with
`STATUS=complete`), replace the placeholder in the `## Task Execution`
section with this table, populated from the `TASKS` input:

```markdown
## Task Execution (Phases 5–7)

| Task | Title              | Current Phase | Status     | Detail                                 |
| ---- | ------------------ | ------------- | ---------- | -------------------------------------- |
| 1    | <title from TASKS> | —             | ⬜ Pending | `docs/<TICKET_KEY>-task-1-progress.md` |
| 2    | <title from TASKS> | —             | ⬜ Pending | `docs/<TICKET_KEY>-task-2-progress.md` |
| ...  | ...                | ...           | ...        | ...                                    |
```

---

## Per-Task Progress File Template

Location: `docs/<TICKET_KEY>-task-<N>-progress.md`

Used by the `initialize_task` action:

```markdown
# <TICKET_KEY> — Task <N>: <TASK_TITLE> — Progress

| Phase | Skill                  | Status     | Completed at | Notes |
| ----- | ---------------------- | ---------- | ------------ | ----- |
| 5     | planning-jira-task     | ⬜ Pending | —            | —     |
| 6     | clarifying-assumptions | ⬜ Pending | —            | —     |
| 7     | executing-jira-task    | ⬜ Pending | —            | —     |

## Re-plan History

_None_

## Activity Log
```

---

## Status Values

| Status    | Display     | Meaning                    |
| --------- | ----------- | -------------------------- |
| complete  | ✅ Complete | Phase/task finished        |
| active    | 🔄 Active   | Currently in progress      |
| failed    | ❌ Failed   | Errored — needs resolution |
| skipped   | ⏭️ Skipped  | Bypassed by user decision  |
| (default) | ⬜ Pending  | Not yet started            |

---

## Detailed Action Procedures

### `update` procedure

1. Read the current main progress file.
2. Update the row for the given phase (1–4) with the new status and a UTC
   timestamp.
3. If `PHASE=4` and `STATUS=complete`, populate the Task Execution table
   using the `TASKS` input (see template above).
4. Append a one-line entry to `## Execution Log`:
   ```
   <UTC timestamp> — Phase <N>: <STATUS> — <SUMMARY>
   ```
5. Write the updated file.

### `initialize_task` procedure

1. Create the per-task progress file from the template at
   `docs/<TICKET_KEY>-task-<N>-progress.md`.
2. Update the corresponding task row in the main progress file's Task
   Execution table:
   - Current Phase → `5/7 Plan`
   - Status → `🔄 Active`
3. Append a one-line entry to the main file's `## Execution Log`:
   ```
   <UTC timestamp> — Task <N> started: <TASK_TITLE>
   ```

### `update_task` procedure

1. Read the per-task progress file.
2. Update the row for the given phase (5–7) with the new status and a UTC
   timestamp.
3. Append a one-line entry to the per-task file's `## Activity Log`:
   ```
   <UTC timestamp> — Phase <PHASE>: <STATUS> — <SUMMARY>
   ```
4. Write the updated per-task file.
5. Update the corresponding task row in the main progress file:
   - Current Phase → `<PHASE>/7 <phase name>`
   - Status → the new status display value
   - If `PHASE=7` and `STATUS=complete`, set Status to `✅ Complete`
6. Append a one-line entry to the main file's `## Execution Log`:
   ```
   <UTC timestamp> — Task <N> Phase <PHASE>: <STATUS> — <SUMMARY>
   ```
