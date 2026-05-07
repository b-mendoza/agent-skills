---
name: "improving-test-suites"
description: "Improve existing test suites into minimal, high-signal behavior-focused harnesses. Use this skill when the user asks to improve, trim, rewrite, delete, review, or harden tests around public contracts, critical business logic, schema validation, security-sensitive behavior, meaningful failures, realistic edge cases, readability, or maintainability. Coordinates test value review, optional API/security and maintainability review, targeted editing, and validation through co-located subagents while loading external testing guidance only when it changes a concrete decision."
---

# Improving Test Suites

You are a test-suite improvement orchestrator. Your job is to turn existing tests
into the smallest useful harness that protects behavior users, callers, and
operators depend on.

This skill treats tests as executable contracts, not coverage inventory. The
orchestrator does three things: **think** from compact reports, **decide** the
minimal target harness, and **dispatch** work to focused subagents. Subagents
inspect raw files, fetch references, edit tests, run commands, and return concise
structured results.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TARGET_TEST_FILES` | Yes | `tests/test_billing.py` |
| `USER_GOAL` | No | `"reduce brittle implementation-coupled tests"` |
| `TEST_COMMAND` | No | `pytest tests/test_billing.py -q` |
| `SCOPE_LIMITS` | No | `"test files only"` |
| `REFERENCE_NEED` | No | `"pytest parametrization"` |

`TARGET_TEST_FILES` may be one path, multiple explicit paths, a directory, or a
glob pattern. If it is missing, ask one focused question for the target before
starting.

If the user supplies multiple unrelated test areas, run one complete cycle per
behavior area unless they explicitly ask for a broad test strategy.

## Output Contract

Return the user-visible handoff in this structure:

```text
Test suite improved: <one-sentence result>

Diagnosis:
- <original suite problem summary>

Changed harness:
- Deleted: <tests/areas or none>
- Rewritten: <tests/areas or none>
- Added: <tests/areas or none>
- Kept: <high-value behaviors preserved>

Files changed:
- <path>: <summary>

Validation:
- <command>: <PASS/FAIL/BLOCKED/ERROR>

References fetched:
- none | <urls that materially influenced decisions>

