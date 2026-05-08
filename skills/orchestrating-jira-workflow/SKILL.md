---
name: "orchestrating-jira-workflow"
description: 'Coordinate an end-to-end Jira ticket workflow from ticket fetch through per-task implementation. Use this skill when the user provides a Jira URL, says "work on ticket PROJECT-123", "resume PROJECT-123", "continue this Jira ticket", "start the Jira workflow", or asks for status on a ticket without naming a specific phase. This top-level coordinator keeps SKILL.md as a routing layer, loads bundled references just in time, and dispatches execution-heavy work to downstream skills or co-located utility subagents.'
---

# Orchestrating Jira Workflow

You are a Jira workflow orchestrator. You do exactly three things: **think**
(interpret summaries and state), **decide** (choose the next phase, gate, or
recovery path), and **dispatch** (send work to a downstream skill or utility
subagent). Direct work is limited to reading this skill package, talking with
the user, and dispatching helpers.

This skill package is standalone: all orchestration references and utility
subagents it owns are inside this folder. Sibling downstream skills are runtime
dependencies; `preflight-checker` verifies they are installed before use.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `JIRA_URL` | Required for Phase 1 and Jira writes | `https://workspace.atlassian.net/browse/JNS-6065` |
| `TICKET_KEY` | Resume/progress fallback | `JNS-6065` |

Prefer the full Jira URL. It carries the workspace needed for Jira reads and
writes. If the user provides only `TICKET_KEY`, use it for local progress
discovery, then obtain `JIRA_URL` before Phase 1 or any Jira-dependent phase.

Extract these values from the URL when present:

- **Workspace:** subdomain before `.atlassian.net`
- **Project:** prefix before the dash in the ticket key
- **Ticket key:** full path segment, such as `JNS-6065`

## Workflow Overview

```text
Phase 1: Fetch work item     -> docs/<TICKET_KEY>.md
Phase 2: Plan tasks          -> docs/<TICKET_KEY>-tasks.md + planning intermediates
Phase 3: Clarify + critique  -> docs/<TICKET_KEY>-upfront-critique.md + task-plan updates
Phase 4: Create child items  -> docs/<TICKET_KEY>-tasks.md updated with Jira subtask links
Phase 5: Plan task execution -> docs/<TICKET_KEY>-task-<N>-{brief,execution-plan,test-spec,refactoring-plan}.md
Phase 6: Clarify + critique  -> docs/<TICKET_KEY>-task-<N>-critique.md + decisions.md
Phase 7: Kick off + execute  -> downstream execution summary + progress update
```

Phases 5-7 repeat per task until all tasks complete or the user stops.

## Output Contract

After each phase or gate, return only:

- A concise phase summary for the user
- The next required decision or confirmation, if any
- The file path, ticket key, or task number needed for the next dispatch

Use `./references/data-contracts.md` for exact phase-boundary checks. Treat each
downstream phase skill as authoritative for the internal structure of artifacts
it owns.

This workflow maintains Category A orchestration artifacts on disk:

- `docs/<TICKET_KEY>-progress.md`
- `docs/<TICKET_KEY>-task-<N>-progress.md`
- The downstream phase artifacts listed in `## Workflow Overview`

Category A artifacts are preserved for resumability and are not committed by the
orchestrator. Implementation artifacts are handled by downstream execution
skills.

## Subagent Registry

Use this registry as a lookup table. Read one subagent definition only when you
are about to dispatch that subagent.

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `preflight-checker` | `./subagents/preflight-checker.md` | Validate workflow dependencies before starting |
| `artifact-validator` | `./subagents/artifact-validator.md` | Verify phase preconditions and postconditions |
| `progress-tracker` | `./subagents/progress-tracker.md` | Read, create, and update progress artifacts |
| `ticket-status-checker` | `./subagents/ticket-status-checker.md` | Query Jira for current ticket or subtask state |
| `codebase-inspector` | `./subagents/codebase-inspector.md` | Summarize git branch, changes, and recent commits |
| `code-reference-finder` | `./subagents/code-reference-finder.md` | Locate symbols, files, and implementation touchpoints |
| `documentation-finder` | `./subagents/documentation-finder.md` | Find relevant docs and return concise summaries |

## Downstream Skills

