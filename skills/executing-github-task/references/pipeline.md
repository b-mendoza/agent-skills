# Execution Pipeline

> Read this file when running the normal task-execution phases.
>
> Reminder: dispatch specialists and pass compact inputs. Do not carry raw
> file contents or logs through the orchestrator.
>
> `./contracts.md` is authoritative for readiness checks and dispatch handoff
> shapes; this file is the ordered runbook.

## Standard phase cycle

1. **Validate prerequisites.**
   - Read `./contracts.md`.
   - Confirm the issue snapshot, task plan, per-task brief, execution plan,
     test spec, refactoring plan, critique, and decisions all exist for this
     `TASK_NUMBER`.
   - Stop if any required artifact is missing, contradictory, or the task is
     not ready.

2. **Dispatch `execution-starter`.**
   - Pass `ISSUE_SLUG`, `TASK_NUMBER`, issue snapshot path, task plan path,
     and execution brief path.
   - It must resolve the planner-generated branch and switch or check out
     that branch before returning `READY`.
   - Treat this as the **first mutation boundary after critique approval**
     (including the first `gh` actions reserved for starting implementation).
   - Collect only the structured `KICKOFF_REPORT`.
   - On resume, kickoff is idempotent: if GitHub already reflects "in
     progress" state, record current state and continue without duplicating
     comments or labels.

3. **Handle kickoff results.**
   - `READY` continues. `BLOCKED` or `ERROR` stops normal execution; use
     `./retry-and-escalation.md`.

4. **Dispatch `task-executor`.**
   - Pass artifact paths under `docs/<ISSUE_SLUG>-task-<N>-*.md`, the
     required `decisions.md`, optional `critique.md`, and any fix brief.
   - Collect only the structured `EXECUTION_REPORT`.

5. **Handle executor escalations.**
   - `COMPLETE` continues. `NEEDS_CONTEXT`, `BLOCKED`, or `ERROR` stops; use
     `./retry-and-escalation.md`.

6. **Dispatch `documentation-writer`.**
   - Pass `Mode=UPDATE_TRACKING`, `EXECUTION_REPORT`, `ISSUE_SLUG`,
     `TASK_NUMBER`, execution brief path, and task plan path.
   - Adds in-code documentation, updates Category A tracking in
     `docs/<ISSUE_SLUG>-tasks.md`, records implementation status and completion
     eligibility, and defers final GitHub completion actions.
   - Collect only the structured `DOCUMENTATION_REPORT`.

7. **Handle documentation results.**
   - `COMPLETE` continues. `BLOCKED` or `ERROR` stops; use
     `./retry-and-escalation.md`.

8. **Dispatch `requirements-verifier`.**
   - Pass brief path, test spec path, `EXECUTION_REPORT`,
     `DOCUMENTATION_REPORT`. Postcondition for implementation completeness
     before review gates.

9. **Resolve requirements gaps before review gates.**
   - `PASS` continues.
   - `BLOCKED` or `ERROR` stops the pipeline; use
     `./retry-and-escalation.md` and resume only after the blocker or upstream
     failure is resolved.
   - `FAIL` with in-scope gaps: build a concise fix brief from the reported
     gaps, re-dispatch `task-executor`, then `documentation-writer` with
     `Mode=UPDATE_TRACKING`, then re-run `requirements-verifier`. Maximum: 3
     requirements fix attempts.
   - If the verifier returns `BLOCKED` for an ambiguous brief, conflicting
     artifacts, missing required context, or a probable planning mistake: stop
     and ask the user for the smallest decision that unblocks the task.

10. **Run quality gates in order.** `clean-code-reviewer`,
    `architecture-reviewer`, then `security-auditor`.

11. **Interpret gate verdicts.**
    - `PASS`, `PASS WITH SUGGESTIONS`, `PASS WITH ADVISORIES`: continue.
    - `NEEDS FIXES`: trigger the targeted fix cycle below.
    - `BLOCKED` or `ERROR`: stop and escalate.

12. **Finalize tracker completion.**
    - After requirements verification and all quality gates have passed,
      re-dispatch `documentation-writer` with `Mode=FINALIZE_TRACKER`, the
      `EXECUTION_REPORT`, previous `DOCUMENTATION_REPORT`,
      `VERIFICATION_RESULT`, `CODE_REVIEW`, `ARCHITECTURE_REVIEW`,
      `SECURITY_AUDIT`, `ISSUE_SLUG`, `TASK_NUMBER`, execution brief path, and
      task plan path.
    - It may perform final GitHub completion comments, closure, or label
      changes only when a concrete task issue exists and policy requires.
    - Collect `FINAL_TRACKING_REPORT`. `COMPLETE` continues; `BLOCKED` or
      `ERROR` stops normal execution and uses `./retry-and-escalation.md`.

13. **Report the outcome.**
    - Read `./template-final-report.md` only when assembling the final
      `FINAL_TASK_REPORT`.
    - Summarise what changed: kickoff status, gate verdicts, files changed,
      final tracker completion, and any GitHub/`gh` steps skipped or failed.
    - Include retry counts, Category A tracking paths, unresolved blockers, and
      the next required action.
    - Stop after the selected task. Do not auto-continue.

## Requirements fix cycle

When `requirements-verifier` returns `FAIL` for ordinary in-scope gaps:

1. Build a concise requirements fix brief from verifier findings.
2. Re-dispatch `task-executor` with the original planning artifacts plus that
   fix brief.
3. Re-dispatch `documentation-writer` so new Category B changes are documented
   and Category A tracking artifacts are updated with `Mode=UPDATE_TRACKING`.
4. Re-run `requirements-verifier`.
5. If the verifier still returns `FAIL`, repeat only while the requirements fix
   attempt count is below 3.
6. If the third attempt still fails, assemble `FINAL_TASK_REPORT` with status
   `ESCALATED` and include the verifier findings.

## Targeted fix cycle

When one or more reviewers return `NEEDS FIXES`:

1. Consolidate only the blocking issues from the failing gate into a fix brief.
2. Re-dispatch `task-executor` with original planning artifacts plus the fix
   brief.
3. Re-dispatch `documentation-writer` so new Category B changes are documented
   and tracking artifacts are updated with `Mode=UPDATE_TRACKING`.
4. Re-run only the previously failing gate(s), in original order.
5. If every previously failing gate now passes, resume at the next gate or
   final report boundary.
6. If the gate still returns `NEEDS FIXES`, repeat only while that gate's fix
   attempt count is below 3.
7. If the third attempt still fails, assemble `FINAL_TASK_REPORT` with status
   `ESCALATED` and include the accumulated gate findings.

The final report shape lives in `./template-final-report.md` so the template
loads only at the reporting boundary.
