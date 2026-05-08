---
name: "committing-scoped-changes"
description: "Create reviewable atomic commits from explicit file or folder paths by orchestrating scoped git inspection, local context lookup, commit-boundary planning, staged-diff review, verification, and commit execution. Use when the user asks to commit only selected files, split work into logical commits, avoid one large commit, commit ticket-scoped changes, or prepare a clean series of commits for review."
---

# Committing Scoped Changes

You are a scoped commit orchestrator. Your job is to turn explicit file or folder
paths into one or more reviewable commits while keeping raw git output, patches,
and local documentation details inside focused subagents.

The orchestrator does three things: **decide** commit flow state, **ask** the user
for missing scope or intent, and **dispatch** execution-heavy work to subagents.
It holds only concise summaries, commit plans, user decisions, and final commit
results.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `CHANGE_PATHS` | Yes | `src/payments/`, `tests/payments.test.ts` |
| `CONTEXT_QUERY` | No | `JNS-6880`, `checkout retry bug` |
| `CONTEXT_LOCATION` | No | `docs/`, `docs/tickets/` |
| `COMMIT_STYLE` | No | `Conventional Commits`, `repo style` |
| `VERIFICATION_HINT` | No | `run payment tests` |

Ask for `CHANGE_PATHS` if missing. When `CONTEXT_QUERY` is supplied without a
location, use `docs/`. Default `COMMIT_STYLE` to the repository's existing style;
if the repo has no clear pattern, use Conventional Commits.

## Workflow Overview

| Phase | Owner | Purpose | Gate |
| ----- | ----- | ------- | ---- |
| Intake | Inline | Normalize path scope, context query, commit style, and verification hint | Required path scope is known |
| State and context | `scoped-state-summarizer` | Inspect scoped working tree changes and summarize relevant local context | Scoped change summary is available |
| Boundary planning | `commit-boundary-planner` | Convert the scoped summary into atomic commit groups | Each group has one reason and message |
| User decision | Inline | Ask only for missing intent, mixed-hunk decisions, or scope changes | Plan is actionable |
| Commit loop | `scoped-commit-executor` | Stage, review, verify, commit, and report one group at a time | Commit result is verified or escalated |
| Report | Inline | Summarize commits, checks, remaining scoped changes, and unrelated work | User can review the result |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `scoped-state-summarizer` | `./subagents/scoped-state-summarizer.md` | Inspects git state, scoped diffs, untracked files, recent commit style, and matching local context without returning raw patches |
| `commit-boundary-planner` | `./subagents/commit-boundary-planner.md` | Produces atomic commit groups, message candidates, verification suggestions, and any needed user decisions |
| `scoped-commit-executor` | `./subagents/scoped-commit-executor.md` | Stages and commits one planned group at a time after verifying the staged diff matches the approved plan |

Read a subagent file only when dispatching that specific subagent. Keep raw git
output, raw documentation, and full patches out of the orchestrator context.

## Reference Routing

Fetch these references only when they would change the next decision:

| Reference | URL | Use when |
| --------- | --- | -------- |
| Commit workflow skill | https://skills.sh/softaworks/agent-toolkit/commit-work | Staging, staged-diff review, or deliverable details are unclear |
| Conventional Commits | https://www.conventionalcommits.org/en/v1.0.0/ | Type, scope, breaking-change syntax, or message format is unclear |
| Atomic commits | https://www.aleksandrhovhannisyan.com/blog/atomic-git-commits/ | A broad or mixed diff needs commit-boundary rationale |

Pass the relevant URL to a subagent instead of preloading the page in the
orchestrator. The subagent should return only the conclusion it used.

## How This Skill Works

`CHANGE_PATHS` defines the allowed commit scope. Include changes inside those
paths, and ask before expanding the scope or excluding material in-scope changes.
`CONTEXT_QUERY` explains why the changes exist; use it to avoid guessing intent
from file names or code shape alone.

Commit groups should be independently reviewable and revertable. A good group can
be summarized with one specific message. If a group needs two unrelated reasons,
split it. If two file changes only make sense together, keep them together.

Inline work is reserved for decisions that require the conversation context:
normalizing user inputs, choosing whether to ask a question, accepting or revising
the planner's proposed groups, and reporting final results.

## Execution Steps

### 1. Normalize Inputs

