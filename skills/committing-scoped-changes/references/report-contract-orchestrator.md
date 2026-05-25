# Report Contract: Orchestrator Final Report

> Read this file only when formatting the final user-facing report at the end of
> the workflow. Return compact facts; never paste raw diffs, copied article
> text, or full command logs.

## Success Structure

```text
Commits created:
- <sha> <message>
  Summary: <what changed and why>
  Verification: <check run or "not run: reason">

Remaining scoped changes: <none or concise list>
Unrelated changes left untouched: <none or concise list>
Post-commit refresh: <SCOPED_STATE: PASS | NO_SCOPED_CHANGES and one-line result>
References fetched: <none or concise list>
```

## Failure Structure

```text
COMMIT_SCOPED_CHANGES: <status>
Status values: BLOCKED | NEEDS_CONTEXT | NO_SCOPED_CHANGES | VERIFY_FAILED | COMMIT_ERROR | ERROR
Commits created before failure: <none or compact list of sha and message>
Reason: <one line>
Next step: <one clear action or question>
```

## Status Mapping

Use the exact `COMMIT_SCOPED_CHANGES` status from the flow terminal node:

| Source status | Final status |
| ------------- | ------------ |
| No commit request authority | `COMMIT_SCOPED_CHANGES: BLOCKED` |
| Missing or ambiguous `CHANGE_PATHS` | `COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT` |
| `SCOPED_STATE: NEEDS_CONTEXT` | `COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT` |
| `COMMIT_PLAN: NEEDS_DECISION` | `COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT` |
| `COMMIT_EXECUTE: VERIFY_FAILED` with `Recovery classification: needs-user-decision` | `COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT` |
| `COMMIT_EXECUTE: VERIFY_FAILED` with `Recovery classification: terminal` or retry attempts exhausted | `COMMIT_SCOPED_CHANGES: VERIFY_FAILED` |
| `SCOPED_STATE: NO_SCOPED_CHANGES` before commits | `COMMIT_SCOPED_CHANGES: NO_SCOPED_CHANGES` |
| `G_SCOPE_EXPANSION` declined | `COMMIT_SCOPED_CHANGES: BLOCKED` |
| `G_IN_SCOPE_OMISSION` declined | `COMMIT_SCOPED_CHANGES: BLOCKED` |
| Any subagent `BLOCKED` status | `COMMIT_SCOPED_CHANGES: BLOCKED` |
| `COMMIT_EXECUTE: COMMIT_ERROR` | `COMMIT_SCOPED_CHANGES: COMMIT_ERROR` |
| Any subagent `ERROR` status | `COMMIT_SCOPED_CHANGES: ERROR` |

## Examples

<example>
Commits created:
- abc1234 fix(checkout): retry failed payment confirmation
  Summary: Adds retry handling for failed checkout confirmation and covers it with checkout tests.
  Verification: npm test -- checkout

Remaining scoped changes: none
Unrelated changes left untouched: README.md modified
Post-commit refresh: SCOPED_STATE: NO_SCOPED_CHANGES - no scoped changes remain after commit.
References fetched: none
</example>

<example>
COMMIT_SCOPED_CHANGES: NO_SCOPED_CHANGES
Commits created before failure: none
Reason: src/payments/ has no tracked, staged, or untracked changes.
Next step: Confirm the intended path scope or skip the commit request.
</example>
