# Data Contracts - Artifact Validation Quick Reference

> Consult this file when you need to know exactly what to pass to
> `artifact-validator` at a phase boundary, or what a PASS/FAIL verdict means
> for your next decision.
>
> Reminder: the orchestrator reads skill/reference/subagent files, talks to the
> user, and dispatches helpers. Validation stays delegated; this file is the
> compact contract reference, not a substitute for the phase playbooks.
>
> Use the validator's structured verdict as the orchestration decision input.
> Do not replace it with ad hoc raw-file checks at the orchestrator level.

---

## Validation by Phase Transition

Each row shows what to dispatch to `artifact-validator` and what to expect.

### Phases 1–4

For Phase 1, the compact gate below mirrors the stable snapshot contract owned
by `fetching-jira-ticket`. Treat that downstream skill as the authoritative
definition of `docs/<KEY>.md`.

For Phase 4 and the Phase 5 precondition, use the stronger handoff contract
owned by `creating-jira-subtasks`, not the older shorthand of "`## Jira
Subtasks` exists and has one key."

| Phase | Direction     | File to check           | Expected checks                                                |
| ----- | ------------- | ----------------------- | -------------------------------------------------------------- |
| 1     | postcondition | `docs/<KEY>.md`         | File exists and preserves the locked Phase 1 snapshot top-level heading order defined by `fetching-jira-ticket` (stable even when sections are empty): `## Metadata`, `## Description`, `## Acceptance Criteria`, `## Comments`, `## Retrieval Warnings`, `## Subtasks`, `## Linked Issues`, `## Attachments`, `## Custom Fields` |
| 2     | precondition  | `docs/<KEY>.md`         | Same as Phase 1 postcondition                                  |
| 2     | postcondition | `docs/<KEY>-tasks.md` + planning intermediates | `docs/<KEY>-stage-1-detailed.md` and `docs/<KEY>-stage-2-prioritized.md` exist; `docs/<KEY>-tasks.md` exists; final plan contains `## Ticket Summary`, `## Execution Order Summary`, `## Problem Framing`, `## Assumptions and Constraints`, `## Cross-Cutting Open Questions`, `## Tasks`, `## Dependency Graph`, and `## Validation Report`; plan has ≥2 numbered task entries with the required task subsections |
| 3     | precondition  | `docs/<KEY>-tasks.md` + planning intermediates | Same as Phase 2 postcondition                                  |
| 3     | postcondition | `docs/<KEY>-upfront-critique.md` + `docs/<KEY>-tasks.md` | `docs/<KEY>-upfront-critique.md` exists; `docs/<KEY>-tasks.md` contains `## Decisions Log` |
| 4     | precondition  | `docs/<KEY>-upfront-critique.md` + `docs/<KEY>-tasks.md` | Same as Phase 3 postcondition                                  |
| 4     | postcondition | `docs/<KEY>-tasks.md`   | Contains a `## Jira Subtasks` table; table has one row per numbered task; every numbered task section contains exactly one inline `Jira Subtask:` line whose value matches that task's workflow-table row (`<KEY>` or `Not Created`) |
| 5     | precondition  | `docs/<KEY>-tasks.md`   | Same as Phase 4 postcondition                                  |

### Phases 5–7 (per task)

For Phase 5 postcondition and Phase 6 precondition, this quick reference names
the concrete four-file planning handoff. The detailed section requirements
inside those files are outside this workflow contract; the orchestrator boundary
here is the presence of the full four-file handoff.

| Phase | Direction     | File to check                      | Expected checks                  |
| ----- | ------------- | ---------------------------------- | -------------------------------- |
| 5     | postcondition | `docs/<KEY>-task-<N>-brief.md` + `docs/<KEY>-task-<N>-execution-plan.md` + `docs/<KEY>-task-<N>-test-spec.md` + `docs/<KEY>-task-<N>-refactoring-plan.md` | All 4 concrete Phase 5 planning artifacts exist |
| 6     | precondition  | `docs/<KEY>-task-<N>-brief.md` + `docs/<KEY>-task-<N>-execution-plan.md` + `docs/<KEY>-task-<N>-test-spec.md` + `docs/<KEY>-task-<N>-refactoring-plan.md` | Same as Phase 5 postcondition |
| 6     | postcondition | `docs/<KEY>-task-<N>-critique.md` + `docs/<KEY>-task-<N>-decisions.md` | Both critique and decisions artifacts exist |
| 7     | precondition  | Standard Phase 1-6 execution handoff | `docs/<KEY>.md`, `docs/<KEY>-tasks.md`, `docs/<KEY>-task-<N>-brief.md`, `docs/<KEY>-task-<N>-execution-plan.md`, `docs/<KEY>-task-<N>-test-spec.md`, `docs/<KEY>-task-<N>-refactoring-plan.md`, `docs/<KEY>-task-<N>-critique.md`, and `docs/<KEY>-task-<N>-decisions.md` all exist; this confirms the normal workflow reached execution after critique completion (**6 → 7 readiness**) |

