# Data Contracts - Artifact Validation Quick Reference

> Consult this file when you need to know exactly what to pass to
> `artifact-validator` at a phase boundary, or what a PASS/FAIL verdict means
> for your next decision.
>
> Reminder: the orchestrator reads skill/reference/subagent files, talks to the
> user, and dispatches helpers. Validation stays delegated; this file is the
> compact contract reference, not a substitute for the phase playbooks.

---

## Validation by Phase Transition

Each row shows what to dispatch to `artifact-validator` and what to expect.

### Phases 1–4

For Phase 1, the compact gate below mirrors the stable snapshot contract owned
by `fetching-jira-ticket`. Treat that downstream skill as the authoritative
definition of `docs/<KEY>.md`.

| Phase | Direction     | File to check           | Expected checks                                                |
| ----- | ------------- | ----------------------- | -------------------------------------------------------------- |
| 1     | postcondition | `docs/<KEY>.md`         | File exists and contains the required Phase 1 snapshot headings: `## Metadata`, `## Description`, `## Acceptance Criteria`, `## Comments`, `## Retrieval Warnings`, `## Subtasks`, `## Linked Issues`, `## Attachments`, `## Custom Fields` |
| 2     | precondition  | `docs/<KEY>.md`         | Same as Phase 1 postcondition                                  |
| 2     | postcondition | `docs/<KEY>-tasks.md` + planning intermediates | `docs/<KEY>-stage-1-detailed.md` and `docs/<KEY>-stage-2-prioritized.md` exist; `docs/<KEY>-tasks.md` exists; final plan contains `## Ticket Summary`, `## Problem Framing`, `## Assumptions and Constraints`, `## Cross-Cutting Open Questions`, `## Tasks`, `## Execution Order Summary`, `## Dependency Graph`, and `## Validation Report`; plan has ≥2 numbered task entries with the required task subsections |
| 3     | precondition  | `docs/<KEY>-tasks.md` + planning intermediates | Same as Phase 2 postcondition                                  |
| 3     | postcondition | `docs/<KEY>-tasks.md`   | Contains `## Decisions Log`                                    |
| 4     | precondition  | `docs/<KEY>-tasks.md`   | Same as Phase 3 postcondition                                  |
| 4     | postcondition | `docs/<KEY>-tasks.md`   | Contains `## Jira Subtasks` with ≥1 key matching `[A-Z]+-\d+` |
| 5     | precondition  | `docs/<KEY>-tasks.md`   | Same as Phase 4 postcondition                                  |

### Phases 5–7 (per task)

| Phase | Direction     | File to check                      | Expected checks                  |
| ----- | ------------- | ---------------------------------- | -------------------------------- |
| 5     | postcondition | `docs/<KEY>-task-<N>-*.md`         | All 4 planning artifacts exist   |
| 6     | precondition  | `docs/<KEY>-task-<N>-*.md`         | All 4 planning artifacts exist   |
| 6     | postcondition | `docs/<KEY>-task-<N>-decisions.md` | File exists                      |
| 7     | precondition  | `docs/<KEY>-task-<N>-*.md`         | Same as Phase 6 precondition; these inputs feed the execution kickoff |

---

## Dispatch Format

Every dispatch to `artifact-validator` uses these inputs:

```
TICKET_KEY: <KEY>
PHASE: <1-7>
DIRECTION: <precondition | postcondition>
TASK_NUMBER: <N>    (phases 5–7 only)
```

The subagent returns a structured verdict:

```
VALIDATION: <PASS | FAIL>
Phase: <N> | Direction: <precondition | postcondition>
File: <path>
Checks:
  - File exists: <✅ | ❌>
  - <Section check>: <✅ | ❌ — detail if failed>
```

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
  only, preserved across sessions.
- **Category B** (implementation output): source code, tests, config changes —
  committed normally.
