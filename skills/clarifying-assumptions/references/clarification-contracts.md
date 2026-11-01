# Clarification Contracts

> Read this file when validating inputs or checking which orchestration artifacts this skill may update. Exact subagent inputs and paths live only in the active mode playbook's dispatch tables: [`./upfront-mode.md`](./upfront-mode.md) or [`./critique-mode.md`](./critique-mode.md).
>
> **Reminder:** This file is the operational contract. Conceptual background lives behind URLs in `./external-sources.md`.

## Input Preconditions

The main task plan must exist at `docs/<TICKET_KEY>-tasks.md`.

The main plan should contain these sections:

| Section                                   | Used for                                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `## Ticket Summary` or `## Issue Summary` | Platform-native summary section consumed upstream; either heading satisfies this contract |
| `## Problem Framing`                      | Tier 3 hard-gate questions and user-impact context                                        |
| `## Assumptions and Constraints`          | Assumptions to confirm, revise, or defer                                                  |
| `## Cross-Cutting Open Questions`         | Plan-wide blocking questions                                                              |
| `## Tasks`                                | Task-specific questions and assumptions                                                   |
| `## Validation Report`                    | Validation `FAIL` and `WARN` items                                                        |
| `## Dependency Graph`                     | Impact mapping and downstream task references                                             |

Additional upstream artifacts:

| Mode       | Required artifacts                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `upfront`  | `docs/<KEY>-stage-1-detailed.md`, `docs/<KEY>-stage-2-prioritized.md`                                                                                  |
| `critique` | `docs/<KEY>-task-<N>-brief.md`, `docs/<KEY>-task-<N>-execution-plan.md`, `docs/<KEY>-task-<N>-test-spec.md`, `docs/<KEY>-task-<N>-refactoring-plan.md` |

If a required artifact is missing, let the relevant subagent return its parseable `BLOCKED`, `FAIL`, or `WARN` verdict instead of reading raw files inline.

## Output Artifacts

This skill updates orchestration artifacts only. It does not produce implementation code.

| Artifact                                                              | Required result                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `docs/<KEY>-upfront-critique.md` or `docs/<KEY>-task-<N>-critique.md` | Full critique report written before manifest assembly so later steps consume the artifact path instead of the full report body |
| `docs/<KEY>-tasks.md` updates                                         | Main plan updated so downstream execution consumes resolved decisions instead of open ambiguity                                |
| `## Decisions Log` rows                                               | Durable audit trail for plan-wide and task-level clarification decisions                                                       |
| Deferred question tags                                                | Later critique-mode runs can identify which questions must be revisited later                                                  |
| `docs/<KEY>-task-<N>-decisions.md`                                    | Critique-mode record of task-level decisions for re-planning and execution                                                     |
| `RE_PLAN_NEEDED` in the `handoff` result                                 | Signals whether planning should be re-run before execution                                                                     |
| `BLOCKERS_PRESENT` in the `handoff` result                               | Signals that clarification ended with unresolved items and execution must stop                                                 |
| `Accepted decisions summary` in upfront-mode `handoff` results          | Parent orchestrators pass accepted decisions back into plan rework                                                             |
| `Decisions file` in critique-mode `handoff` results                     | Parent orchestrators pass the per-task decisions artifact into task rework                                                     |

These are orchestration artifacts. Preserve them for resumability and keep them out of version control unless a parent workflow explicitly defines a different artifact lifecycle.

## Final Summary

The `SKILL.md` [Output Contract](../SKILL.md#output-contract) is the only source for the user-mode summary, the `RESULT_FORMAT=handoff` field order, the blocked summary order, and the flag transitions.