Resolve placeholders in `CHANGE_PATHS`. Ask a targeted question when a path,
ticket key, context location, or commit style is missing and materially affects
safe commit decisions.

### 2. Dispatch `scoped-state-summarizer`

Pass `CHANGE_PATHS`, `CONTEXT_QUERY`, `CONTEXT_LOCATION`, and `COMMIT_STYLE`.
Proceed only with `SCOPED_STATE: PASS`.

If the subagent returns `NEEDS_CONTEXT`, ask the user for the missing intent or
context location before continuing. If it returns `NO_SCOPED_CHANGES` or
`BLOCKED`, stop with the failure envelope.

### 3. Dispatch `commit-boundary-planner`

Pass the scoped state summary, `COMMIT_STYLE`, `VERIFICATION_HINT`, and only the
reference URLs that may help resolve unclear boundaries or message format.

Proceed with `COMMIT_PLAN: PASS`. If the planner returns `NEEDS_DECISION`, ask
the smallest user question, then redispatch with the answer. If it returns
`BLOCKED`, stop with the failure envelope.

### 4. Execute Planned Groups

For each approved group, dispatch `scoped-commit-executor` with the exact group
plan, `CHANGE_PATHS`, `COMMIT_STYLE`, `VERIFICATION_HINT`, and
`COMMIT_REQUEST_CONFIRMED=true`.

After each successful commit, redispatch `scoped-state-summarizer` before running
the next group. This prevents stale plans after hooks, formatting, or concurrent
workspace changes. If the remaining scoped state differs from the plan, return to
the boundary planning phase.

### 5. Handle Verification Failures

If `scoped-commit-executor` returns `VERIFY_FAILED`, use the reported failing
check to decide the next step:

- Redispatch the executor only when the recovery is clearly inside the approved
  group and requested scope.
- Ask the user when the fix would expand scope, change intent, or require a new
  commit boundary.
- Stop after three failed attempts for the same group and report the blocker.

### 6. Report Results

Return the commit list, per-commit summaries, verification status, remaining
scoped changes, and unrelated changes left untouched. Do not paste raw diffs.

## Output Contract

On success, report:

```text
Commits created:
- <sha> <message>
  Summary: <what changed and why>
  Verification: <check run or "not run: reason">

Remaining scoped changes: <none or concise list>
Unrelated changes left untouched: <none or concise list>
References fetched: <none or concise list>
```

When blocked, report:

```text
COMMIT_SCOPED_CHANGES: BLOCKED | NEEDS_CONTEXT | NO_SCOPED_CHANGES | VERIFY_FAILED
Reason: <one line>
Next step: <one clear action or question>
```

## Example

<example>
Input:

- `CHANGE_PATHS`: `src/checkout/`, `tests/checkout/`
- `CONTEXT_QUERY`: `JNS-6880`
- `COMMIT_STYLE`: `Conventional Commits`

Flow:

1. Orchestrator dispatches `scoped-state-summarizer`; it returns changed checkout
   files, matching `JNS-6880` context summary, and recent conventional commit
   style.
2. Orchestrator dispatches `commit-boundary-planner`; it returns one group:
   checkout retry behavior plus tests, with message `fix(checkout): retry failed
   payment confirmation`.
3. Orchestrator dispatches `scoped-commit-executor`; it stages only the planned
   checkout files, reviews the staged diff, runs the checkout tests, commits, and
   returns the commit SHA.
4. Orchestrator redispatches `scoped-state-summarizer`; it reports no remaining
   scoped changes and unrelated files untouched.

Output:

```text
Commits created:
- abc1234 fix(checkout): retry failed payment confirmation
  Summary: Adds retry handling for failed checkout confirmation and covers it with checkout tests.
  Verification: npm test -- checkout

Remaining scoped changes: none
Unrelated changes left untouched: README.md modified
References fetched: none
```
</example>

<example>
Failure:

`CONTEXT_QUERY=JNS-6880` is provided, no matching docs are found, and the scoped
diff changes both retry behavior and telemetry naming.

Output:

```text
COMMIT_SCOPED_CHANGES: NEEDS_CONTEXT
Reason: The scoped diff has two plausible intents and no matching JNS-6880 context was found.
Next step: Provide the relevant context file or confirm whether retry behavior and telemetry naming should be separate commits.
```
</example>
