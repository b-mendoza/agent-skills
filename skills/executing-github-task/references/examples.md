# Execution Examples

Read this file only when you need a dispatch round-trip example or a concrete
fix-cycle example. The normal phase order lives in `./pipeline.md`.

## Happy Path

Input:

- `ISSUE_SLUG=acme-app-42`
- `TASK_NUMBER=3`

1. Validate the required per-task artifacts exist and Task 3 is not already
   complete.
2. Dispatch `execution-starter` for kickoff. It resolves the planner-generated
   branch, switches or checks out that branch, and performs eligible GitHub
   startup updates with `gh`.
3. `execution-starter` returns `KICKOFF_REPORT -> READY`.
4. Dispatch `task-executor` with artifact paths under
   `docs/acme-app-42-task-3-*.md`.
5. `task-executor` returns `EXECUTION_REPORT -> COMPLETE`.
6. Dispatch `documentation-writer` with `EXECUTION_REPORT`, `ISSUE_SLUG`, and
   `TASK_NUMBER`; it documents changed Category B files and updates task
   tracking artifacts.
7. Dispatch `requirements-verifier`; continue only on `PASS`.
8. Run `clean-code-reviewer`, then `architecture-reviewer`, then
   `security-auditor`.
9. Report kickoff outcome, final verdicts, files changed, and skipped GitHub
   updates.

## Targeted Fix Path

Input:

- `ISSUE_SLUG=acme-app-42`
- `TASK_NUMBER=3`

1. `execution-starter` returns `READY` after switching to the task branch.
2. `task-executor` returns `COMPLETE`.
3. `documentation-writer` returns `COMPLETE`.
4. `requirements-verifier` returns `FAIL` because one DoD item is still untested.
5. Re-dispatch `task-executor` with only the verifier gap summary.
6. Re-dispatch `documentation-writer` for the new Category B delta.
7. Re-run `requirements-verifier`.
8. Continue into review gates only after requirements pass.
9. If one gate returns `NEEDS FIXES`, re-run only that gate's targeted fix cycle
   instead of the whole pipeline.