For Phase 7 specifically, this table defines the orchestrator's normal
workflow-gate check. The boundary is the standard Phase 1-6 handoff listed
above; execution-skill-internal optional inputs do not change this validator
contract.

---

## Dispatch Format

Every dispatch to `artifact-validator` uses these inputs:

```
TICKET_KEY: <KEY>
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
`BLOCKERS_PRESENT`, and the orchestrator must honor those flags separately at
the gate step.

### Phase 1 fetch summary (12-line contract)

`fetching-jira-ticket` returns the locked 12-line structured summary below.
Read the complete summary in order and branch on those structured fields rather
than on abbreviated prose or a single status line:

```
FETCH: <PASS | PARTIAL | FAIL | ERROR>
Validation: <PASS | FAIL | NOT_RUN>
Failure category: <NONE | BAD_INPUT | NOT_FOUND | AUTH | TOOLS_MISSING | RATE_LIMIT | UNEXPECTED>
File written: docs/<TICKET_KEY>.md | None
Ticket: <TICKET_KEY>: <Summary/Title | Unknown>
Status: <status | Unknown> | Type: <type | Unknown>
Comments: <retrieved>/<found | N/A>
Subtasks: <retrieved>/<found | UNKNOWN | N/A>
Linked issues: <retrieved>/<found | UNKNOWN | N/A>
Attachments: <N | N/A>
Warnings: <None | semicolon-separated warnings>
Reason: <None | fatal reason>
```

How to interpret the structured summary:

- `PASS` + `PASS`: Success. Proceed to the Phase 1 postcondition validator on
  the written file.
- `PARTIAL` + `PASS`: Success with warnings. Preserve `## Retrieval Warnings`
  and proceed to the Phase 1 postcondition validator.
- `FAIL` + `NOT_RUN`: Retrieval failed before the artifact was written. Do not
  run the postcondition validator; route on `Failure category` per
  `./error-handling.md`.
- `Validation: FAIL`: Stop and surface contract failure, regardless of
  `FETCH`.
- `FETCH: ERROR`: Stop and surface unexpected failure, regardless of
  `Validation`.
- Any inconsistent pairing, such as `FETCH: PASS` with `Validation: NOT_RUN`:
  treat it as an unexpected Phase 1 error and stop.

Branch on `Failure category` when it is present. Use `Reason` only for
user-facing detail.

`progress-tracker` dispatches use the same `TICKET_KEY` for workflow identity.
When reading or updating per-task state, include `TASK_NUMBER` as the playbook
specifies.

### Progress tracker dispatch (summary)

Read `../subagents/progress-tracker.md` for full behavior. Typical orchestrator
inputs:

```
TICKET_KEY: <KEY>
ACTION: read | initialize | update | initialize_task | update_task
```

- **`update`:** `PHASE` (1–4), `STATUS`, `SUMMARY`; for `PHASE=4` and
  `STATUS=complete`, include `TASKS` (metadata for the workflow task table, from
  the Phase 4 downstream summary).
- **`initialize_task`:** `TASK_NUMBER`, `TASK_TITLE`
- **`update_task`:** `TASK_NUMBER`, `PHASE` (5–7), `STATUS`, `SUMMARY`

---

## Handling Verdicts

**On PASS:** Proceed to the next step in the execution cycle. No action
needed — do not narrate the validation result unless the user asks.

**On FAIL:** Do not proceed. The response depends on the direction:

| Direction     | On FAIL                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Precondition  | A required artifact is missing. Tell the user which phase produced it and offer to run that phase.                    |
| Postcondition | The phase did not produce its expected artifact. Report the specific check that failed and offer to re-run the phase. |

<example>
Postcondition failure after Phase 2:

artifact-validator returns:
VALIDATION: FAIL
Phase: 2 | Direction: postcondition
File: docs/JNS-6065-tasks.md + planning intermediates
Checks:
  - docs/JNS-6065-stage-1-detailed.md exists: pass
  - docs/JNS-6065-stage-2-prioritized.md exists: pass
  - docs/JNS-6065-tasks.md exists: pass
  - Contains ## Validation Report: fail - missing section
  - Numbered task entries with required subsections: pass

Orchestrator to user:
"Phase 2 (Plan Tasks) did not produce a plan that satisfies the downstream
contract for clarification. The final task plan is missing `## Validation
Report`, so Phase 3 would be working from an incomplete artifact. Would you
like me to re-run Phase 2?"
</example>

---

## Artifact Categories

The orchestrator does not need to decide artifact categories dynamically.
Keep this distinction in mind when coordinating the workflow:

- **Category A** (orchestration artifacts, `docs/<KEY>*.md`): updated on disk
  only, preserved across sessions, never committed.
- **Category B** (implementation output): source code, tests, config changes —
  committed normally.
