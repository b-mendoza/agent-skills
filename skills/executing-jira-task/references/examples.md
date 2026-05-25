# Execution Examples

> Read this file only when you need a dispatch round-trip example or a
> concrete fix-cycle example. Phase order lives in `./pipeline.md`.
> Report shapes live in the template reference files and load only at return
> time.

## Happy Path

Input: `TICKET_KEY=JNS-6065`, `TASK_NUMBER=3`

1. Validate required per-task artifacts exist and Task 3 is not complete.
2. Dispatch `execution-starter`. It resolves the planner-generated branch,
   switches or checks it out, and performs eligible Jira startup updates.
3. `execution-starter` returns `KICKOFF_REPORT -> READY`.
4. Dispatch `task-executor` with paths under `docs/JNS-6065-task-3-*.md`.
5. `task-executor` returns `EXECUTION_REPORT -> COMPLETE`.
6. Dispatch `documentation-writer` with `Mode=UPDATE_TRACKING`,
   `EXECUTION_REPORT`, `TICKET_KEY`, `TASK_NUMBER`, execution brief path, and
   task plan path; it documents Category B changes and updates local tracking.
7. Dispatch `requirements-verifier`; continue only on `PASS`.
8. Run `clean-code-reviewer`, `architecture-reviewer`, `security-auditor`.
9. Dispatch `documentation-writer` with `Mode=FINALIZE_TRACKER`,
   `EXECUTION_REPORT`, the previous `DOCUMENTATION_REPORT`, and passing gate
   summaries; it performs eligible final Jira completion updates or records
   skips.
10. Return `FINAL_TASK_REPORT -> COMPLETE` with kickoff outcome, verdicts,
   retry counts, files changed, Category A tracking paths, startup and final
   Jira update results, and next action `None`.

## Targeted Fix Path

Input: `TICKET_KEY=JNS-6065`, `TASK_NUMBER=3`

1. `execution-starter` returns `READY` after switching to the task branch.
2. `task-executor` returns `COMPLETE`.
3. `documentation-writer` returns `COMPLETE`.
4. `requirements-verifier` returns `FAIL` because one DoD item is untested.
5. Build a requirements fix brief and increment requirements fix attempts to 1.
6. Re-dispatch `task-executor` with only the verifier gap summary.
7. Re-dispatch `documentation-writer` with `Mode=UPDATE_TRACKING` for the new
   Category B delta.
8. Re-run `requirements-verifier`.
9. Continue into review gates only after requirements pass.
10. If one gate returns `NEEDS FIXES`, re-run only that gate's targeted fix
    cycle, not the whole pipeline, while that gate's fix attempts remain below
    3.

## Exhausted Fix Path

Input: `TICKET_KEY=JNS-6065`, `TASK_NUMBER=3`

1. `security-auditor` returns `NEEDS FIXES`.
2. Build a security fix brief and re-dispatch `task-executor`.
3. Re-dispatch `documentation-writer` with `Mode=UPDATE_TRACKING`.
4. Re-run `security-auditor` only.
5. If the third security fix attempt still returns `NEEDS FIXES`, stop and
   return `FINAL_TASK_REPORT -> ESCALATED` with accumulated security findings,
   retry counts, changed files, Category A tracking paths, and next required
   action.

## Decision Stop Path

Input: `TICKET_KEY=JNS-6065`, `TASK_NUMBER=3`

1. `task-executor` returns `NEEDS_CONTEXT` for a real scope decision.
2. Read `./retry-and-escalation.md`.
3. Because no fix brief or user decision exists yet, do not re-dispatch the
   executor.
4. Return `FINAL_TASK_REPORT -> STOPPED_FOR_USER_INPUT` with the exact decision
   needed.
