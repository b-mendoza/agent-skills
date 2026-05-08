# Workflow Examples

> Read this file only when the orchestrator or a subagent needs an example of dispatch flow, output shape, or failure handoff.

Examples live here so the always-loaded skill and dispatched subagents stay compact. Use these examples for format and level of detail; adapt the facts to the code under refactor.

## Dispatch Round Trip

<example>
Input: `TARGET_PATH=src/subscriptions/expire-users.ts`, `USER_GOAL="simplify without changing tests"`, `TEST_COMMAND="npm test -- subscriptions"`, `MAX_LINES=250`.

1. Dispatch `behavior-mapper`.
2. Mapper returns `BEHAVIOR_MAP: PASS` with expiration rules, email side effects, `Date.now()` timing risk, line counts, and `npm test -- subscriptions` as validation.
3. Dispatch `refactor-strategist` with the behavior map and reference paths.
4. Strategist reads `./file-size-policy.md`, fetches one Functional Core / Imperative Shell URL from `./refactoring-web-resources.md`, and plans a split into decisions and notifications while keeping the original export stable.
5. Dispatch `refactor-implementer`.
6. Implementer creates `expiration-decisions.ts` and `expiration-notifications.ts`, keeps every changed file under 250 lines, and reports validation passing.
7. Dispatch `refactor-reviewer`.
8. Reviewer returns `REFACTOR_REVIEW: PASS` for behavior preservation, scope control, validation, and size compliance.
9. Orchestrator returns the final handoff without raw diffs or command logs.
</example>

## Subagent Output Samples

```text
BEHAVIOR_MAP: PASS
Target: src/subscriptions/expire-users.ts
Files inspected: src/subscriptions/expire-users.ts, src/subscriptions/expire-users.test.ts

Current behavior:
- Expires paid users when the expiration date is before or equal to the cutoff.

Inputs and outputs:
- Input is a cutoff timestamp; output is the count of expired subscriptions.

Dependencies and side effects:
- Reads subscriptions, writes expiration status, sends email notifications, uses Date.now().

Invariants and edge cases:
- Free trials are skipped; cutoff equality expires the subscription.

Existing tests and validation:
- npm test -- subscriptions

File sizes:
- src/subscriptions/expire-users.ts: 310 [OVERSIZED]

Risk notes:
- Timing and cutoff equality are most likely to drift.

Clarifying questions:
- none
```

```text
STRATEGY: PASS
Target: src/subscriptions/expire-users.ts
References fetched: https://www.destroyallsoftware.com/talks/boundaries

Design diagnosis:
- Expiration predicates and notification side effects are interleaved.

Minimal plan:
- Extract pure expiration predicates into expiration-decisions.ts.
- Extract email payload construction and sending into expiration-notifications.ts.
- Keep expireUsers as the public orchestration entry point.

File size plan:
- src/subscriptions/expire-users.ts -> ~140 lines [split]
- New file src/subscriptions/expiration-decisions.ts -> ~110 lines [extracted from src/subscriptions/expire-users.ts]
- New file src/subscriptions/expiration-notifications.ts -> ~120 lines [extracted from src/subscriptions/expire-users.ts]
Waivers: none

Non-goals:
- Do not change persistence APIs, test expectations, or notification semantics.

Implementation constraints:
- Preserve cutoff equality and the existing exported function name.

Validation expectations:
- npm test -- subscriptions passes or reports a clearly pre-existing failure.

Rationale:
- This is the smallest split that separates decisions from side effects and resolves the size violation.
```

## Failure Handoff

```text
REFACTOR_REVIEW: FAIL
Target: src/subscriptions/expire-users.ts
References fetched: none

Behavior preservation:
- PASS: cutoff equality and side effects match the behavior map.

Test integrity:
- PASS: tests were not weakened or rewritten.

Scope control:
- FAIL: the diff introduced SubscriptionExpirationService, which was not in STRATEGY.

Abstraction check:
- FAIL: the new service wraps one helper and increases indirection.

Size check:
- PASS: all changed files are under 250 lines.

Validation check:
- PASS: npm test -- subscriptions passed.

Required fixes:
- Inline SubscriptionExpirationService into plain functions in src/subscriptions/expiration-decisions.ts.

Residual risks:
- none
```
