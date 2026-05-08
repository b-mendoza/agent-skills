# Report Contracts

> Read this file only when formatting a subagent result or the final user report.
> Return compact facts, not raw diffs, copied documentation, or full command logs.

## Orchestrator Final Report

Use this success structure:

```text
Commits created:
- <sha> <message>
  Summary: <what changed and why>
  Verification: <check run or "not run: reason">

Remaining scoped changes: <none or concise list>
Unrelated changes left untouched: <none or concise list>
References fetched: <none or concise list>
```

Use this failure structure:

```text
COMMIT_SCOPED_CHANGES: <status>
Status values: BLOCKED | NEEDS_CONTEXT | NO_SCOPED_CHANGES | VERIFY_FAILED | COMMIT_ERROR | ERROR
Reason: <one line>
Next step: <one clear action or question>
```

<example>
Commits created:
- abc1234 fix(checkout): retry failed payment confirmation
  Summary: Adds retry handling for failed checkout confirmation and covers it with checkout tests.
  Verification: npm test -- checkout

Remaining scoped changes: none
Unrelated changes left untouched: README.md modified
References fetched: none
</example>

## `scoped-state-summarizer`

Use this structure:

```text
SCOPED_STATE: PASS | NEEDS_CONTEXT | NO_SCOPED_CHANGES | BLOCKED | ERROR
Path scope:
- <path>: tracked | untracked | missing | mixed

Scoped changes:
- <file or area>: <concise behavioral or structural summary>

Staged scoped changes: none | <concise summary>
Untracked in scope: none | <concise list>
Unrelated changes outside scope: none | <concise list or count>
Mixed-hunk risk: none | <file and reason>
Tests in scope: none | <test files or test-relevant changes>
Recent commit style: <observed style or unknown>
Local context: none | found | missing
Context summary: none | <1-3 bullets>
Reference need: none | git-workflow | git-status | git-diff | git-add | interactive-staging | git-commit | conventional-commits | atomic-commits | commit-message-style
References fetched: none | <urls and one-line conclusions>

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user decision or orchestrator action>
```

<example>
SCOPED_STATE: PASS
Path scope:
- src/checkout/: tracked
- tests/checkout/: tracked

Scoped changes:
- src/checkout/retry.ts: adds retry handling for failed payment confirmation
- tests/checkout/retry.test.ts: covers retry success and retry exhaustion

Staged scoped changes: none
Untracked in scope: none
Unrelated changes outside scope: README.md modified
Mixed-hunk risk: none
Tests in scope: tests/checkout/retry.test.ts
Recent commit style: Conventional Commits with checkout scope
Local context: found
Context summary: JNS-6880 describes transient payment confirmation failures after provider timeout.
Reference need: none
References fetched: none

Reason: none
Decision needed: none
</example>

<example>
SCOPED_STATE: NEEDS_CONTEXT
Reason: The scoped diff changes retry behavior and telemetry naming, but no matching context explains whether they are one intent.
Decision needed: Ask whether telemetry naming belongs with the retry fix or should be separate.
</example>

## `commit-boundary-planner`

Use this structure:

```text
COMMIT_PLAN: PASS | NEEDS_DECISION | BLOCKED | ERROR
Plan summary: <one sentence>
References fetched: none | <urls and one-line conclusions>

Groups:
- ID: <group-id>
  Intent: <single reason>
  Include: <paths or hunk descriptions>
  Exclude: <related but separate paths/hunks or none>
  Message: <proposed commit message>
  Verification: <smallest meaningful check or not-run reason>
  Staging notes: <file-level staging or exact mixed-hunk caution>
  Risk notes: none | <concise risk>

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user decision or orchestrator action>
```

<example>
COMMIT_PLAN: PASS
Plan summary: One atomic fix commit covers retry behavior and its tests.
References fetched: none

Groups:
- ID: checkout-retry-fix
  Intent: Retry transient payment confirmation failures described by JNS-6880.
  Include: src/checkout/retry.ts; tests/checkout/retry.test.ts
  Exclude: none
  Message: fix(checkout): retry failed payment confirmation
  Verification: npm test -- checkout
  Staging notes: file-level staging is sufficient
  Risk notes: retry behavior changes payment confirmation timing

Reason: none
Decision needed: none
</example>

<example>
COMMIT_PLAN: NEEDS_DECISION
Plan summary: Scoped changes contain a behavior fix and a telemetry rename.
References fetched: https://www.aleksandrhovhannisyan.com/blog/atomic-git-commits/ - atomic commits should have one reason and be independently revertable.

Groups: none

Reason: Telemetry rename may be cleanup or part of the checkout fix; the context does not say.
Decision needed: Ask whether telemetry naming should be committed separately from retry behavior.
</example>

## `scoped-commit-executor`

Use this structure:

```text
COMMIT_EXECUTE: PASS | VERIFY_FAILED | BLOCKED | COMMIT_ERROR | ERROR
Group ID: <group-id>
Commit: <short-sha or none>
Message: <commit message>
Staged diff reviewed: yes | no
Verification: pass | fail | not-run
Verification command: none | <command>
References fetched: none | <urls and one-line conclusions>
Summary: <what changed and why>
Remaining scoped changes: unknown | none | <concise list>

Reason: none | <why status is not PASS>
Decision needed: none | <smallest recovery action>
```

<example>
COMMIT_EXECUTE: PASS
Group ID: checkout-retry-fix
Commit: abc1234
Message: fix(checkout): retry failed payment confirmation
Staged diff reviewed: yes
Verification: pass
Verification command: npm test -- checkout
References fetched: none
Summary: Adds retry handling for failed checkout confirmation and covers it with checkout tests.
Remaining scoped changes: unknown

Reason: none
Decision needed: none
</example>

<example>
COMMIT_EXECUTE: VERIFY_FAILED
Group ID: checkout-retry-fix
Commit: none
Message: fix(checkout): retry failed payment confirmation
Staged diff reviewed: yes
Verification: fail
Verification command: npm test -- checkout
References fetched: none
Summary: Retry behavior and tests were staged, but checkout tests failed.
Remaining scoped changes: unknown

Reason: Checkout retry exhaustion test failed after staging the planned group.
Decision needed: Fix the failing checkout test inside the current scope or ask whether to commit without this verification.
</example>
