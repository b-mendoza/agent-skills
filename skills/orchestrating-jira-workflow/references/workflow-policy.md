# Workflow Policy

> Load this file when starting or resuming the workflow, checking a gate, or
> deciding how to route a blocker. Keep the orchestrator at summary level:
> dispatch helpers for raw checks and retain only compact verdicts.

This reference holds the operating policy that is useful across phases. The
phase-specific playbooks remain in `./phases-1-4.md` and `./task-loop.md`.

## Context Boundaries

The orchestrator holds only:

- Decision-relevant summaries from subagents and downstream skills
- Current workflow state: phase, task number, status, next gate
- User instructions and confirmations
- Failure reports that require judgment

Use structured handoffs: `TICKET_KEY`, file paths, task numbers, Jira keys, and
short summaries. Validation, Jira queries, file updates, git inspection, code
search, and documentation lookup are delegated.

If you need general background on why this policy exists, read
`./external-sources.md` and fetch the progressive disclosure or context
engineering sources only if the user asks or a design decision depends on them.

## Standard Phase Cycle

Phases 1-6 use this cycle:

1. Announce the phase banner.
2. Validate preconditions by dispatching `artifact-validator` when the phase has
   a precondition.
3. Invoke the downstream skill by reading its sibling `SKILL.md` just in time.
4. Validate postconditions by dispatching `artifact-validator`.
5. Update progress by dispatching `progress-tracker`.
6. Run the gate check: advance automatically, ask the user, or enter a targeted
   re-plan/retry loop.

Phase 7 uses the same precondition -> downstream skill -> progress -> gate
shape, but `executing-jira-task` owns internal kickoff, implementation, quality
gates, and targeted fix cycles. The orchestrator does not add a Phase 7
postcondition validator.

Use this banner format:

```text
----------------------------------------
Phase <N>/7 - <Phase name>
----------------------------------------
```

When a phase has a targeted fix or re-plan loop, re-run only the failing phase
and failing gate. Maximum: 3 loops before escalating to the user.

## Gate Rules

| Boundary | Gate type | Rule |
| -------- | --------- | ---- |
| 1 -> 2 | Automatic | Proceed when validation passes |
| 2 -> 3 | Automatic | Proceed when validation passes |
| 3 -> 4 | User gate | Proceed only when validation passes, `BLOCKERS_PRESENT=false`, and the user explicitly approves Jira writes |
| 4 -> 5 | User gate | User selects the next task to execute |
| 5 -> 6 | Automatic | Proceed when planning artifacts validate |
| 6 -> 7 | User gate | Proceed only when validation passes, `BLOCKERS_PRESENT=false`, and the user confirms the critiqued task plan is ready for real execution |
| 7 -> next task | User gate | User chooses the next task or stops |

For Phases 3 and 6, gate decisions use both the validator verdict and the
`clarifying-assumptions` final summary. `BLOCKERS_PRESENT=true` is a hard stop.
`RE_PLAN_NEEDED=true` reopens the relevant planning phase before the gate can
advance.

## Starting And Resuming

1. Resolve `TICKET_KEY` from `JIRA_URL` when available.
2. Dispatch `progress-tracker` with `ACTION=read`.
3. Determine the start point from the progress summary.
4. Dispatch `preflight-checker` only for the remaining phases.
5. Confirm with the user before resuming past Phase 1.
6. Load the phase playbook for the current phase range.

Resume mapping:

| Progress indicates | Resume from |
| ------------------ | ----------- |
| No artifacts found | Phase 1 |
| Phase 1 complete, Phase 2 not started | Phase 2 |
| Phases 1-2 complete, Phase 3 not done | Phase 3 |
| Phases 1-3 complete, Phase 4 not done | Phase 4 |
| Phases 1-4 complete, no tasks started | Phase 5 task selection |
| Task N at Phase 5 complete, Phase 6 not done | Phase 6, Task N |
| Task N at Phase 6 complete, Phase 7 not done | Phase 7, Task N |
| Task N complete, other tasks remaining | Phase 5 task selection |

Preflight range examples:

| Resume point | `PHASES` input |
| ------------ | -------------- |
| Fresh start | `1-7` |
| Resume at Phase 3 | `3-7` |
| Resume at Phase 6, Task 2 | `6-7` |

## Clarification Flags

Treat `RE_PLAN_NEEDED` and `BLOCKERS_PRESENT` as phase-boundary inputs even
though they are not validator artifacts.

If `RE_PLAN_NEEDED=true` in Phase 3, re-run Phase 2 with accepted decisions,
then re-run Phase 2 postcondition and Phase 3. If it appears in Phase 6,
re-run Phase 5 with the task decisions file, then re-run Phase 6.

If `BLOCKERS_PRESENT=true`, stop before Jira writes or task execution. Surface
the unresolved blockers and resume only after the user resolves or accepts them.

## Phase 7 Ownership

Once the normal Phase 5 plus Phase 6 handoff validates, `executing-jira-task`
owns the execution-side readiness contract. It decides which kickoff artifacts
are required, whether the Jira subtask can transition to `In Progress`, and how
quality gate fix cycles run.

If `executing-jira-task` returns `BLOCKED` from kickoff, task execution,
documentation, requirements verification, or a quality reviewer, treat it as a
resume point. Record the task as stopped at Phase 7, surface the blocker, and
resume from that Phase 7 step after the blocker is resolved.

## Escalation Summary

Load `./error-handling.md` for detailed recovery routing when any of these
conditions occurs:

- `PREFLIGHT: FAIL` or `PREFLIGHT: ERROR`
- Critical validator or progress failures
- Jira MCP unavailable for a Jira-dependent phase
- Phase 1 fetch failure or inconsistent fetch/validation summary
- Phase 7 `BLOCKED`, downstream `ERROR`, or exhausted execution fix cycle
- Retry or re-plan loop exhausted

## Examples

<example>
Resume scenario:

`progress-tracker` returns: `Phases: 1 complete | 2 complete | 3 complete | 4 complete; Tasks: 1/3 complete | Task 2: Phase 5 active; Resume from: Phase 5, Task 2`

Orchestrator response: `Found existing progress for JNS-6065. Phases 1-4 are complete and Task 2 was in planning. Shall I resume from Phase 5 for Task 2?`
</example>

<example>
Phase 7 kickoff blocker:

`executing-jira-task` reports `BLOCKED` because unrelated local changes make
workspace mutation unsafe. Record Phase 7 as failed/blocked in task progress,
present the blocker summary, and resume from Phase 7 after the user resolves the
workspace state.
</example>
