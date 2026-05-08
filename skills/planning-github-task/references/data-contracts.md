# Planning GitHub Task Data Contracts

> Read this file when checking prerequisites, artifact handoffs, or lifecycle
> rules. Load `./artifact-templates.md` only when exact artifact
> heading shape is needed.
>
> Reminder: the orchestrator keeps summaries and file paths, not raw task-plan
> content.

## Upstream Prerequisites

Required file:

- `docs/<ISSUE_SLUG>-tasks.md`

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
- When invoked as part of a multi-phase workflow, `docs/<ISSUE_SLUG>-tasks.md`
  may contain a `## GitHub Task Issues` section with one row per numbered task
  and matching per-task inline references; this skill tolerates but does not
  require that table

Optional upstream context:

- `docs/<ISSUE_SLUG>.md` may provide extra issue snapshot context if a subagent
  needs it
- `docs/<ISSUE_SLUG>-task-<TASK_NUMBER>-decisions.md` is available on
  critique-driven re-plan cycles
- Per-task lines or notes that reference a GitHub task issue may already be
  present from an earlier task-linking step; tolerate their absence when this
  skill is invoked outside the normal orchestrated entry

## Downstream Artifacts

| Artifact | Owner | Template |
| -------- | ----- | -------- |
| `docs/<ISSUE_SLUG>-task-<TASK_NUMBER>-brief.md` | `execution-prepper` | `Execution Brief Template` |
| `docs/<ISSUE_SLUG>-task-<TASK_NUMBER>-execution-plan.md` | `execution-planner` | `Execution Plan Template` |
| `docs/<ISSUE_SLUG>-task-<TASK_NUMBER>-test-spec.md` | `test-strategist` | `Test Specification Template` |
| `docs/<ISSUE_SLUG>-task-<TASK_NUMBER>-refactoring-plan.md` | `refactoring-advisor` | `Refactoring Recommendation Template` |

Each artifact must follow its matching template in
`./artifact-templates.md`. For quick boundary checks, validate the
path, owner, task identifier, and presence of the expected top-level heading.

## Artifact Lifecycle

These planning files are workflow-state artifacts for the planning pipeline:

- Keep them on disk
- Overwrite them only when the owning subagent is intentionally re-run
- Do not delete them as cleanup
- Do not commit them to git
