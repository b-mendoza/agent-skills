# GitHub Task-Planning Playbook

> Read this file only after detecting the GitHub platform. It supplies the
> platform tokens that thread through the shared planning references and
> subagents. Shared planning logic lives in `./task-planning-guide.md`,
> `./dependency-and-branch-guide.md`, `./output-contract.md`,
> `./validation-checks.md`, `./re-plan-cycle.md`, and `./execution-guide.md`.

## Inputs and Identifier

| Input | Required | Example |
| ----- | -------- | ------- |
| `ISSUE_SLUG` | Yes | `acme-app-42` |

`ISSUE_SLUG` is the `<KEY>` for every artifact path. Phase 2 is file-driven:
`docs/<ISSUE_SLUG>.md` must already exist as the GitHub issue snapshot from
Phase 1. Pass the value under the shared parameter name `TICKET_KEY` for
shared orchestration handoffs; the value shape remains the GitHub
`ISSUE_SLUG`.

## Vocabulary Tokens

| Token | Value |
| ----- | ----- |
| Work-item noun | `issue` |
| Child-item noun | `child issue` (a GitHub child issue or sub-issue) |
| Current-item mode name | `Current-Child-Issue Mode` |
| Task-plan summary heading | `## Issue Summary` |

Shared files use the neutral phrase "work item" and the token names above;
render them with these GitHub values in artifacts and prose the playbook
owns. The task-plan summary heading `## Issue Summary` is the heading the
downstream orchestrator expects in `docs/<ISSUE_SLUG>-tasks.md`.

## Consumed Snapshot Sections

When reading `docs/<ISSUE_SLUG>.md` for existing child work and planning
context, consume: `## Child Issues` (existing child work not to duplicate),
`## Linked Issues`, `## Labels`, `## Assignees`, `## Milestone`, and
`## Projects`, plus the always-present `## Description`,
`## Acceptance Criteria`, `## Comments`, and `## Metadata`.

## Current-Item Detection

Treat the work item as already child work (enter Current-Child-Issue Mode)
when `## Metadata` indicates the current issue is itself a GitHub child issue
or sub-issue, or the snapshot otherwise shows this is child work. In that
mode: skip downstream child-issue creation, keep all tasks on one branch, and
do not invent child issues of the child issue.

## Branch Identifier

Lowercase issue slug. Default parent-issue branch:
`feature/<issue-slug-lower>-task-<n>-<short-task-slug>`. Current-Child-Issue
Mode branch: `feature/<issue-slug-lower>-<short-issue-slug>` (single branch
for all tasks).

## External-Source Routing

| Need | Key in `./external-sources.md` |
| ---- | ------------------------------ |
| GitHub parent / sub-issue hierarchy semantics | `github-sub-issues` |
| GitHub issue types and label behavior | `github-issue-types` |
| Git branch ref-name validity | `git-check-ref-format` |

## Example Invocation

```yaml
ISSUE_SLUG: acme-app-42
```
