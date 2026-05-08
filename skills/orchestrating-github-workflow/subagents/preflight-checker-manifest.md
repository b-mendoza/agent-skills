# Preflight Checker - Dependency Manifest

> This file contains the direct dependency manifest for the GitHub workflow
> preflight checker. Preflight reports availability only; it does not install,
> connect, or repair dependencies.
>
> For current GitHub CLI setup details, load
> `../references/external-sources.md` and fetch one URL from the
> `GitHub CLI setup` section only when the user needs setup help.

## Classification

This manifest covers dependencies owned directly by the orchestrating workflow:
co-located subagents, sibling downstream skills, and platform transport needed
for GitHub reads/writes. Downstream skills own their own transitive skill/tool
dependencies and should validate them when invoked.

Any requested required dependency confirmed as `MISSING` produces
`PREFLIGHT: FAIL`. Use `UNKNOWN` only when the platform does not expose a
reliable check. Use `ERROR` only when preflight itself cannot run.

## Phase 1 - Fetch Work Item

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| GitHub CLI (`gh`) | Tool | Issue fetch/API access | `gh --version`; for auth, `gh auth status` | Install `gh` and authenticate |
| `fetching-github-issue` | Skill | Phase 1 orchestration | `../../fetching-github-issue/SKILL.md` exists | Install sibling skill at expected path |

## Phase 2 - Plan Tasks

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| `planning-github-issue-tasks` | Skill | Phase 2 orchestration | `../../planning-github-issue-tasks/SKILL.md` exists | Install sibling skill at expected path |

## Phase 3 - Clarify + Critique

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| `clarifying-assumptions` | Skill | Phase 3 orchestration | `../../clarifying-assumptions/SKILL.md` exists | Install sibling skill at expected path |

## Phase 4 - Create Child Items

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| GitHub CLI (`gh`) | Tool | Issue create/link/update | Same as Phase 1 | Same as Phase 1 |
| `creating-github-child-issues` | Skill | Phase 4 orchestration | `../../creating-github-child-issues/SKILL.md` exists | Install sibling skill at expected path |

## Phase 5 - Plan Task Execution

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| `planning-github-task` | Skill | Phase 5 orchestration | `../../planning-github-task/SKILL.md` exists | Install sibling skill at expected path |

## Phase 6 - Clarify + Critique Task Plan

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| `clarifying-assumptions` | Skill | Phase 6 orchestration | `../../clarifying-assumptions/SKILL.md` exists | Install sibling skill at expected path |

## Phase 7 - Kick Off + Execute

| Dependency | Type | Used by | How to check | Configure |
| ---------- | ---- | ------- | ------------ | --------- |
| GitHub CLI (`gh`) | Tool | Execution issue state/comments | Same as Phase 1 | Same as Phase 1 |
| `executing-github-task` | Skill | Phase 7 orchestration | `../../executing-github-task/SKILL.md` exists | Install sibling skill at expected path |

## Quick Reference

| Dependency | Type | Phase(s) |
| ---------- | ---- | -------- |
| GitHub CLI (`gh`) | Tool | 1, 4, 7 |
| `fetching-github-issue` | Skill | 1 |
| `planning-github-issue-tasks` | Skill | 2 |
| `clarifying-assumptions` | Skill | 3, 6 |
| `creating-github-child-issues` | Skill | 4 |
| `planning-github-task` | Skill | 5 |
| `executing-github-task` | Skill | 7 |

Deduplicate repeated dependencies, such as `gh` and `clarifying-assumptions`,
when reporting `Available`, `Missing`, and `Unknown` counts.
