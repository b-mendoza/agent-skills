# Test Quality Heuristics

Tests are executable contracts. Prefer tests that would fail for real breaks in public behavior, validation, security behavior, meaningful failure handling, or production-relevant edge cases.

## Priority Order

1. Public contracts and production-relevant behavior.
2. Schema validation, security-sensitive behavior, and meaningful failure handling.
3. Realistic edge cases and compatibility.
4. Readability, fixtures, parametrization, and maintainable setup.
5. Coverage metrics. A lower priority never overrides a higher one.

## Low-Value Categories

| Category | Use when |
| -------- | -------- |
| `implementation-detail-assertion` | Test asserts private call order, private state, layout, or helper mechanics over public behavior |
| `duplicated-coverage` | Same rule, input class, and failure mode are covered elsewhere with equal or better signal |
| `trivial-assertion` | Constants, bare construction, getters, or framework wiring are asserted without protected behavior |
| `unstable-mock` | Incidental mock order/count/shape matters more than observable output |
| `over-specific-fixture` | Incidental fixture shape hides the rule being protected |
| `unclear-business-value` | No nameable protected rule can be identified from local evidence |
| `verbose-low-yield` | A smaller test can provide equal confidence |

## High-Value Categories

| Category | Use when |
| -------- | -------- |
| `public-contract` | Documented or externally relied-on behavior |
| `critical-business-logic` | Money, permissions, state transitions, eligibility, quotas, or irreversible actions |
| `schema-validation` | Accepted/rejected payload shape, type, range, defaulting, or compatibility |
| `security-sensitive-behavior` | Authz, authn, unsafe input, tenant boundaries, secrets, filesystem, or network safety |
| `meaningful-failure-handling` | Actionable errors, rollback, retries, or observability |
| `production-edge-case` | Occurred, documented, or follows from a supported use case |

## Minimal Harness Rules

Use one parametrized test per rule across meaningful input classes. Assert observable behavior. Keep at least one named test per distinct security, contract, business, or failure-handling rule. Replace rule-hiding shared helpers with local setup when that improves clarity. Do not add tests for coverage alone. Do not delete, rewrite, or consolidate based on external advice without independent local-code evidence.

## Inventory Caps

Default reports show the top five highest-signal items per section. Exhaustive mode shows up to 25 and writes overflow to a local uncommitted file. Every capped section states `shown N of M`; silent truncation is invalid.
