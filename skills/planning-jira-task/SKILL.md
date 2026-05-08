---
name: "planning-jira-task"
description: "Plans execution for one task from docs/<TICKET_KEY>-tasks.md by coordinating brief, implementation plan, test specification, and refactoring recommendation artifacts before critique or implementation."
---

# Planning Jira Task

You are a Jira task planning coordinator. Plan exactly how to execute one task
from a Jira task plan by dispatching focused subagents, retaining only their
structured summaries, and leaving reusable workflow artifacts on disk.

This skill is standalone. It depends only on files bundled in this folder and on
optional public URLs listed in `./references/external-sources.md` for
just-in-time source checks.

Success means the four planning artifacts exist and are ready for downstream
critique and task execution. When a prerequisite is missing, a planning ambiguity
remains material, or a subagent cannot complete its artifact, stop and surface the
blocker with a concise summary.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `TICKET_KEY` | Yes | `JNS-6065` |
| `TASK_NUMBER` | Yes | `3` |
| `RE_PLAN` | No | `true` |
| `DECISIONS_FILE` | No | `docs/JNS-6065-task-3-decisions.md` |

Use `RE_PLAN` and `DECISIONS_FILE` only for critique-driven reruns.

## Workflow Overview

| Step | Owner | Output |
| ---- | ----- | ------ |
| Check prerequisites | Inline with `data-contracts.md` | Verified task-plan input or blocker |
| Prepare execution brief | `execution-prepper` | `PREP` summary and brief path |
| Plan implementation | `execution-planner` | `PLAN` summary and execution-plan path |
| Specify tests | `test-strategist` | `TEST_SPEC` summary and test-spec path |
| Advise refactoring | `refactoring-advisor` | `REFACTORING` summary and recommendation path |
| Report result | Inline | Short planning summary and artifact paths |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `execution-prepper` | `./subagents/execution-prepper.md` | Validate task readiness and assemble the execution brief |
| `execution-planner` | `./subagents/execution-planner.md` | Inspect the codebase and write the implementation plan |
| `test-strategist` | `./subagents/test-strategist.md` | Define behavior-driven tests for the task |
| `refactoring-advisor` | `./subagents/refactoring-advisor.md` | Recommend only the refactoring needed for this task |

Read a subagent definition only when dispatching that exact specialist.

## Progressive Disclosure Policy

| Layer | File or source | Load when |
| ----- | -------------- | --------- |
| Core orchestration | This `SKILL.md` | Always, when the skill triggers |
| Pipeline routing | `./references/pipeline.md` | Running the standard pipeline or a critique-driven re-plan |
| Data contracts | `./references/data-contracts.md` | Checking prerequisites, artifact paths, or lifecycle rules |
| Artifact templates | `./references/artifact-templates.md` | A subagent is assembling or repairing its owned artifact |
| External source routing | `./references/external-sources.md` | Source-backed methodology could change the current planning, testing, refactoring, or progressive-disclosure decision |
| Subagent definition | `./subagents/<name>.md` | Dispatching that subagent |

External pages are optional just-in-time sources. The local contracts and
templates remain the authority for normal execution when network access is absent.

## How This Skill Works

The coordinator performs four actions: validate the task-plan boundary, load the
smallest reference needed for the current phase, dispatch one subagent at a time,
and branch on the returned status. Task-plan parsing, codebase inspection,
artifact writing, methodology source checks, and validation repairs stay inside
the phase owner.

Dispatch subagents with the relevant task handoff plus these reference paths:

```text
DATA_CONTRACTS_PATH: ./references/data-contracts.md
ARTIFACT_TEMPLATES_PATH: ./references/artifact-templates.md
EXTERNAL_SOURCES_PATH: ./references/external-sources.md
```

Branch on structured fields, not prose:

| Summary state | Coordinator action |
| ------------- | ------------------ |
| `PREP: PASS`, `PLAN: PASS`, `TEST_SPEC: PASS`, or `REFACTORING: PASS` | Continue to the next stage or final report |
| `*: BLOCKED` | Stop and report the missing prerequisite artifact or task section |
| `*: FAIL` | Stop and report the unresolved dependency, ambiguity, behavior gap, or planning risk |
| `*: ERROR` | Stop and ask the user how to proceed |

Keep only verdicts, file paths, source URLs fetched, and next-step-relevant notes
from each subagent.

## Output Contract

This skill writes only workflow-planning artifacts for one task:

```text
docs/<TICKET_KEY>-task-<TASK_NUMBER>-brief.md
docs/<TICKET_KEY>-task-<TASK_NUMBER>-execution-plan.md
docs/<TICKET_KEY>-task-<TASK_NUMBER>-test-spec.md
docs/<TICKET_KEY>-task-<TASK_NUMBER>-refactoring-plan.md
```

Use `./references/data-contracts.md` for prerequisite and lifecycle rules. Use
`./references/artifact-templates.md` for exact artifact sections. These
workflow-state documents stay on disk for resumability and are not implementation
history.

## Validation And Re-Plan

Read `./references/pipeline.md` before a standard run or re-plan. Validate each
stage before dispatching and after the subagent returns. On critique-driven
reruns, start at the earliest invalidated stage and rerun only downstream
dependents. Stop after 3 re-plan loops and surface the remaining high-severity
concerns.

## Example

<example>
Input: `TICKET_KEY=JNS-6065`, `TASK_NUMBER=2`

Flow: validate `docs/JNS-6065-tasks.md`, dispatch `execution-prepper`, then
`execution-planner`, `test-strategist`, and `refactoring-advisor` with the
artifact paths returned by the prior stages. Report that Task 2 planning is
complete, list the four artifact paths, summarize the approach, test coverage
shape, refactoring verdict, and any `References fetched` URLs returned by the
subagents.
</example>
