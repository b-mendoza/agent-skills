# Test Quality Heuristics

> Read this file before classifying tests during a value, API/security, or
> maintainability review, or before synthesizing the minimal harness decision.
> For deeper rationale, fetch the relevant URL from `./external-sources.md`.

This file holds the small operational scaffolding that keeps reviews and
harness decisions consistent without bloating the always-loaded prompt.

## Trade-Off Priority

Resolve conflicting findings in this order. Lower-priority concerns must not
override higher-priority ones:

1. Public contracts and production-relevant behavior
2. Schema validation, security-sensitive behavior, and meaningful failure handling
3. Realistic edge cases and compatibility commitments
4. Readability, fixture design, and parametrization
5. Coverage metrics

## Low-Value Test Categories

Mark a target test as a delete, rewrite, or consolidate candidate when it
matches one of the categories below and does not also protect a high-value
behavior in the next section:

- `implementation-detail-assertion` — verifies private call order, internal
  state, or refactor-sensitive structure rather than observable behavior.
- `duplicated-coverage` — repeats a behavior already covered, with no new
  input class or failure mode.
- `trivial-assertion` — exercises a getter, constant, or constructor without
  proving meaningful behavior.
- `unstable-mock` — pins mock interaction order or specific call counts that
  are incidental to the public contract.
- `over-specific-fixture` — depends on incidental fixture shape that changes
  whenever unrelated code changes.
- `unclear-business-value` — passes today but no reviewer can name the rule it
  protects.
- `verbose-low-yield` — long setup or many assertions for a small confidence
  gain that a parametrized or smaller test would match.

For source-backed framing of behavior vs. implementation tests, fetch
`behavior-vs-implementation`, `prefer-public-apis`, or
`implementation-details-react` from `./external-sources.md`.

## High-Value Behavior Categories

Recommend keeping or adding a test when it protects one of:

- Public API, library, or tool contracts the caller depends on.
- Critical business logic, pricing, billing, eligibility, or state machines.
- Schema validation: rejection of invalid, missing, or malformed inputs.
- Security-sensitive behavior: auth, permissions, ownership, secret handling,
  unsafe deserialization, path/network/file boundaries.
- Meaningful failure handling: error paths the caller, operator, or user
  observes.
- Realistic production edge cases: concurrency, retries, idempotency,
  pagination boundaries, time/timezone transitions.

For source-backed prioritization, fetch `how-to-know-what-to-test`,
`swe-google-unit-testing`, or `owasp-api-top-10` from `./external-sources.md`.

## Minimal Harness Rules

When proposing the minimal target harness:

- Prefer one parametrized test for the same rule across input classes.
- Assert through public behavior, validation results, errors, outputs, or
  observable contracts, not through mock interaction order.
- Keep one named test per distinct security or contract rule, even when it
  could be parametrized, so the rule remains discoverable.
- Replace shared helpers that hide the rule under test with a small local
  helper or inline setup (see `damp-not-dry` for rationale).
- Do not add tests just to lift coverage; add tests only when they protect a
  named high-value behavior.

## Classification Reporting

Use the category names above verbatim when filling `Low-value tests`,
`High-value behaviors`, and `Recommended minimal additions` slots in the
review templates. This keeps the orchestrator's synthesis predictable.

## Standalone Reminder

This skill remains usable when external URLs are unreachable. Heuristics here
plus repository code and bundled templates are sufficient for a safe minimal
harness decision; external sources add depth, not core capability.
