# Data Contracts - Artifact Validation Quick Reference

> Read this when you need to know exactly what to pass to
> `artifact-validator` at a phase boundary, or what a verdict means for
> the next decision. Validation stays delegated; this file is the compact
> contract reference, not a substitute for the phase playbooks. For `gh`
> flag, REST/GraphQL field, or capability questions, fetch one URL from
> `./external-sources.md` instead of inlining them here.

The validator's structured verdict is the orchestration decision input.
Do not replace it with ad hoc raw-file checks at the orchestrator level.

---

## Validation by Phase Transition

Each row shows what to dispatch to `artifact-validator` and what to
expect.

### Phases 1-4

For Phase 1, the gate below mirrors the stable snapshot contract owned
by `fetching-github-issue`. Treat that downstream skill as the
authoritative definition of `docs/<ISSUE_SLUG>.md`.

For Phase 4 and the Phase 5 precondition, use the stronger handoff
contract owned by `creating-github-child-issues`.

**Phase 4 write-model reminder:** Downstream creation prefers native
child issues when supported, then linked issues, then task-list
references. Validation must match whichever model the skill recorded,
while still requiring a workflow-level table plus exactly one per-task
inline reference in every numbered task section for resumability.

**Phase 1 snapshot conventions (consumed by Phase 2+):**

- **Timestamp normalization.** Timestamps that carry a time are
 normalized to `YYYY-MM-DD HH:MM UTC`; date-only values are preserved
 as `YYYY-MM-DD`.
- **`_Unknown. <reason>_` vs. `_None_`.** A `_Unknown_` marker means the
 retriever could not verify presence or absence of the item; `_None_`
 means absence was verified. They are not interchangeable.
- **`FETCH: PARTIAL` with `Validation: PASS` is a success.** The parent
 snapshot is valid, but some related items or comments could not be
 retrieved and are recorded under `## Retrieval Warnings`.

| Phase | Direction | Files to check | Expected checks |
| ----- | --------- | -------------- | --------------- |
| 1 | postcondition | `docs/<ISSUE_SLUG>.md` | File exists and preserves the locked Phase 1 snapshot top-level heading order defined by `fetching-github-issue` (stable even when sections are empty): `## Metadata`, `## Description`, `## Acceptance Criteria`, `## Comments`, `## Retrieval Warnings`, `## Child Issues`, `## Linked Issues`, `## Labels`, `## Assignees`, `## Milestone`, `## Projects`, `## Attachments` |
| 2 | precondition | `docs/<ISSUE_SLUG>.md` | Same as Phase 1 postcondition |
| 2 | postcondition | `docs/<ISSUE_SLUG>-tasks.md` + planning intermediates | `docs/<ISSUE_SLUG>-stage-1-detailed.md` and `docs/<ISSUE_SLUG>-stage-2-prioritized.md` exist; `docs/<ISSUE_SLUG>-tasks.md` exists; final plan preserves this section order: `## Issue Summary`, `## Execution Order Summary`, `## Problem Framing`, `## Assumptions and Constraints`, `## Cross-Cutting Open Questions`, `## Tasks`, `## Dependency Graph`, `## Validation Report`; ≥2 numbered task entries with the required task subsections |
| 3 | precondition | `docs/<ISSUE_SLUG>-tasks.md` + planning intermediates | Same as Phase 2 postcondition |
| 3 | postcondition | `docs/<ISSUE_SLUG>-upfront-critique.md` + `docs/<ISSUE_SLUG>-tasks.md` | `docs/<ISSUE_SLUG>-upfront-critique.md` exists; `docs/<ISSUE_SLUG>-tasks.md` contains `## Decisions Log` |
| 4 | precondition | `docs/<ISSUE_SLUG>-upfront-critique.md` + `docs/<ISSUE_SLUG>-tasks.md` | Same as Phase 3 postcondition |
| 4 | postcondition | `docs/<ISSUE_SLUG>-tasks.md` | Contains `## GitHub Task Issues`; immediately under that heading includes the machine handoff comment defined by `creating-github-child-issues`; contains the workflow-level table with one row per numbered plan task; every numbered task section contains exactly one inline `GitHub Task Issue:` line whose value matches that task's workflow-table row (`owner/repo#number`, `Not Created`, or `task-list`) |
| 5 | precondition | `docs/<ISSUE_SLUG>-tasks.md` | Same as Phase 4 postcondition |

### Phases 5-7 (per task)

The orchestrator boundary here is the presence of the full four-file
planning handoff. Detailed section requirements inside those files are
owned by the downstream planning skill.

| Phase | Direction | Files to check | Expected checks |
| ----- | --------- | -------------- | --------------- |
| 5 | postcondition | `docs/<ISSUE_SLUG>-task-<N>-brief.md` + `-execution-plan.md` + `-test-spec.md` + `-refactoring-plan.md` | All 4 Phase 5 planning artifacts exist |
| 6 | precondition | Same four files as Phase 5 postcondition | Same as Phase 5 postcondition |
| 6 | postcondition | `docs/<ISSUE_SLUG>-task-<N>-critique.md` + `-decisions.md` | Both critique and decisions artifacts exist |
| 7 | precondition | Standard Phase 1-6 execution handoff | `docs/<ISSUE_SLUG>.md`, `docs/<ISSUE_SLUG>-tasks.md`, all four Phase 5 + two Phase 6 task artifacts exist (6 → 7 readiness) |

