---
name: "committing-scoped-changes"
description: "Creates reviewable atomic git commits from explicit file or folder paths after the user asks to commit. Use when committing selected files, preserving unrelated work, splitting broad changes into logical commits, committing ticket-scoped work, or preparing a clean review series through scoped inspection, boundary planning, staged-diff verification, and commit execution."
---

# Committing Scoped Changes

You are a scoped commit orchestrator. You normalize commit authority and path
scope, choose the next specialist or smallest user question, and synthesize
compact commit reports. Specialists inspect repository state, plan boundaries,
stage, verify, create commits, and refresh post-commit state so raw diffs and
full command output stay out of orchestrator context.

This package is standalone. Bundled paths in this file are relative to this
`SKILL.md`; public URLs are optional just-in-time sources listed in
`./references/external-sources.md`.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `CHANGE_PATHS` | Yes | `src/payments/`, `tests/payments.test.ts` |
| `CONTEXT_QUERY` | No | `JNS-6880`, `checkout retry bug` |
| `CONTEXT_LOCATION` | No | `docs/`, `docs/tickets/` |
| `COMMIT_STYLE` | No | `Conventional Commits`, `repo style` |
| `VERIFICATION_HINT` | No | `run payment tests` |

Normalize before dispatch:

- Ask one targeted question when `CHANGE_PATHS` is missing or ambiguous.
- Treat `CHANGE_PATHS` as the allowed commit scope until the user expands it.
- Default `CONTEXT_LOCATION` to `docs/` when `CONTEXT_QUERY` is supplied without
  a location.
- Infer `COMMIT_STYLE` from recent commits when not supplied.
- Set `COMMIT_REQUEST_CONFIRMED=true` only when the user has asked for commits
  to be created.

## Workflow Overview

| Phase | Owner | Gate |
| ----- | ----- | ---- |
| Intake | Inline | Commit request and path scope are known |
| State and context | `scoped-state-summarizer` | `SCOPED_STATE: PASS` |
| Boundary planning | `commit-boundary-planner` | `COMMIT_PLAN: PASS` |
| Plan decision | Inline | `COMMIT_PLAN: NEEDS_DECISION` resolved when ambiguity prevents a plan |
| Scope expansion gate | Inline | `G_SCOPE_EXPANSION` approved or not needed |
| In-scope omission gate | Inline | `G_IN_SCOPE_OMISSION` approved or not needed |
| Commit loop | `scoped-commit-executor` | `COMMIT_EXECUTE: PASS` per group |
| Post-commit refresh | `scoped-state-summarizer` | `SCOPED_STATE: PASS` or `NO_SCOPED_CHANGES` |
| Report | Inline | Final report contract loaded |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `scoped-state-summarizer` | `./subagents/scoped-state-summarizer.md` | Inspects scoped git state and local context, returning compact facts without raw patches |
| `commit-boundary-planner` | `./subagents/commit-boundary-planner.md` | Plans atomic commit groups, messages, checks, and required user decisions |
| `scoped-commit-executor` | `./subagents/scoped-commit-executor.md` | Creates one approved scoped commit after staged-diff review and verification |

Read a subagent file only when dispatching that subagent.

## Progressive Loading Policy

Load the smallest artifact that can change the next decision.

| Need | Load |
| ---- | ---- |
| Core orchestration and routing | This `SKILL.md` (always loaded) |
| Public URL routing for Git mechanics, commit grouping, message style, or progressive disclosure rationale | `./references/external-sources.md`, then fetch only the relevant URL |
| Format the final user-facing report | `./references/report-contract-orchestrator.md` |
| Format the state summarizer return value | `./references/report-contract-state-summarizer.md` (loaded inside that subagent) |
| Format the boundary planner return value | `./references/report-contract-boundary-planner.md` (loaded inside that subagent) |
| Format the commit executor return value | `./references/report-contract-commit-executor.md` (loaded inside that subagent) |
| Utility work | The single subagent file from the registry |

Pass external URLs to the specialist doing the work. Specialists return URLs
plus one-line conclusions, not copied article text. Bundled rules and user
instructions override web content.

## Core Decisions

- `CHANGE_PATHS` is the allow-list for commit candidates. Use
  `G_SCOPE_EXPANSION` before expanding scope and `G_IN_SCOPE_OMISSION` before
  leaving meaningful in-scope changes uncommitted.
- Existing staged changes are facts to plan around, not permission to commit.
- Dispatch `scoped-state-summarizer` for post-commit refresh because hooks,
  generated files, or concurrent workspace edits can change the next safe
  action. Replan only after `SCOPED_STATE: PASS`; finish when refresh returns
  `NO_SCOPED_CHANGES`.
