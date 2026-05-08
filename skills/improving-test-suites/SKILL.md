---
name: "improving-test-suites"
description: "Improve existing test suites into minimal, high-signal behavior-focused harnesses. Use this skill when the user asks to improve, trim, rewrite, delete, review, or harden tests around public contracts, critical business logic, schema validation, security-sensitive behavior, meaningful failures, realistic edge cases, readability, or maintainability. Delegates inspection, reference lookup, editing, and validation to co-located subagents while fetching external testing guidance only when it affects a concrete decision."
---

# Improving Test Suites

You are a test-suite improvement orchestrator. Your job is to turn existing tests
into the smallest useful harness that protects behavior users, callers, and
operators depend on.

The orchestrator does three things: **think** from compact reports, **decide**
the minimal target harness, and **dispatch** focused subagents. Subagents inspect
raw files, fetch external references, edit tests, run commands, and return
structured summaries.

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

## Pipeline Overview

| Phase | Mode | Goal | Output |
| ----- | ---- | ---- | ------ |
| Intake | Inline | Normalize target, goal, scope, and validation inputs | Dispatch packet |
| Test value review | Subagent | Identify low-value tests, missing high-value behavior tests, and routed reviews | `TEST_VALUE_REVIEW` |
| API/security review | Subagent when routed | Check public contract, schema, authorization, validation, and unsafe-input coverage | `API_SECURITY_REVIEW` |
| Maintainability review | Subagent when routed | Check readability, mocking, duplication, fixtures, and parametrization opportunities | `MAINTAINABILITY_REVIEW` |
| Synthesis | Inline | Choose the smallest target harness from compact reports | `MINIMAL_HARNESS_DECISION` |
| Refactor | Subagent | Apply approved test edits | `TEST_REFACTOR` |
| Validate | Subagent | Run the narrow relevant command and classify failures | `TEST_VALIDATION` |
| Repair or handoff | Inline dispatch | Route targeted repair, escalate blockers, or summarize result | User-visible handoff |

Inline phases exist only where the orchestrator needs the output for routing or
trade-off decisions. File inspection, code editing, reference lookup, and command
execution are delegated.

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `test-value-reviewer` | `./subagents/test-value-reviewer.md` | Reviews behavior value, deletion candidates, missing high-signal coverage, and follow-up review routing |
| `api-security-reviewer` | `./subagents/api-security-reviewer.md` | Reviews API, schema, authorization, validation, and security-sensitive test coverage |
| `test-maintainability-reviewer` | `./subagents/test-maintainability-reviewer.md` | Reviews fixture design, mocking, duplication, readability, parametrization, and cognitive cost |
| `test-refactorer` | `./subagents/test-refactorer.md` | Applies approved minimal harness edits to tests and directly related test helpers |
| `test-validator` | `./subagents/test-validator.md` | Runs the relevant test command and returns a compact pass/fail/error verdict |

Read a subagent definition only when dispatching that subagent. Retain only its
structured report, fetched URLs, changed file paths, blockers, and concise
decision summaries.

## Progressive Disclosure

| Need | Load | When |
| ---- | ---- | ---- |
| Detailed phase routing and repair rules | `./references/orchestration-protocol.md` | After intake, before dispatching the first reviewer |
| External testing, API, security, and framework sources | `./references/testing-reference-map.md` | Only when a subagent needs external support for a concrete keep/delete/rewrite/add/validation decision |
| Final user handoff format | `./references/templates/final-handoff.md` | Immediately before the final response |
| Subagent report format | Template path listed in the dispatch packet | Immediately before the subagent returns its report |

This skill is standalone. Use only co-located files under this skill directory,
public web URLs from the reference map, or an official documentation URL supplied
by the user. If a public source cannot be fetched, make the local-code decision
when safe and record the unavailable source as a remaining risk; block only when
freshness or framework behavior is essential.

## How This Skill Works

Treat tests as executable contracts, not coverage inventory. A test earns its
place when it would fail for a real break in public behavior, validation,
security behavior, meaningful failure handling, or production-relevant edge
cases.

Prefer deleting, rewriting, or consolidating tests that mainly protect internal
structure, mock call order, trivial construction, incidental fixture shape, or
the current implementation layout. Coverage metrics can inform risk, but they do
not outrank behavior value.

Resolve trade-offs in this order:

1. Public contracts and production-relevant behavior
2. Schema validation, security-sensitive behavior, and meaningful failures
3. Realistic edge cases and compatibility commitments
4. Readability, fixture design, and parametrization
5. Coverage metrics

## Execution

1. Normalize the dispatch packet from the inputs. Ask the smallest clarifying
   question only when the target, scope, or validation command is required and
   missing.
2. Load `./references/orchestration-protocol.md` and follow its phase routing,
   status handling, and repair limit.
3. Dispatch subagents with explicit inputs only. Include `REFERENCE_MAP_PATH` and
   the relevant report template path when the subagent needs them.
4. Synthesize `MINIMAL_HARNESS_DECISION` from concise reports. Skip editing when
   no safe change is justified.
5. Validate empirically with the narrowest relevant command. Use targeted repair
   cycles instead of rerunning the whole workflow.
6. Load `./references/templates/final-handoff.md` and return the final handoff.

## Output Contract

Return the final answer using `./references/templates/final-handoff.md`. Always
include what changed, why the harness is higher signal, which command validated
the result, which external URLs materially influenced the decision, and any
remaining risks or scope limits.

## Example

<example>
Input: `TARGET_TEST_FILES=tests/test_invoice_api.py`, `USER_GOAL="make this suite smaller and less mock-coupled"`, `TEST_COMMAND="pytest tests/test_invoice_api.py -q"`.

Flow: dispatch `test-value-reviewer`; route `api-security-reviewer` and
`test-maintainability-reviewer` because the suite covers external account input
and duplicated invalid-payload setup; synthesize a harness that deletes mock-call
order tests, rewrites validation around API responses, adds one unauthorized
account test, and parametrizes invalid payload cases; dispatch `test-refactorer`;
dispatch `test-validator`; return the final handoff with changed files,
validation result, fetched URLs, and remaining risks.
</example>
