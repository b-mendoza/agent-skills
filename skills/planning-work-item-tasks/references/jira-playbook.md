# Jira Task-Planning Playbook

> Read this file only after detecting the Jira platform. It supplies the
> platform tokens that thread through the shared planning references and
> subagents. Shared planning logic lives in `./task-planning-guide.md`,
> `./dependency-and-branch-guide.md`, `./output-contract.md`,
> `./validation-checks.md`, `./re-plan-cycle.md`, and `./execution-guide.md`.

## Inputs and Identifier

| Input | Required | Example |
| ----- | -------- | ------- |
| `TICKET_KEY` | Yes | `JNS-6065` |

`TICKET_KEY` is the `<KEY>` for every artifact path. Phase 2 is file-driven:
`docs/<TICKET_KEY>.md` must already exist as the Jira ticket snapshot from
Phase 1. Pass the value under the shared parameter name `TICKET_KEY`.

## Vocabulary Tokens

| Token | Value |
| ----- | ----- |
| Work-item noun | `ticket` |
| Child-item noun | `subtask` (a Jira subtask) |
| Current-item mode name | `Current-Subtask Mode` |
| Task-plan summary heading | `## Ticket Summary` |

Shared files use the neutral phrase "work item" and the token names above;
render them with these Jira values in artifacts and prose the playbook owns.
The task-plan summary heading `## Ticket Summary` is the heading the
downstream orchestrator expects in `docs/<TICKET_KEY>-tasks.md`.

## Consumed Snapshot Sections

When reading `docs/<TICKET_KEY>.md` for existing child work and planning
context, consume: `## Subtasks` (existing child work not to duplicate),
`## Linked Issues`, and `## Custom Fields` (additional requirements or
constraints), plus the always-present `## Description`,
`## Acceptance Criteria`, `## Comments`, and `## Metadata`.

## Current-Item Detection

Treat the work item as already child work (enter Current-Subtask Mode) when
`## Metadata` indicates the current ticket is itself a Jira subtask, or the
snapshot otherwise shows this is child work. In that mode: skip downstream
subtask creation, keep all tasks on one branch, and do not invent subtasks
of the subtask.

## Branch Identifier

Lowercase Jira key. Default parent-ticket branch:
`feature/<ticket-key-lower>-task-<n>-<short-task-slug>`. Current-Subtask Mode
branch: `feature/<ticket-key-lower>-<short-ticket-slug>` (single branch for
all tasks).

## External-Source Routing

| Need | Key in `./external-sources.md` |
| ---- | ------------------------------ |
| Jira parent / subtask hierarchy semantics | `jira-subtasks` |
| Git branch ref-name validity | `git-check-ref-format` |

## Example Invocation

```yaml
TICKET_KEY: JNS-6065
```
