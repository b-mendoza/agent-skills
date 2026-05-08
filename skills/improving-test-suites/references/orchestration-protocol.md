# Orchestration Protocol

> Read this file after intake. Dispatch file reads, web fetches, edits, and
> command runs to subagents; keep the orchestrator on routing decisions and
> compact summaries. The orchestrator only reads skill, reference, subagent,
> and template files directly.

## Dispatch Packet

Build and pass only these fields unless the user supplied additional relevant
scope:

| Field | Include when | Notes |
| ----- | ------------ | ----- |
| `TARGET_TEST_FILES` | Always | Path, directory, glob, or explicit list |
| `USER_GOAL` | Supplied or inferable | Keep short and user-facing |
| `TEST_COMMAND` | Supplied or obvious | Prefer the narrow target command |
| `SCOPE_LIMITS` | Supplied or important | Example: `test files only` |
| `REFERENCE_NEED` | User named a topic | Example: `pytest parametrization` |
| `EXTERNAL_SOURCES_PATH` | Only when source-backed support is requested or needed | `./references/external-sources.md` |
| `HEURISTICS_PATH` | Review subagents and synthesis | `./references/test-quality-heuristics.md` |
| `REPORT_TEMPLATE_PATH` | Every subagent | The template that matches that subagent |

## Phase Routing

### 1. Test Value Review

Dispatch `test-value-reviewer` with the dispatch packet, `HEURISTICS_PATH`, and
`REPORT_TEMPLATE_PATH=./references/test-value-review-template.md`.
Include `EXTERNAL_SOURCES_PATH=./references/external-sources.md` only when the
user requested a source-backed decision or the reviewer reaches a concrete
source need.

Collect only: status, suite diagnosis, top low-value tests, high-value
behaviors, missing high-value tests, minimal harness recommendation, review
routing, fetched URLs, blockers, reason, and decision needed.

### 2. Routed Coverage Reviews

Dispatch `api-security-reviewer` when the value review marks it `required`,
or when the goal/target mentions APIs, tools, schemas, auth, permissions,
unsafe inputs, filesystem paths, network calls, or security behavior.

Dispatch `test-maintainability-reviewer` when the value review marks it
`required`, or when the target is long, fixture-heavy, mock-heavy,
duplicated, hard to scan, framework-specific, or likely to benefit from
parametrization.

Pass each reviewer the original dispatch packet, the concise earlier reports,
`HEURISTICS_PATH`, and its report template path. Include
`EXTERNAL_SOURCES_PATH` only when source-backed support is requested or needed.
Treat `NOT_APPLICABLE` from the API/security reviewer as a complete non-blocking
result.

Use these template paths:

- `api-security-reviewer`: `./references/api-security-review-template.md`
- `test-maintainability-reviewer`: `./references/test-maintainability-review-template.md`

### 3. Minimal Harness Decision

Synthesize `MINIMAL_HARNESS_DECISION` using the priorities and rules in
`./references/test-quality-heuristics.md`. Include:

- Tests or areas to delete, rewrite, consolidate, keep, and add
- Public behavior contracts and failure modes to preserve
- Scope boundaries, especially production-code edit permissions
- References fetched that materially influenced decisions
- Preferred validation command, when known

Skip refactoring when the reviews justify no safe edit. Optionally validate
the existing narrow command if useful, then hand off using the final
template.

### 4. Refactor

Dispatch `test-refactorer` with the original dispatch packet,
`MINIMAL_HARNESS_DECISION`, concise review reports, any validation failure
summary from a repair cycle, and
`REPORT_TEMPLATE_PATH=./references/test-refactor-template.md`.

Collect only: status, changed files, actions applied, production code
changes, unapplied decisions, potential production bugs, suggested
validation command, reason, and decision needed.

### 5. Validate

Dispatch `test-validator` with target files, test command if supplied,
changed files, suggested validation command, scope limits, and
`REPORT_TEMPLATE_PATH=./references/test-validation-template.md`.

Collect only: status, command, concise result, likely cause, failure
summary, recommended next action, reason, and decision needed.

## Status Handling

| Status | Orchestrator action |
| ------ | ------------------- |
| `PASS` | Advance to the next phase |
| `NOT_APPLICABLE` | Record the result and continue |
| `BLOCKED` | Ask the smallest question or report the missing prerequisite |
| `NEEDS_CLARIFICATION` | Ask one focused question that resolves the decision |
| `FAIL` | Use targeted repair when safe; otherwise report unapplied work or exposed production bug |
| `ERROR` | Retry the same dispatch once; if it recurs, report the blocker with completed work |

Optional reviewer blockers do not stop the workflow when the value review
gives enough evidence for a safe edit. Record the skipped optional review as
a remaining risk.

When validation returns `FAIL`, `BLOCKED`, or repeated `ERROR`, load
`./references/repair-protocol.md`. Keep the repair details out of the normal
prompt path until they are needed.

## Handoff

Before the user-visible final response, load
`./references/final-handoff-template.md`. Include changed harness summary,
files changed, validation command and result, fetched URLs, and remaining
risks.
