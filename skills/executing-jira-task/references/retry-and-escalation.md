# Retry and Escalation

> Read this file whenever a subagent returns anything other than a clean pass.
>
> Reminder: do not repeat the same failing action without new context, a new
> fix brief, or an explicit user decision.

## Status handling

| Step / subagent | Expected statuses | Orchestrator action |
| --------------- | ----------------- | ------------------- |
| `execution-starter` | `READY`, `BLOCKED`, `ERROR` | Continue on `READY`; otherwise pause and resolve before implementation starts |
| `task-executor` | `COMPLETE`, `NEEDS_CONTEXT`, `BLOCKED`, `ERROR` | Continue on `COMPLETE`; otherwise pause and resolve |
| `documentation-writer` | `COMPLETE`, `BLOCKED`, `ERROR` | Continue on `COMPLETE`; otherwise stop and surface the blocker |
| `requirements-verifier` | `PASS`, `FAIL`, `BLOCKED`, `ERROR` | Re-run coverage fix loop only on clear in-scope `FAIL` gaps; stop and resolve blocked cases first |
| Review gates | `PASS`, `PASS WITH SUGGESTIONS`, `PASS WITH ADVISORIES`, `NEEDS FIXES`, `BLOCKED`, `ERROR` | Continue on non-blocking passes; targeted fix cycle on `NEEDS FIXES`; stop on `BLOCKED`/`ERROR` |

## When to ask the user

Ask for user input rather than improvising when:

1. A subagent reports `NEEDS_CONTEXT` for a real business, scope, or
   architectural decision.
2. `execution-starter` reports that branch resolution, branch checkout,
   worktree, or dirty-state handling needs a decision.
3. Required planning artifacts conflict with each other.
4. A required supporting skill, tool, runtime, permission, or environment
   capability is missing and the run cannot proceed safely. Includes the
   tracker CLI or API being unavailable when tracker updates are mandatory.
5. The same ambiguity or gate failure persists after the retry limit.
6. A tracker operation fails with permissions or policy errors that cannot
   be resolved inside the session.

## Retry limits

- `task-executor` ambiguity/context loop: max 3 re-dispatches per blocker.
- Requirements coverage fix loop: max 3 cycles.
- Quality-gate targeted fix loop: max 3 cycles.

If a loop reaches its limit, stop and report findings instead of trying again
with unchanged inputs.

## Non-blocking outcomes

Reported but should not reopen the task:

- `PASS WITH SUGGESTIONS`
- `PASS WITH ADVISORIES`
- Tracker updates skipped because the reference was a placeholder, the
  integration was unavailable, or the team chose not to mutate the tracker
- Pre-existing failing tests outside the selected task's scope

## Missing capability pattern

When a subagent reports a missing required skill or tool:

1. Surface the exact capability name.
2. Include the install or setup instructions returned by the subagent.
3. Stop the pipeline at that phase.
4. Resume after the user confirms the capability is available.

This rule also applies when a missing capability is discovered during task
execution or required validation, not only during initial preflight.