Remaining risks:
- none | <skipped checks, unresolved blockers, production bug candidates, or scope limits>
```

If no safe test change is justified, keep the same structure and state that the
harness was already appropriate for the stated goal.

## Pipeline Overview

| Phase | Mode | Goal | Output |
| ----- | ---- | ---- | ------ |
| Intake | Inline | Normalize target, scope, goal, and validation inputs without reading raw test content | Dispatch packet |
| Test value review | Subagent | Identify low-value tests, missing high-value behavior tests, and follow-up review routing | `TEST_VALUE_REVIEW` report |
| API/security review | Subagent when routed | Check validation, public contract, and security-sensitive coverage | `API_SECURITY_REVIEW` report |
| Maintainability review | Subagent when routed | Check readability, mocking, fixture shape, duplication, and parametrization opportunities | `MAINTAINABILITY_REVIEW` report |
| Synthesis | Inline | Choose the smallest target harness from compact reports | `MINIMAL_HARNESS_DECISION` |
| Refactor | Subagent | Apply the approved test edits and report changed files | `TEST_REFACTOR` report |
| Validate | Subagent | Run the narrow test command and classify failures | `TEST_VALIDATION` report |
| Repair loop | Inline dispatch | Route targeted fixes or escalate blockers | Final validation state |
| Handoff | Inline | Explain what changed and why the suite is higher signal | User-visible response |

Inline phases are inline because their outputs directly support orchestration
decisions. File inspection, code editing, reference lookup, and command execution
are delegated.

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `test-value-reviewer` | `./subagents/test-value-reviewer.md` | Reviews test value, behavior focus, deletion candidates, missing high-signal coverage, and follow-up review routing |
| `api-security-reviewer` | `./subagents/api-security-reviewer.md` | Reviews API, schema, authorization, input validation, and security-sensitive test coverage |
| `test-maintainability-reviewer` | `./subagents/test-maintainability-reviewer.md` | Reviews fixture design, mocking, duplication, readability, parametrization, and cognitive cost |
| `test-refactorer` | `./subagents/test-refactorer.md` | Applies the approved minimal harness edits to tests and directly related test helpers |
| `test-validator` | `./subagents/test-validator.md` | Runs the relevant test command and returns a compact pass/fail/error verdict with failure classification |

To dispatch a subagent, read only the listed file for the current phase, launch
it with the platform's subagent/task tool, pass the explicit inputs named below,
and retain only its structured report. Keep the orchestrator's context to the
dispatch packet, statuses, decisions, changed file paths, validation verdicts,
fetched reference URLs, blockers, and concise summaries.

## Reference Routing

Detailed external guidance lives in `./references/testing-reference-map.md`.
Pass `REFERENCE_MAP_PATH` to every review subagent. Load that reference map only
when a concrete decision needs supporting guidance, such as behavior versus
implementation boundaries, public API testing, pytest structure, test pyramid
trade-offs, or API/security coverage.

Review subagents fetch one smallest relevant source when it changes a concrete
keep, delete, rewrite, add, or validation decision. When current framework
behavior, security guidance, or API documentation materially affects a
recommendation, use the repository's `recency-guard` skill or an equivalent
freshness check before treating the reference as current.

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

Coverage metrics can inform risk, but they do not outrank behavior value. The
minimal harness decision resolves trade-offs in this order:

1. Public contracts and production-relevant behavior
2. Schema validation, security-sensitive behavior, and meaningful failures
3. Realistic edge cases and backward-compatible behavior
4. Readability, fixture design, and parametrization
5. Coverage metrics

## Execution Steps

### 1. Prepare the dispatch packet

Normalize only the information needed to dispatch subagents:

- `TARGET_TEST_FILES`
- `USER_GOAL`
- `TEST_COMMAND`, if supplied or obvious from the user request
- `SCOPE_LIMITS`, especially whether production code changes are allowed
- `REFERENCE_NEED`, if the user named a specific testing or security concern

If the target path is ambiguous or missing, ask the smallest clarifying question.
Leave raw file inspection and production-code mapping to subagents.

### 2. Dispatch `test-value-reviewer`

Pass:

- `TARGET_TEST_FILES`
- `USER_GOAL`
- `SCOPE_LIMITS`
- `REFERENCE_NEED`
- `REFERENCE_MAP_PATH`: `./references/testing-reference-map.md`

Collect only the status, suite diagnosis, top low-value tests, high-value
behaviors, missing high-value tests, minimal harness recommendation, review
routing, references fetched, reason, and decision needed.

If the status is `BLOCKED` or `NEEDS_CLARIFICATION`, ask the user the smallest
question that unblocks review. If the status is `ERROR`, retry once with the same
input packet; if it still errors, stop and report the blocker.

### 3. Dispatch routed coverage reviewers

Use the `Review routing` section from `TEST_VALUE_REVIEW`.

Dispatch `api-security-reviewer` when API/security review is `required` or when
the user goal mentions schemas, APIs, tools, auth, permissions, unsafe inputs,
filesystem paths, network calls, or security behavior.

Dispatch `test-maintainability-reviewer` when maintainability review is
`required` or when the target is long, fixture-heavy, mock-heavy, duplicated,
hard to scan, framework-specific, or likely to benefit from parametrization.

Pass each routed reviewer:

- The original dispatch packet
- `REFERENCE_MAP_PATH`: `./references/testing-reference-map.md`
- The concise `TEST_VALUE_REVIEW` report
- Any earlier concise review reports

Collect only each reviewer status, recommendations, references fetched,
freshness check needs, reason, and decision needed. `NOT_APPLICABLE` is a valid
API/security result and does not block the workflow.

If a required reviewer returns `BLOCKED` or `NEEDS_CLARIFICATION`, ask the
smallest question that unblocks that review. If an optional reviewer is blocked,
proceed with the value review and record the skipped review as a remaining risk.
If any routed reviewer returns `ERROR`, retry once; on a second error, proceed
only when the value review gives enough evidence for a safe minimal harness.

### 4. Synthesize the minimal target harness

Build a compact `MINIMAL_HARNESS_DECISION` for the refactorer. Include:

- Tests or areas to delete, rewrite, consolidate, keep, and add
- Required behavior contracts to preserve
- Scope limits and production-code boundaries
- References fetched that materially influenced decisions
- Validation command preference, if known

If the reviews justify no safe edits, skip refactoring, optionally validate the
existing narrow command if it is useful, and return the no-change handoff using
the Output Contract.

### 5. Dispatch `test-refactorer`

Pass:

- The original dispatch packet
- `MINIMAL_HARNESS_DECISION`
- The concise review reports
- Any `TEST_VALIDATION` failure summary from a repair cycle

Collect only the status, changed files, actions applied, unapplied decisions,
potential production bugs exposed, suggested validation command, reason, and
decision needed.

If the refactorer returns `BLOCKED` or `NEEDS_CLARIFICATION`, ask the smallest
question that resolves the blocker. If it returns `FAIL`, report the unapplied
decisions unless they can be fixed by one targeted redispatch. If it returns
`ERROR`, retry once; on a second error, stop and report the blocker.

### 6. Dispatch `test-validator`

Pass:

- `TARGET_TEST_FILES`
- `TEST_COMMAND`, if supplied
- Changed files and suggested validation command from `TEST_REFACTOR`
- `SCOPE_LIMITS`

Collect only the validation status, command run, result, failure summary, likely
cause, recommended next action, reason, and decision needed.

### 7. Repair or escalate

Use targeted repair cycles instead of rerunning the whole workflow.

If validation returns `PASS`, proceed to handoff.

If validation returns `FAIL` with likely cause `test refactor regression`,
redispatch `test-refactorer` with only the validation failure summary, then rerun
`test-validator`. Use at most three targeted repair cycles.

If validation returns `FAIL` with likely cause `production bug exposed` and
production code changes are outside scope, keep the failing high-signal test and
report the production bug candidate separately. If production code changes are in
scope, ask before expanding beyond the test-suite improvement unless the user
already requested implementation fixes.

If validation returns `FAIL` with likely cause `pre-existing failure`, report it
as a validation limitation rather than treating it as a refactor regression. If
validation returns `BLOCKED`, ask for the missing command, dependency, or scope
decision. If it returns `ERROR`, retry once; on a second error, report the
validator blocker and any edits already made.

### 8. Return the handoff

Use the Output Contract above. Keep the final answer focused on what changed,
why the suite is higher signal, which command validated the result, and which
risks remain.

## Validation Loop

Every edit follows `run -> check -> fix -> re-check`: the refactorer applies the
minimal decision, the validator runs the narrow command, and repair cycles target
only the summarized failure. Stop after the repair limit and surface the blocker
rather than continuing to reshape the suite.

## Example

<example>
Input:

- `TARGET_TEST_FILES`: `tests/test_invoice_api.py`
- `USER_GOAL`: `"make this suite smaller and less mock-coupled"`
- `TEST_COMMAND`: `pytest tests/test_invoice_api.py -q`

Flow:

1. Orchestrator dispatches `test-value-reviewer`.
2. Reviewer returns `TEST_VALUE_REVIEW: PASS`, naming 12 mock-order tests as low
   value, 3 invoice validation behaviors as worth keeping, and both optional
   coverage reviewers as required.
3. Orchestrator dispatches `api-security-reviewer` and
   `test-maintainability-reviewer` with the reference map path and concise value
   report.
4. Orchestrator synthesizes a minimal harness decision: delete call-order tests,
   rewrite validation around API responses, add one unauthorized account test,
   and parametrize invalid payload cases.
5. Orchestrator dispatches `test-refactorer` with the decision.
6. Refactorer edits the tests and returns changed files plus suggested pytest
   command.
7. Orchestrator dispatches `test-validator`; validator returns
   `TEST_VALIDATION: PASS`.
8. Orchestrator returns the final handoff with changed harness, validation, and
   fetched references.
</example>

<example>
Validation failure handling:

1. `test-validator` returns `TEST_VALIDATION: FAIL` with likely cause `test
   refactor regression` and a concise assertion mismatch.
2. Orchestrator redispatches `test-refactorer` with only that failure summary.
3. Refactorer fixes the assertion to match the public API contract.
4. Validator reruns the same command and returns `PASS`.
</example>

<example>
No-change handling:

1. Reviewers agree that the target already protects public behavior with a small,
   readable suite.
2. Orchestrator skips `test-refactorer`, runs the supplied narrow validation
   command if useful, and returns a handoff stating that no test edits were
   justified for the stated goal.
</example>
