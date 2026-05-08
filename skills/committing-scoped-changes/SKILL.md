---
name: "committing-scoped-changes"
description: "Create reviewable atomic git commits from explicit file or folder paths after the user asks to commit. Use when committing selected files, preserving unrelated work, splitting broad changes into logical commits, committing ticket-scoped work, or preparing a clean review series through scoped inspection, boundary planning, staged-diff verification, and commit execution."
---

# Committing Scoped Changes

You are a scoped commit orchestrator. Turn explicit file or folder paths into one
or more reviewable git commits after the user has asked for commits to be
created. You coordinate the workflow; co-located subagents inspect repository
state, plan boundaries, stage changes, verify, and create commits.

The orchestrator does three things: normalize inputs, choose the next phase or
ask for a missing decision, and synthesize concise reports. It retains only path
scope, subagent summaries, approved plans, user decisions, and commit results.

This skill is standalone. It refers only to co-located files in this folder and
public URLs listed in `./references/external-sources.md`.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `CHANGE_PATHS` | Yes | `src/payments/`, `tests/payments.test.ts` |
| `CONTEXT_QUERY` | No | `JNS-6880`, `checkout retry bug` |
| `CONTEXT_LOCATION` | No | `docs/`, `docs/tickets/` |
| `COMMIT_STYLE` | No | `Conventional Commits`, `repo style` |
| `VERIFICATION_HINT` | No | `run payment tests` |

Normalize inputs before dispatching:

- Ask one targeted question when `CHANGE_PATHS` is missing or ambiguous.
- Treat `CHANGE_PATHS` as the allowed commit scope until the user expands it.
- Use `docs/` when `CONTEXT_QUERY` is supplied without `CONTEXT_LOCATION`.
- Infer `COMMIT_STYLE` from recent commits when it is not supplied.
- Set `COMMIT_REQUEST_CONFIRMED=true` only when the user asked to create commits.

## Workflow Overview

| Phase | Owner | Purpose | Gate |
| ----- | ----- | ------- | ---- |
| Intake | Inline | Normalize authority, scope, context, style, and verification hints | Commit request and path scope are known |
| State and context | `scoped-state-summarizer` | Summarize scoped changes, staged state, recent style, and local context | `SCOPED_STATE: PASS` |
| Boundary planning | `commit-boundary-planner` | Convert scoped facts into atomic commit groups | `COMMIT_PLAN: PASS` |
| User decision | Inline | Ask only for unresolved intent, mixed-hunk, or scope decisions | Plan is actionable |
| Commit loop | `scoped-commit-executor` | Stage, review, verify, commit, and report one group | `COMMIT_EXECUTE: PASS` |
| Report | Inline | Summarize commits, checks, remaining scoped changes, and untouched work | User can review outcome |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `scoped-state-summarizer` | `./subagents/scoped-state-summarizer.md` | Inspects scoped git state and local context, returning compact facts without raw patches |
| `commit-boundary-planner` | `./subagents/commit-boundary-planner.md` | Plans atomic commit groups, messages, checks, and required user decisions |
| `scoped-commit-executor` | `./subagents/scoped-commit-executor.md` | Creates one approved scoped commit after staged-diff review and verification |

Read a subagent file only when dispatching that subagent.

## Progressive Disclosure Policy

| Layer | File or source | Load when |
| ----- | -------------- | --------- |
| Core orchestration | This `SKILL.md` | Always, when the skill triggers |
| External source routing | `./references/external-sources.md` | A public article or docs page could change the next decision |
| Report contracts | `./references/report-contracts.md` | Formatting a subagent result or final user report |
| Subagent definitions | `./subagents/*.md` | Dispatching that exact specialist |
| Public websites | URLs from `external-sources.md` | Static guidance is needed and local rules are insufficient |

Pass relevant URLs to subagents instead of fetching pages in the orchestrator.
Subagents return the one-line conclusion they used, not copied article text.

## How This Skill Works

`CHANGE_PATHS` is an allow-list for commit candidates. Include in-scope material
changes in the plan, preserve out-of-scope work, and ask before expanding scope
or leaving meaningful in-scope changes uncommitted.

Commit groups are independently reviewable and revertable. A good group has one
reviewer-facing reason, a specific message, and the smallest meaningful
verification. Keep dependent implementation, tests, and fixtures together when
splitting would create a broken intermediate state.

Existing staged changes are inputs to the plan, not permission to commit. The
planner accounts for them, and the executor commits them only when they belong to
the approved group.

After each successful commit, redispatch `scoped-state-summarizer` before the
next group. This refreshes the plan after hooks, formatting, generated files, or
concurrent workspace changes.

## Execution Steps

1. Normalize inputs and confirm commit authority.
2. Dispatch `scoped-state-summarizer` with scope, context, and style inputs.
3. If the state summary names a `Reference need`, load `external-sources.md` and
   pass only the relevant URLs to `commit-boundary-planner`.
4. Dispatch `commit-boundary-planner`; ask the smallest user question for any
   `NEEDS_DECISION` result, then redispatch with the answer.
5. Dispatch `scoped-commit-executor` once per approved group with
   `COMMIT_REQUEST_CONFIRMED=true`. Pass staging or commit reference URLs only
   when the group plan or executor reports that Git command semantics matter.
6. Refresh state after each commit; re-plan if remaining scoped changes differ
   from the approved plan.
7. Before the final response, load `report-contracts.md` and use the
   orchestrator report contract.

## Failure Handling

Use structured subagent statuses to choose the next action:

- `NEEDS_CONTEXT` or `NEEDS_DECISION`: ask one targeted user question.
- `NO_SCOPED_CHANGES`: report that nothing in `CHANGE_PATHS` is commit-worthy.
- `VERIFY_FAILED`: retry only the failing recovery inside scope, up to three
  attempts, then report the blocker.
- `BLOCKED`, `COMMIT_ERROR`, or `ERROR`: stop with the failure contract unless a
  safe, in-scope recovery is explicit.

## Example

<example>
Input: `CHANGE_PATHS=src/checkout/, tests/checkout/`, `CONTEXT_QUERY=JNS-6880`,
`COMMIT_STYLE=Conventional Commits`.

Flow: dispatch state summarizer, plan one checkout retry group, execute one
commit, refresh state, then report the SHA, verification command, no remaining
scoped changes, and unrelated files left untouched.
</example>
