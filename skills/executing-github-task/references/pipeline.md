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
   - Pass `EXECUTION_REPORT`, `ISSUE_SLUG`, and `TASK_NUMBER`.
   - Adds in-code documentation, updates Category A tracking in
     `docs/<ISSUE_SLUG>-tasks.md`, and performs optional `gh` completion
     updates when a task issue exists and policy requires.
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
   - `BLOCKED` stops the pipeline; use `./retry-and-escalation.md` and resume
     only after the blocker is resolved.
   - `FAIL` with in-scope gaps: build a concise fix brief from the reported
     gaps, re-dispatch `task-executor`, then `documentation-writer`, then
     re-run `requirements-verifier`.
   - If the gaps expose ambiguous brief, conflicting artifacts, or a probable
     planning mistake: stop and ask the user.

10. **Run quality gates in order.** `clean-code-reviewer`,
    `architecture-reviewer`, then `security-auditor`.

11. **Interpret gate verdicts.**
    - `PASS`, `PASS WITH SUGGESTIONS`, `PASS WITH ADVISORIES`: continue.
    - `NEEDS FIXES`: trigger the targeted fix cycle below.
    - `BLOCKED` or `ERROR`: stop and escalate.

12. **Report the outcome.**
    - Read `./template-final-report.md` only when assembling the final
      user-facing report.
    - Summarise what changed: kickoff status, gate verdicts, files changed,
      any GitHub/`gh` steps skipped or failed.
    - Stop after the selected task. Do not auto-continue.

## Targeted fix cycle

When one or more reviewers return `NEEDS FIXES`:

1. Consolidate only the blocking issues from failing gates into a single fix
   brief.
2. Re-dispatch `task-executor` with original planning artifacts plus the fix
   brief.
3. Re-dispatch `documentation-writer` so new Category B changes are documented
   and tracking artifacts are updated.
4. Re-run only the previously failing gate(s), in original order.
5. If every previously failing gate now passes, finish the task. Otherwise use
   `./retry-and-escalation.md`.

The final report shape lives in `./template-final-report.md` so the template
loads only at the reporting boundary.