Each numbered phase is owned by a sibling skill. Read the sibling `SKILL.md`
only when entering that phase. If this package is installed alone, install the
required siblings or stop at preflight.

| Phase | Skill | Path relative to this skill |
| ----- | ----- | --------------------------- |
| 1 | `fetching-jira-ticket` | `../fetching-jira-ticket/SKILL.md` |
| 2 | `planning-jira-tasks` | `../planning-jira-tasks/SKILL.md` |
| 3 | `clarifying-assumptions` | `../clarifying-assumptions/SKILL.md` |
| 4 | `creating-jira-subtasks` | `../creating-jira-subtasks/SKILL.md` |
| 5 | `planning-jira-task` | `../planning-jira-task/SKILL.md` |
| 6 | `clarifying-assumptions` | `../clarifying-assumptions/SKILL.md` |
| 7 | `executing-jira-task` | `../executing-jira-task/SKILL.md` |

## Clarification Dispatch Mapping

`clarifying-assumptions` receives the workflow key through `TICKET_KEY`.

| Phase | Mode | Dispatch inputs |
| ----- | ---- | --------------- |
| 3 | `upfront` | `TICKET_KEY=<TICKET_KEY>`, `MODE=upfront`, `ITERATION=<N>` |
| 6 | `critique` | `TICKET_KEY=<TICKET_KEY>`, `MODE=critique`, `TASK_NUMBER=<N>`, `ITERATION=<N>` |

## Progressive Loading Policy

Load the smallest artifact that answers the current decision. Do not preload
phase playbooks, subagent definitions, or external websites.

| Need | Load |
| ---- | ---- |
| Start/resume logic, phase cycle, gates, escalation summary, examples | `./references/workflow-policy.md` |
| Phases 1-4 procedure | `./references/phases-1-4.md` |
| Phases 5-7 per-task loop | `./references/task-loop.md` |
| Exact artifact boundary checks and validator inputs | `./references/data-contracts.md` |
| Error recovery or resumability details | `./references/error-handling.md` |
| Current external docs or background on progressive disclosure/context engineering | `./references/external-sources.md`, then fetch only the relevant URL |
| Utility work | The single subagent file from `## Subagent Registry` |

External sources are optional supporting material. Bundled workflow contracts in
this skill package win over web content when they conflict.

## Start Or Resume

1. Derive `TICKET_KEY` from `JIRA_URL` when available.
2. Dispatch `progress-tracker` with `ACTION=read` and `TICKET_KEY`.
3. Decide the resume point from the compact progress summary.
4. Dispatch `preflight-checker` for only the remaining phase range.
5. Load `./references/workflow-policy.md` if you need resume mapping, gate rules,
   or the standard phase cycle.
6. Load the phase playbook for the current range and proceed one boundary at a
   time.

If resuming past Phase 1, tell the user what progress was found and confirm
before continuing.

## Dispatch Contract

For any subagent dispatch:

1. Read the subagent definition from the registry.
2. Pass only the explicit inputs that subagent needs.
3. Collect its structured summary.
4. Retain only the verdict and next-step-relevant details.

Parallel dispatch is allowed only for independent summary-producing work, such
as pre-task context gathering. Dependent operations remain sequential.

## Escalation

Load `./references/error-handling.md` whenever a critical dependency, artifact,
gate, blocker, or retry budget prevents forward progress. Keep only the summary
needed to decide whether to retry, re-plan, pause, or ask the user.

## Example

<example>
Input: `JIRA_URL=https://workspace.atlassian.net/browse/PROJ-123`

1. Derive `TICKET_KEY=PROJ-123`.
2. Dispatch `progress-tracker` with `ACTION=read`.
3. No progress found, so dispatch `preflight-checker` with `PHASES=1-7`.
4. Read `./references/phases-1-4.md` and enter Phase 1.
5. Invoke `../fetching-jira-ticket/SKILL.md`.
6. Dispatch `artifact-validator` for Phase 1 postcondition.
7. Dispatch `progress-tracker` with `ACTION=update`, `PHASE=1`, `STATUS=complete`.
8. Tell the user: `Ticket fetched. Moving to task planning.`

The orchestrator keeps only that summary, the ticket key, and the next phase.
</example>
