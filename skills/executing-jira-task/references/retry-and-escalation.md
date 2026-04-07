# Retry and Escalation

> Read this file whenever a subagent returns anything other than a clean pass.
>
> Reminder: do not repeat the same failing action without new context, a new
> fix brief, or an explicit user decision.

## Status handling

| Step / subagent          | Expected statuses                                                  | Orchestrator action |
| ------------------------ | ------------------------------------------------------------------ | ------------------- |
| `task-executor`          | `COMPLETE`, `NEEDS_CONTEXT`, `BLOCKED`, `ERROR`                    | Continue on `COMPLETE`; otherwise pause and resolve before continuing |
| `documentation-writer`   | `COMPLETE`, `BLOCKED`, `ERROR`                                     | Continue on `COMPLETE`; otherwise stop and surface the blocker |
| `requirements-verifier`  | `PASS`, `FAIL`, `BLOCKED`, `ERROR`                                 | Re-run coverage fix loop on clear in-scope gaps; escalate ambiguous or blocked cases |
| Review gates             | `PASS`, `PASS WITH SUGGESTIONS`, `PASS WITH ADVISORIES`, `NEEDS FIXES`, `BLOCKED`, `ERROR` | Continue on non-blocking passes; run targeted fix cycle on `NEEDS FIXES`; stop on `BLOCKED`/`ERROR` |

## When to ask the user

Ask for user input instead of improvising when any of these occur:

1. A subagent reports `NEEDS_CONTEXT` for a real business, scope, or
   architectural decision.
2. Required planning artifacts conflict with each other.
3. A required supporting skill or MCP capability is missing and the run cannot
   proceed safely.
4. The same ambiguity or gate failure persists after the retry limit.
5. A Jira update requires credentials or permissions that are not available in
   the current environment.

## Retry limits

- `task-executor` ambiguity/context loop: maximum 3 re-dispatches for the same
  blocker.
- Requirements coverage fix loop: maximum 3 cycles.
- Quality-gate targeted fix loop: maximum 3 cycles.

If a loop reaches its limit, stop and report the accumulated findings rather
than trying again with unchanged inputs.

## Non-blocking outcomes

These should be reported but should not reopen the task automatically:

- `PASS WITH SUGGESTIONS`
- `PASS WITH ADVISORIES`
- Jira transition/comment skipped because no key or no authenticated Jira
  capability was available
- Pre-existing failing tests that were explicitly reported and are outside the
  selected task's scope

## Missing capability pattern

When a subagent reports a missing required skill or tool:

1. Surface the exact capability name.
2. Include the install or setup instruction returned by the subagent.
3. Stop the pipeline at that phase.
4. Resume from the blocked phase after the user confirms the capability is
   available.
