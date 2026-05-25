# Report Contract: scoped-commit-executor

> Read this file only when formatting the result of the commit executor
> subagent. Return compact facts; never paste raw diffs or full command output.

## Structure

```text
COMMIT_EXECUTE: PASS | VERIFY_FAILED | BLOCKED | COMMIT_ERROR | ERROR
Group ID: <group-id>
Approved commit scope: <paths>
Commit: <short-sha or none>
Message: <commit message>
Staged diff reviewed: yes | no
Verification: pass | fail | not-run
Verification command: none | <command>
Index preservation: no pre-existing staged changes | preserved | blocked: <reason>
Recovery classification: none | same-scope-same-group-retry | needs-user-decision | terminal
References fetched: none | <urls and one-line conclusions>
Summary: <what changed and why>
Remaining scoped changes: unknown | none | <concise list>

Reason: none | <why status is not PASS>
Decision needed: none | <smallest recovery action>
```

`Remaining scoped changes` is `unknown` unless the executor performed a fresh
state inspection after the commit. The orchestrator typically refreshes state by
re-dispatching `scoped-state-summarizer`.

For `COMMIT_EXECUTE: VERIFY_FAILED`, set `Recovery classification` precisely.
Use `same-scope-same-group-retry` only when the next attempt keeps the same
approved group and stays inside `APPROVED_COMMIT_SCOPE`. Use
`needs-user-decision` for commit-without-verification, changed grouping, changed
scope, or recovery that cannot be chosen safely by the executor. Use `terminal`
when no safe recovery is available.

## Examples

<example>
COMMIT_EXECUTE: PASS
Group ID: checkout-retry-fix
Approved commit scope: src/checkout/; tests/checkout/
Commit: abc1234
Message: fix(checkout): retry failed payment confirmation
Staged diff reviewed: yes
Verification: pass
Verification command: npm test -- checkout
Index preservation: no pre-existing staged changes
Recovery classification: none
References fetched: none
Summary: Adds retry handling for failed checkout confirmation and covers it with checkout tests.
Remaining scoped changes: unknown

Reason: none
Decision needed: none
</example>

<example>
COMMIT_EXECUTE: VERIFY_FAILED
Group ID: checkout-retry-fix
Approved commit scope: src/checkout/; tests/checkout/
Commit: none
Message: fix(checkout): retry failed payment confirmation
Staged diff reviewed: yes
Verification: fail
Verification command: npm test -- checkout
Index preservation: preserved
Recovery classification: needs-user-decision
References fetched: none
Summary: Retry behavior and tests were staged, but checkout tests failed.
Remaining scoped changes: unknown

Reason: Checkout retry exhaustion test failed after staging the planned group.
Decision needed: Fix the failing checkout test inside the current scope or ask whether to commit without this verification.
</example>
