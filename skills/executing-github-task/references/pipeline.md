# Execution Pipeline

> Read this file when running the normal task-execution phases.
>
> Reminder: dispatch specialists and pass compact inputs. Do not carry raw file
> contents or logs through the orchestrator.
>
> `./contracts.md` remains the authoritative source for readiness checks and
> dispatch input contracts. This file is the ordered runbook.

## Standard phase cycle

Every successful task run follows this sequence:

1. **Validate prerequisites.**
   - Read `./contracts.md`.
   - Confirm the **Phase 7 handoff**: the issue snapshot, the task plan, the
     four Phase 5 artifacts, and `critique.md` plus `decisions.md` exist for
     this `TASK_NUMBER`, matching the parent orchestrator's Phase 5–7 data
     contracts.
   - Stop immediately if required artifacts are missing, contradictory, or the
     selected task is not ready.

2. **Dispatch `execution-starter`.**
   - Pass `ISSUE_SLUG`, `TASK_NUMBER`, issue snapshot path, task plan path, and
     execution brief path.
   - Treat this as the explicit **execution kickoff** — the **first mutation
     boundary after critique approval** (including the first `gh` actions
     reserved for starting implementation on GitHub).
   - Collect only the structured `KICKOFF_REPORT`.
   - On a Phase 7 resume, kickoff is **idempotent**: if startup conditions were
     already satisfied or GitHub state already reflects “in progress,” record
     the current state and continue instead of duplicating comments or labels.

3. **Handle kickoff results before continuing.**
   - `READY` means the task has crossed the execution boundary and can proceed.
   - `BLOCKED` or `ERROR` means stop normal execution and use
     `./retry-and-escalation.md`.

4. **Dispatch `task-executor`.**
   - Pass artifact paths under `docs/<ISSUE_SLUG>-task-<N>-*.md`, the
     required `docs/<ISSUE_SLUG>-task-<N>-decisions.md`, optional
     `docs/<ISSUE_SLUG>-task-<N>-critique.md`, and any targeted fix brief.
   - Collect only the structured `EXECUTION_REPORT`.

5. **Handle executor escalations before continuing.**
   - `COMPLETE` means continue.
   - `NEEDS_CONTEXT`, `BLOCKED`, or `ERROR` means stop normal execution and use
     `./retry-and-escalation.md`.

6. **Dispatch `documentation-writer`.**
   - Pass `EXECUTION_REPORT`, `ISSUE_SLUG`, and `TASK_NUMBER`.
   - This step adds in-code documentation, commits Category B files, updates
     Category A tracking in `docs/<ISSUE_SLUG>-tasks.md`, and performs optional
     `gh` completion updates when a task issue exists and policy requires it.
   - Collect only the structured `DOCUMENTATION_REPORT`.

7. **Handle documentation results before continuing.**
   - `COMPLETE` means continue.
   - `BLOCKED` or `ERROR` means stop normal execution and use
     `./retry-and-escalation.md`.

8. **Dispatch `requirements-verifier`.**
   - Pass brief path, test spec path, `EXECUTION_REPORT`, and
     `DOCUMENTATION_REPORT`.
   - Postcondition for implementation completeness before review gates.

9. **Resolve requirements gaps before review gates.**
   - If the verifier returns `PASS`, continue.
   - If it returns `BLOCKED`, stop the pipeline immediately. Missing required
     capability, missing access, or blocked documentation is not a normal fix
     loop; use `./retry-and-escalation.md` and resume only after the blocker is
     resolved.
   - If it returns `FAIL` and the gaps are plainly in scope, create a concise
     fix brief from the reported gaps, re-dispatch `task-executor`, then
     `documentation-writer`, then re-run `requirements-verifier`.
   - If the reported gaps expose an ambiguous brief, conflicting artifacts, or
     a probable planning mistake, stop and ask the user.

10. **Run the quality gates in order.**
   - `clean-code-reviewer`
   - `architecture-reviewer`
   - `security-auditor`

11. **Interpret gate verdicts.**
    - `PASS`, `PASS WITH SUGGESTIONS`, and `PASS WITH ADVISORIES` let the
      pipeline continue.
    - `NEEDS FIXES` triggers the targeted fix cycle below.
    - `BLOCKED` or `ERROR` stops the run and escalates.

12. **Report the outcome.**
    - Summarise what changed.
    - Include kickoff status, commit hashes/messages, gate verdicts, files
      changed, and any GitHub/`gh` steps skipped or failed.
    - Stop after the selected task. Do not continue to the next task
      automatically.

## Targeted fix cycle

When one or more reviewers return `NEEDS FIXES`:

1. Consolidate only the blocking issues from the failing gates into a single
   fix brief.
2. Re-dispatch `task-executor` with the original planning artifacts plus that
   fix brief.
3. Re-dispatch `documentation-writer` so new Category B changes are committed
   and tracking artifacts are updated.
4. Re-run only the gate(s) that previously failed, in their original order.
5. If every previously failing gate now passes, finish the task. Otherwise use
   `./retry-and-escalation.md`.

## Report template

Use a short final summary shaped like this:

```markdown
Task <N> complete: <title>

Summary: <2-3 sentences>

Pipeline:
- Kickoff: <status>
- Execution: <status>
- Documentation/commits: <status>
- Requirements verification: <verdict>
- Clean code review: <verdict>
- Architecture review: <verdict>
- Security audit: <verdict>

Commits:
- <short hash> - <message>

Files changed:
- <path>

Remaining items:
- <issue or "None">
```