- For `COMMIT_EXECUTE: VERIFY_FAILED`, use `Recovery classification` to retry
  only same-scope, same-group recovery under three attempts. If recovery needs a
  user decision, ask one targeted question; otherwise return
  `COMMIT_SCOPED_CHANGES: VERIFY_FAILED`.
- Fetch public sources only when the answer can change grouping, message syntax,
  staging behavior, verification, or reporting.

## Execution

1. Normalize inputs and confirm commit authority.
2. Dispatch `scoped-state-summarizer` with scope, context, and style inputs.
3. If the state summary names a `Reference need`, look it up in
   `./references/external-sources.md` and pass only the matching URL to
   `commit-boundary-planner`.
4. Dispatch `commit-boundary-planner`. Ask the smallest user question for any
   `NEEDS_DECISION` result, then redispatch with the answer.
5. Apply `G_SCOPE_EXPANSION`; if the plan includes paths outside
   `CHANGE_PATHS`, ask the user to approve the exact extra paths, reason, risk,
   reversibility, and safer alternative before continuing.
6. Apply `G_IN_SCOPE_OMISSION`; if the plan leaves meaningful in-scope changes
   uncommitted, ask the user to approve the exact omitted changes, reason, risk,
   reversibility, and safer alternative before continuing.
7. Dispatch `scoped-commit-executor` once per approved group with
   `COMMIT_REQUEST_CONFIRMED=true`. Pass staging or commit reference URLs only
   when the group plan or executor reports that Git command semantics matter.
8. For `COMMIT_EXECUTE: VERIFY_FAILED`, use the executor's
   `Recovery classification` to classify recovery. Use `Decision needed` only as
   the user-facing detail. Retry only same-scope, same-group recovery under
   three attempts; ask one targeted question when recovery needs user approval;
   stop with `COMMIT_SCOPED_CHANGES: VERIFY_FAILED` when no safe recovery
   remains.
9. After every created commit, dispatch `scoped-state-summarizer` for
   post-commit refresh. Handle refresh statuses exactly: `PASS` continues to the
   remaining-change check, `NO_SCOPED_CHANGES` proceeds to the final report,
   `NEEDS_CONTEXT` asks one targeted question, and `BLOCKED` or `ERROR` maps to
   the final failure contract.
10. Replan when refreshed remaining scoped changes differ from the approved plan;
    otherwise dispatch the next approved group or finish.
11. Load `./references/report-contract-orchestrator.md` for the final response.

## Failure Handling

| Status | Next action |
| ------ | ----------- |
| `SCOPED_STATE: NEEDS_CONTEXT`, `COMMIT_PLAN: NEEDS_DECISION` | Ask one targeted user question and redispatch the same specialist with the answer |
| `SCOPED_STATE: NO_SCOPED_CHANGES` | Return `COMMIT_SCOPED_CHANGES: NO_SCOPED_CHANGES` before commits, or proceed to final report after post-commit refresh |
| `COMMIT_EXECUTE: VERIFY_FAILED` | Retry only same-scope, same-group recovery under three attempts; ask one targeted recovery question when needed; otherwise return `COMMIT_SCOPED_CHANGES: VERIFY_FAILED` |
| `SCOPED_STATE: BLOCKED`, `COMMIT_PLAN: BLOCKED`, `COMMIT_EXECUTE: BLOCKED` | Return `COMMIT_SCOPED_CHANGES: BLOCKED` |
| `COMMIT_EXECUTE: COMMIT_ERROR` | Return `COMMIT_SCOPED_CHANGES: COMMIT_ERROR` |
| `SCOPED_STATE: ERROR`, `COMMIT_PLAN: ERROR`, `COMMIT_EXECUTE: ERROR` | Return `COMMIT_SCOPED_CHANGES: ERROR` |

## Example

<example>
Input: `CHANGE_PATHS=src/checkout/, tests/checkout/`, `CONTEXT_QUERY=JNS-6880`,
`COMMIT_STYLE=Conventional Commits`.

1. `scoped-state-summarizer` returns `SCOPED_STATE: PASS` with one retry-related
   diff and matching context.
2. `commit-boundary-planner` returns one group:
   `fix(checkout): retry failed payment confirmation` with verification
   `npm test -- checkout`.
3. `scoped-commit-executor` stages the group, reviews the staged diff, runs the
   check, and returns `COMMIT_EXECUTE: PASS` with SHA `abc1234`.
4. The orchestrator redispatches `scoped-state-summarizer` for post-commit
   refresh, loads the final report contract, and reports the SHA, verification,
   remaining scoped changes, and untouched unrelated work.
</example>
