# Retry and Escalation

> Read this file whenever a subagent returns anything other than a clean pass.
>
> Reminder: do not repeat the same failing action without new context, a new
> fix brief, or an explicit user decision.

## Status handling

| Step / subagent          | Expected statuses                                                  | Orchestrator action |
| ------------------------ | ------------------------------------------------------------------ | ------------------- |
| `execution-starter`      | `READY`, `BLOCKED`, `ERROR`                                        | Continue on `READY`; otherwise pause before implementation |
| `task-executor`          | `COMPLETE`, `NEEDS_CONTEXT`, `BLOCKED`, `ERROR`                    | Continue on `COMPLETE`; otherwise pause |
| `documentation-writer`   | `COMPLETE`, `BLOCKED`, `ERROR`                                     | Continue on `COMPLETE`; otherwise stop and surface the blocker |
| `requirements-verifier`  | `PASS`, `FAIL`, `BLOCKED`, `ERROR`                                 | Re-run coverage fix loop on clear in-scope gaps; escalate ambiguous or blocked cases |
| Review gates             | `PASS`, `PASS WITH SUGGESTIONS`, `PASS WITH ADVISORIES`, `NEEDS FIXES`, `BLOCKED`, `ERROR` | Continue on non-blocking passes; targeted fix cycle on `NEEDS FIXES`; stop on `BLOCKED`/`ERROR` |

## When to ask the user

Ask for user input instead of improvising when any of these occur:

1. A subagent reports `NEEDS_CONTEXT` for a real business, scope, or
   architectural decision.
2. `execution-starter` reports that branch/worktree or dirty-state handling
   needs a user or orchestrator decision.
3. Required planning artifacts conflict with each other.
4. A required supporting skill or tool is missing and the run cannot proceed
   safely (including `gh` not installed or not authenticated when GitHub
   updates are mandatory for your team).
5. The same ambiguity or gate failure persists after the retry limit.
6. A GitHub operation fails with permissions or policy errors that cannot be
   resolved inside the session.

## Retry limits

- `task-executor` ambiguity/context loop: maximum **3** re-dispatches for the
  same blocker.
- Requirements coverage fix loop: maximum **3** cycles.
- Quality-gate targeted fix loop: maximum **3** cycles.

If a loop reaches its limit, stop and report accumulated findings rather than
retrying with unchanged inputs. The parent `orchestrating-github-workflow` may
then present options to the user (see `task-loop.md` quality-gate escalation
example).

## Non-blocking outcomes

Report these but do not reopen the task automatically:

- `PASS WITH SUGGESTIONS`
- `PASS WITH ADVISORIES`
- GitHub label/comment/assignee/close steps skipped because there was no child
  issue (`Not Created` / `task-list`), or `gh` was unavailable, or the team
  chose not to mutate the issue at kickoff/completion
- Pre-existing failing tests explicitly reported and outside the selected task’s
  scope

## Missing capability pattern

When a subagent reports a missing required skill or tool:

1. Surface the exact capability name.
2. Include install or setup instructions returned by the subagent (e.g. `gh auth login`).
3. Stop the pipeline at that phase.
4. Resume from the blocked phase after the user confirms the capability is
   available.
