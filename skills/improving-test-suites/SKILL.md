---
name: "improving-test-suites"
description: "Review and refactor test files into a minimal, high-signal behavior-focused harness. Use this skill when the user asks to improve, trim, rewrite, delete, review, or harden tests for public contracts, critical business logic, schema validation, security-sensitive behavior, meaningful failures, realistic edge cases, readability, or maintainability. Coordinates focused review subagents, keeps external testing guidance behind just-in-time reference routing, and ends with concrete test edits plus validation results."
---

# Improving Test Suites

You are a test-suite improvement orchestrator. Your job is to turn existing tests
into the smallest useful harness that protects behavior users, callers, and
operators actually depend on.

This skill treats tests as executable contracts, not coverage inventory. The
orchestrator keeps only concise findings, decisions, and validation outcomes in
context; subagents inspect raw test details and return compact reports.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_TEST_FILES` | Yes | `tests/test_billing.py` |
| `USER_GOAL` | No | `"reduce brittle implementation-coupled tests"` |
| `TEST_COMMAND` | No | `pytest tests/test_billing.py -q` |
| `SCOPE_LIMITS` | No | `"test files only"` |
| `REFERENCE_NEED` | No | `"pytest parametrization"` |

If `TARGET_TEST_FILES` is missing, ask one focused question for the path before
starting. If the user supplies multiple unrelated test files, run one complete
cycle per behavior area unless they explicitly ask for a broad test strategy.

## Workflow Overview

| Phase | Mode | Goal | Output |
| ----- | ---- | ---- | ------ |
| Context prep | Inline | Confirm target files, scope, and likely validation command | Input packet |
| Test value review | Subagent | Identify low-value tests, missing high-value behavior tests, and the minimal harness | `TEST_VALUE_REVIEW` report |
| API/security review | Subagent when relevant | Check validation, public contract, and security-sensitive coverage | `API_SECURITY_REVIEW` report |
| Maintainability review | Subagent when relevant | Check readability, mocking, fixture shape, duplication, and parametrization opportunities | `MAINTAINABILITY_REVIEW` report |
| Synthesis | Inline | Choose the smallest target harness and edit plan | Minimal harness decision |
| Refactor and validate | Inline | Apply test changes, run relevant tests, and fix refactor-caused failures | Changed files and validation result |
| Handoff | Inline | Explain what changed and why the suite is higher signal | Final response |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `test-value-reviewer` | `./subagents/test-value-reviewer.md` | Reviews test value, behavior focus, deletion candidates, and missing high-signal coverage |
| `api-security-reviewer` | `./subagents/api-security-reviewer.md` | Reviews API, schema, authorization, input validation, and security-sensitive test coverage |
| `test-maintainability-reviewer` | `./subagents/test-maintainability-reviewer.md` | Reviews fixture design, mocking, duplication, readability, parametrization, and cognitive cost |

Read a subagent file only when dispatching that specific subagent. Keep the
orchestrator's context to status lines, file paths, verdicts, and concise
summaries.

## Reference Routing

Detailed external guidance lives in `./references/testing-reference-map.md`.
Load that file only when a concrete decision needs supporting guidance, such as
behavior-vs-implementation boundaries, public API testing, pytest structure,
test pyramid trade-offs, or API/security test coverage.

When external current best practices materially affect a recommendation, use the
repository's `recency-guard` skill or an equivalent freshness check before
treating the reference as current.

## How This Skill Works

The current public behavior and contracts are the source of truth. Existing tests
are evidence, not obligations. A test earns its place when it would fail for a
real break in public behavior, validation, security behavior, meaningful error
handling, or production-relevant edge cases.

Prefer deleting, rewriting, or consolidating tests that primarily protect
internal structure, mock call order, trivial construction, incidental fixture
shape, or the current implementation layout. A short readable suite that protects
critical behavior is a better result than a long suite that preserves coverage
without confidence.

## Execution Steps

### 1. Prepare the review packet

Identify:

- `TARGET_TEST_FILES`
- The likely production code or public contract under test
- `TEST_COMMAND`, if obvious from repository conventions or provided by the user
- `SCOPE_LIMITS`, especially whether production code changes are allowed
- Whether API, schema, authorization, input validation, filesystem, network, or
  other external-boundary behavior is in scope

### 2. Dispatch `test-value-reviewer`

Pass:

- `TARGET_TEST_FILES`
- `USER_GOAL`
- `SCOPE_LIMITS`
- `REFERENCE_NEED`
- `REFERENCE_MAP_PATH`: `./references/testing-reference-map.md`

Collect only the `TEST_VALUE_REVIEW` status, low-value test list, high-value
behavior list, minimal harness recommendation, references fetched, and blockers.

### 3. Dispatch `api-security-reviewer` when relevant

Use this review when the target tests cover or should cover user input, schemas,
API/tool contracts, authz/authn, filesystem paths, network calls, secrets,
permissions, unsafe data handling, or other security-sensitive behavior.

Pass the review packet plus the concise `TEST_VALUE_REVIEW` report. If the file
has no API or security-sensitive surface, record `API/security review: not
applicable` and continue.

### 4. Dispatch `test-maintainability-reviewer` when relevant

Use this review when the test file is long, fixture-heavy, mock-heavy, duplicated,
hard to scan, framework-specific, or likely to benefit from parametrization.

Pass the review packet plus the concise reports already collected. Collect only
the maintainability verdict, specific rewrite suggestions, and blockers.

### 5. Synthesize the minimal target harness

Choose the smallest set of tests that gives meaningful confidence. Resolve
subagent findings with this priority:

1. Public contracts and production-relevant behavior
2. Schema validation, security-sensitive behavior, and meaningful failures
3. Realistic edge cases and backward-compatible behavior
4. Readability, fixture design, and parametrization
5. Coverage metrics

If a finding depends on an external reference, use only the fetched source and
the local code evidence needed for that decision. Avoid carrying raw source text
forward.

### 6. Refactor the tests

Edit the target tests and directly related test helpers. Production code changes
happen only when the user requested implementation fixes as part of the work.

Apply the minimal harness decision:

- Delete low-value tests.
- Rewrite brittle tests through public behavior.
- Add only missing high-signal tests.
- Improve names, fixtures, assertions, and parametrization where they reduce
  cognitive cost.

### 7. Validate and repair

Run `TEST_COMMAND` when supplied or the narrowest relevant test command you can
identify. If validation fails because of the test refactor, make a targeted fix
and rerun the same command. Use at most three targeted fix cycles.

If a high-signal test exposes a likely production bug outside the approved scope,
report the bug and the failing test separately instead of silently changing
production code.

### 8. Return the handoff

Report the result in this order:

1. Concise diagnosis of the original suite problems
2. Low-value tests removed or rewritten, with reasons
3. High-value tests kept, rewritten, or added
4. Resulting minimal target harness
5. Concrete code changes
6. Test commands run and results
7. Remaining risks, skipped checks, or scope limits

## Example

<example>
Input:

- `TARGET_TEST_FILES`: `tests/test_invoice_api.py`
- `USER_GOAL`: `"make this suite smaller and less mock-coupled"`
- `TEST_COMMAND`: `pytest tests/test_invoice_api.py -q`

Flow:

1. Orchestrator dispatches `test-value-reviewer`.
2. Reviewer returns `TEST_VALUE_REVIEW: PASS`, naming 12 mock-order tests as
   low value and 3 invoice validation behaviors as worth keeping.
3. Orchestrator dispatches `api-security-reviewer` because invoice creation
   accepts external input.
4. Security reviewer returns `API_SECURITY_REVIEW: PASS`, recommending one
   negative test for unauthorized account access and one schema rejection test.
5. Orchestrator dispatches `test-maintainability-reviewer` because fixtures are
   duplicated across the file.
6. Maintainability reviewer returns `MAINTAINABILITY_REVIEW: PASS`, recommending
   a shared invoice payload factory and parametrized invalid payload cases.
7. Orchestrator rewrites the file to 6 behavior-focused tests, runs the supplied
   pytest command, and returns the concise handoff.
</example>

<example>
Small-file path:

If `TARGET_TEST_FILES` is a 30-line file with two obvious implementation-detail
tests, the orchestrator may perform the review inline, skip optional subagents,
delete or rewrite the tests, run the narrow test command, and report why
delegation was unnecessary.
</example>
