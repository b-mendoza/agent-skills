# Testing principles

Long-lived guidance for the offline vitest suites. The current state of the
suite (which checks exist, commands, exit codes) lives in the short-lived
[verification reference](../verification.md).

## What to test

- **Test our code's decisions, not upstream contracts.** Assert on
  branching logic, routing, configuration wiring, and the transformations
  our code performs. Do not test behavior owned by a dependency (a
  constructor throwing on invalid input, an SDK raising its own error
  type).
- **Test current behavior, not hypothetical future logic.** If production
  code passes a value through unchanged, do not assert on that value. Add
  the test when the transformation is added.
- **Apply risk-based coverage.** Core business logic (case selection,
  sequencing, budget stops, mutation-evidence gathering) deserves thorough
  testing. Simple pass-throughs, getters, and guarantees the type system
  already enforces need little or none.

## What not to test

- **Mock pass-through.** If a test sets a mock return value and asserts the
  result equals it, it tests `return input`, not business logic. Remove
  these.
- **Dependency internals.** Do not build test infrastructure (schemas,
  parsers) that mirrors a third-party library's internal shape — the Agent
  SDK's message types included. It breaks with confusing errors when the
  library changes internals, even though production behavior is unchanged.

## How to assert

- **Assert only on the fields our code controls.** Avoid pinning the full
  structure of a call's arguments; use `expect.objectContaining` for call
  assertions.
- **Import production constants instead of duplicating them.** When a test
  must verify a specific constant is used, import it from the production
  module. This avoids string-duplication drift and makes the test break
  intentionally when the constant changes.
- **Give outsized-risk constants intentionally brittle tests.** When a
  single constant can silently change cost, behavior, or a contract (a
  model ID, a budget cap, an exit code), assert its exact wiring via the
  imported constant. The brittleness is the point: the suite may be the
  only line of defense against that regression.
- **Use inline literals for simple test data.** Reach for builders or
  factories only when several tests share non-trivial setup; otherwise they
  add indirection without value.
- **Skip type-level re-verification.** Do not use `expectTypeOf` to
  re-verify contracts TypeScript's annotations already enforce. If it
  compiles, the type is correct.

## How to organize

- **Group by behavior domain, not arbitrary codes.** Use descriptive
  `describe` blocks: "case selection", "exit codes" — not "Group A".
- **Name tests in behavior-first active voice.** A name should read as a
  sentence describing what the system does ("exits 2 when no case matches
  the filter"), with no alphanumeric prefixes.
- **Classify tests by real importance.** A test covering one of two
  branches in core logic is core behavior, not an "edge case". Place it
  accordingly.
