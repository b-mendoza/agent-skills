# Planning Jira Task Data Contracts

> Read this file when checking prerequisites or artifact handoffs.
>
> Reminder: the orchestrator keeps summaries and file paths, not raw task-plan
> content.

## Upstream Prerequisites

Required file:

- `docs/<TICKET_KEY>-tasks.md`

Required content inside that file for `TASK_NUMBER`:

- `## Task <TASK_NUMBER>:` section exists
- Task title exists
- `Objective` content exists
- `Relevant requirements and context` content exists
- `Implementation notes` content exists
- `Definition of done` content exists
- `Likely files / artifacts affected` content exists
- `Dependencies / prerequisites` content exists, even if the value is `None`
- `Priority` content exists
- `Questions to answer before starting` content exists, even if the value is
  `None`

Expected upstream workflow state:

- Any task listed as a dependency for task `<N>` is already marked complete
- Questions for task `<N>` are resolved, explicitly waived, or recorded as
  conscious follow-up decisions
- If a `## Decisions Log` section exists, treat it as the latest authority over
  earlier task-plan wording
- When invoked as part of a multi-phase workflow, `docs/<TICKET_KEY>-tasks.md`
  may contain a `## Jira Subtasks` section with one row per numbered task and
  matching per-task inline references; this skill tolerates but does not
  require that table

Optional upstream context:

- `docs/<TICKET_KEY>.md` may provide extra ticket snapshot context if a
  subagent needs it
- `docs/<TICKET_KEY>-task-<TASK_NUMBER>-decisions.md` is available on
  critique-driven re-plan cycles (produced by the critique step)
- Per-task lines or notes that reference a Jira subtask (for example
  `Jira Subtask: <KEY>` lines) may already be present from an earlier
  task-linking step; when this skill is invoked outside the normal orchestrated
  entry, tolerate their absence but do not invent them

## Downstream Artifacts

### `docs/<TICKET_KEY>-task-<TASK_NUMBER>-brief.md`

Owner: `execution-prepper`

Must contain:

- `# Execution Brief - <TICKET_KEY> Task <TASK_NUMBER>: <Title>`
- `## Objective`
- `## Relevant Requirements and Context`
- `## Implementation Notes`
- `## Definition of Done`
- `## Likely Files / Artifacts Affected`
- `## Resolved Questions and Decisions`
- `## Constraints`

### `docs/<TICKET_KEY>-task-<TASK_NUMBER>-execution-plan.md`

Owner: `execution-planner`

Must contain:

- `# Execution Plan - <TICKET_KEY> Task <TASK_NUMBER>: <Title>`
- `## Codebase Summary`
- `## Recommended Skills`
- `## Implementation Approach`
- `## File-Level Strategy`
- `## Risks and Considerations`
- `## User Impact Assessment`
- `## Blockers / Ambiguities`

### `docs/<TICKET_KEY>-task-<TASK_NUMBER>-test-spec.md`

Owner: `test-strategist`

Must contain:

- `# Test Specification - <TICKET_KEY> Task <TASK_NUMBER>: <Title>`
- `## Test Framework and Conventions`
- `## Test Groups`
- `## Definition of Done Coverage`
- `## Notes for Task Executor`
- `## Blockers / Ambiguities`

### `docs/<TICKET_KEY>-task-<TASK_NUMBER>-refactoring-plan.md`

Owner: `refactoring-advisor`

Must contain:

- `# Refactoring Recommendation - <TICKET_KEY> Task <TASK_NUMBER>: <Title>`
- `## Verdict`
- `## Before Implementation`
- `## During Implementation`
- `## Out of Scope`
- `## Impact on Existing Tests`
- `## Blockers / Ambiguities`

## Artifact Lifecycle

These planning files are workflow-state artifacts for the planning pipeline:

- Keep them on disk
- Overwrite them only when the owning subagent is intentionally re-run
- Do not delete them as cleanup
- Do not commit them to git
