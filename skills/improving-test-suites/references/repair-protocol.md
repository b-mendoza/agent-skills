# Repair Protocol

> Load this file only after validation returns `FAIL`, `BLOCKED`, or repeated
> `ERROR`, or when a subagent status requires recovery beyond normal routing.

Use targeted repair cycles. The orchestrator keeps only the failure summary,
changed files, decision needed, and retry count in context.

## Targeted Repair Loop

1. Identify the smallest failing gate and the likely cause from
   `TEST_VALIDATION` or the subagent report.
2. Redispatch only the subagent that can fix or clarify that failure.
3. Pass only the concise failure summary, changed file paths, relevant prior
   decision, and current retry count.
4. Re-run only the previously failing validation command or check.
5. Stop after three targeted repair cycles and report the remaining blocker.

## Validation Failure Routing

| Likely cause | Action |
| ------------ | ------ |
| `test refactor regression` | Redispatch `test-refactorer` with the validation failure summary, then rerun `test-validator` |
| `production bug exposed` and implementation changes are outside scope | Keep the high-signal failing test and report the production bug candidate |
| `production bug exposed` and implementation changes are in scope | Ask before expanding beyond test-suite improvement unless the user already requested implementation fixes |
| `pre-existing failure` | Report the validation limitation instead of treating it as a refactor regression |
| `unknown` | Retry validation once if command/environment failure is plausible; otherwise report the blocker |

## Blocked Or Error Routing

| Status | Action |
| ------ | ------ |
| `BLOCKED` | Ask the smallest question or report the missing file, command, tool, or permission |
| `NEEDS_CLARIFICATION` | Ask one focused question that unlocks the next dispatch |
| first `ERROR` | Retry the same dispatch once with the same inputs |
| repeated `ERROR` | Stop the workflow and hand off completed work plus the blocker |

## Handoff After Repair

Before the final response, load `./final-handoff-template.md`.
Include the repair count, final validation result, unresolved blockers, skipped
optional reviews, and any likely production bug candidate in `Remaining risks`.
