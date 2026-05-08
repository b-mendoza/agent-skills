# Preflight Checker - Dependency Manifest

> This file contains the direct dependency manifest for the Jira workflow
> preflight checker. Preflight reports availability only; it does not install,
> connect, or repair dependencies.
>
> For current Jira MCP setup details, load
> `../references/external-sources.md` and fetch the Atlassian Rovo MCP
> URL from the `Jira / Atlassian setup` section only when the user needs
> setup help.

## Classification

This manifest covers dependencies owned directly by the orchestrating workflow:
co-located subagents, sibling downstream skills, and platform transport needed
for Jira reads/writes. Downstream skills own their own transitive skill/tool
dependencies and should validate them when invoked.

Any requested required dependency confirmed as `MISSING` produces
`PREFLIGHT: FAIL`. Use `UNKNOWN` only when the platform does not expose a
reliable check. Use `ERROR` only when preflight itself cannot run.

## Phase 1 - Fetch Work Item

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| Jira MCP | MCP | Jira ticket retrieval | Verify Jira-related MCP tools are available and responsive | Connect Jira MCP in the host runtime |
| `fetching-jira-ticket` | Skill | Phase 1 orchestration | `../../fetching-jira-ticket/SKILL.md` exists | Install sibling skill at expected path |

## Phase 2 - Plan Tasks

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| `planning-jira-tasks` | Skill | Phase 2 orchestration | `../../planning-jira-tasks/SKILL.md` exists | Install sibling skill at expected path |

## Phase 3 - Clarify + Critique

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| `clarifying-assumptions` | Skill | Phase 3 orchestration | `../../clarifying-assumptions/SKILL.md` exists | Install sibling skill at expected path |

## Phase 4 - Create Child Items

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| Jira MCP | MCP | Jira subtask creation/linking | Same as Phase 1 | Same as Phase 1 |
| `creating-jira-subtasks` | Skill | Phase 4 orchestration | `../../creating-jira-subtasks/SKILL.md` exists | Install sibling skill at expected path |

## Phase 5 - Plan Task Execution

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| `planning-jira-task` | Skill | Phase 5 orchestration | `../../planning-jira-task/SKILL.md` exists | Install sibling skill at expected path |

## Phase 6 - Clarify + Critique Task Plan

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| `clarifying-assumptions` | Skill | Phase 6 orchestration | `../../clarifying-assumptions/SKILL.md` exists | Install sibling skill at expected path |

## Phase 7 - Kick Off + Execute

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| `executing-jira-task` | Skill | Phase 7 orchestration | `../../executing-jira-task/SKILL.md` exists | Install sibling skill at expected path |

## Quick Reference

| Dependency | Type | Phase(s) |
| ---------- | ---- | -------- |
| Jira MCP | MCP | 1, 4 |
| `fetching-jira-ticket` | Skill | 1 |
| `planning-jira-tasks` | Skill | 2 |
| `clarifying-assumptions` | Skill | 3, 6 |
| `creating-jira-subtasks` | Skill | 4 |
| `planning-jira-task` | Skill | 5 |
| `executing-jira-task` | Skill | 7 |

Deduplicate repeated dependencies, such as `clarifying-assumptions`, when
reporting `Available`, `Missing`, and `Unknown` counts.