For Phase 7, this table defines the orchestrator's normal workflow-gate
check. Execution-skill-internal optional inputs do not change this
validator contract.

---

## Dispatch Format

Every dispatch to `artifact-validator` uses these inputs:

```
ISSUE_SLUG: <slug>
PHASE: <1-7>
DIRECTION: <precondition | postcondition>
TASK_NUMBER: <N>    (task-specific boundaries only)
```

The subagent returns a structured verdict:

```
VALIDATION: <PASS | FAIL | ERROR>
Phase: <N> | Direction: <precondition | postcondition>
File: <path>
Checks:
  - File exists: <yes/no>
  - <Section check>: <pass/fail - detail if failed>
```

If the validator itself cannot complete, it returns:

```text
VALIDATION: ERROR
Phase: <N> | Direction: <precondition | postcondition>
Reason: <what prevented validation>
```

For Phases 3 and 6, validation covers only the artifact boundary. The
clarification skill's final summary still carries `RE_PLAN_NEEDED` and
`BLOCKERS_PRESENT`, and the orchestrator must honor those flags
separately at the gate step.

### Phase 1 Fetch Summary (12-line contract)

`fetching-github-issue` returns this locked 12-line summary. Branch on
the structured fields, not on a single status line.

```
FETCH: <PASS | PARTIAL | FAIL | ERROR>
Validation: <PASS | FAIL | NOT_RUN>
Failure category: <NONE | BAD_INPUT | NOT_FOUND | AUTH | TOOLS_MISSING | RATE_LIMIT | UNEXPECTED>
File written: docs/<ISSUE_SLUG>.md | None
Issue: <owner>/<repo>#<N>: <Title | Unknown>
State: <OPEN | CLOSED | Unknown>
Comments: <retrieved>/<found | N/A>
Child issues: <retrieved>/<found | UNKNOWN | N/A>
Linked issues: <retrieved>/<found | UNKNOWN | N/A>
Attachments: <N | N/A>
Warnings: <None | semicolon-separated warnings>
Reason: <None | fatal reason>
```

Interpret it as:

| Pair | Meaning | Action |
| ---- | ------- | ------ |
| `PASS` + `PASS` | Success | Run Phase 1 postcondition validator |
| `PARTIAL` + `PASS` | Success with warnings (includes capability-unavailable `## Projects` cases) | Proceed to postcondition validator |
| `FAIL` + `NOT_RUN` | Retrieval failed before write | Skip postcondition; route on `Failure category` per `./error-handling.md` |
| `Validation: FAIL` | Contract failure | Stop and surface, regardless of `FETCH` |
| `FETCH: ERROR` | Unexpected failure | Stop and surface, regardless of `Validation` |
| Any inconsistent pair (e.g. `PASS` + `NOT_RUN`) | Treat as unexpected Phase 1 error | Stop |

Branch on `Failure category` when present. Use `Reason` only for
user-facing detail.

### Progress Tracker Dispatch (summary)

When dispatching `progress-tracker`, read its subagent definition from the
registry. Typical orchestrator inputs:

```
ISSUE_SLUG: <slug>
ACTION: read | initialize | update | initialize_task | update_task
```

- `update`: `PHASE` (1-4), `STATUS`, `SUMMARY`; for `PHASE=4` and
  `STATUS=complete`, include `TASKS` (metadata for the workflow task
  table, from the Phase 4 downstream summary).
- `initialize_task`: `TASK_NUMBER`, `TASK_TITLE`.
- `update_task`: `TASK_NUMBER`, `PHASE` (5-7), `STATUS`, `SUMMARY`.

---

## Handling Verdicts

**On PASS:** proceed to the next step in the execution cycle. Do not
narrate the validation result unless the user asks.

**On FAIL:** do not proceed.

| Direction | On FAIL |
| --------- | ------- |
| Precondition | A required artifact is missing. Tell the user which phase produced it and offer to run that phase. |
| Postcondition | The phase did not produce its expected artifact. Report the specific check that failed and offer to re-run the phase. |

<example>
Postcondition failure after Phase 2:

artifact-validator returns:
VALIDATION: FAIL
Phase: 2 | Direction: postcondition
File: docs/acme-app-42-tasks.md + planning intermediates
Checks:
  - docs/acme-app-42-tasks.md exists: pass
  - Contains ## Validation Report: fail - missing section

Orchestrator to user:
"Phase 2 (Plan Tasks) is missing `## Validation Report`, so Phase 3 would
be working from an incomplete artifact. Re-run Phase 2?"
</example>

---

## Artifact Categories

- **Category A** (orchestration artifacts, `docs/<ISSUE_SLUG>*.md`):
  updated on disk only, preserved across sessions, never committed.
- **Category B** (implementation output): source code, tests, config
  changes — committed normally by the downstream execution skill.
