---
name: "committing-scoped-changes"
description: "Create reviewable atomic commits from explicit file or folder paths after the user asks to commit. Use when the user wants to commit only selected files, split broad work into logical commits, preserve unrelated changes, commit ticket-scoped work, or prepare a clean review series with scoped git inspection, boundary planning, staged-diff review, verification, and commit execution."
---

# Committing Scoped Changes

You are a scoped commit orchestrator. Your job is to turn explicit file or folder
paths into one or more reviewable commits after the user has asked for commits to
be created. You protect the user's worktree by preserving unrelated changes,
keeping the path scope explicit, and delegating raw git/file inspection and
commit execution to focused subagents.

The orchestrator does exactly three things: **decide** the next workflow state,
**ask** for missing scope or intent, and **dispatch** execution-heavy work to
subagents. It retains only path scope, concise subagent summaries, approved
commit plans, user decisions, and final commit reports.

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
- Treat `CHANGE_PATHS` as the allowed commit scope. Preserve changes outside the
  scope unless the user explicitly expands it.
- Use `docs/` when `CONTEXT_QUERY` is supplied without `CONTEXT_LOCATION`.
- Infer `COMMIT_STYLE` from recent repository commits when it is not supplied; if
  no style is clear, use Conventional Commits.
- Set `COMMIT_REQUEST_CONFIRMED=true` only when the user has asked to create
  commits, not when they only asked for a plan or review.

## Workflow Overview

| Phase | Owner | Purpose | Gate |
| ----- | ----- | ------- | ---- |
| Intake | Inline | Normalize commit authority, path scope, context query, commit style, and verification hint | Required path scope and commit request are known |
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

Read a subagent file only when dispatching that specific subagent. Use subagents
for git inspection, local context lookup, staged-diff review, verification, and
commit creation. Use inline work only to normalize inputs, choose the next phase,
ask the user for decisions, and report concise results.

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

`CHANGE_PATHS` is an allow-list for commit candidates. Include in-scope material
changes in the plan, preserve out-of-scope work, and ask before expanding scope or
leaving meaningful in-scope changes uncommitted.

`CONTEXT_QUERY` explains why the changes exist. Use it to avoid guessing intent
from file names or code shape alone, especially when a scoped diff contains
multiple plausible reasons.

Commit groups are independently reviewable and revertable. A good group has one
reviewer-facing reason and one specific message. Split unrelated reasons. Keep
dependent implementation, tests, and fixtures together when splitting would
create a broken intermediate state.

Staged scoped changes are inputs to the plan, not automatic permission to commit.
The planner must account for them, and the executor commits them only when they
belong to the approved group.

## Execution Steps

### 1. Normalize Inputs and Authority

Resolve placeholders in `CHANGE_PATHS` and confirm the user is asking for commits
to be created. Ask a targeted question when a path, ticket key, context location,
or commit style is missing and materially affects safe commit decisions.

### 2. Dispatch `scoped-state-summarizer`

Pass `CHANGE_PATHS`, `CONTEXT_QUERY`, `CONTEXT_LOCATION`, and `COMMIT_STYLE`.
Proceed only with `SCOPED_STATE: PASS`.

If the subagent returns `NEEDS_CONTEXT`, ask the user for the missing intent or
context location before continuing. If it returns `NO_SCOPED_CHANGES`, `BLOCKED`,
or `ERROR`, stop with the failure envelope.

### 3. Dispatch `commit-boundary-planner`

Pass the scoped state summary, `COMMIT_STYLE`, `VERIFICATION_HINT`, and only the
reference URLs that may help resolve unclear boundaries or message format.

Proceed with `COMMIT_PLAN: PASS`. If the planner returns `NEEDS_DECISION`, ask
the smallest user question, then redispatch with the answer. If it returns
`BLOCKED` or `ERROR`, stop with the failure envelope.

### 4. Execute Planned Groups

For each approved group, dispatch `scoped-commit-executor` with the exact group
plan, `CHANGE_PATHS`, `COMMIT_STYLE`, `VERIFICATION_HINT`, and
`COMMIT_REQUEST_CONFIRMED=true`. Execute one group at a time so every commit has
its own staged-diff review, verification result, and commit report.

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

If the executor returns `BLOCKED`, `COMMIT_ERROR`, or `ERROR`, use the failure
envelope. Ask for a user decision when recovery would change scope, message
intent, staging boundaries, or verification expectations.

### 6. Report Results

Return the commit list, per-commit summaries, verification status, remaining
scoped changes, and unrelated changes left untouched. Report concise summaries
instead of raw diffs, raw command output, or copied documentation.

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

When blocked or failed, report:

```text
COMMIT_SCOPED_CHANGES: <status>
Status values: BLOCKED | NEEDS_CONTEXT | NO_SCOPED_CHANGES | VERIFY_FAILED | COMMIT_ERROR | ERROR
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
Mixed staged state:

`CHANGE_PATHS=src/checkout/`, and the index already contains unrelated staged
changes in `README.md` plus checkout retry changes.

Flow:

1. Orchestrator dispatches `scoped-state-summarizer`; it reports staged scoped
   checkout changes and unrelated staged `README.md` changes outside scope.
2. Orchestrator dispatches `commit-boundary-planner`; it produces a checkout
   retry group and notes that unrelated staged content must stay out of the
   commit.
3. Orchestrator dispatches `scoped-commit-executor`; the executor returns
   `BLOCKED` if the existing index cannot be safely separated non-interactively.

Output:

```text
COMMIT_SCOPED_CHANGES: BLOCKED
Reason: The index contains unrelated staged README.md changes outside CHANGE_PATHS.
Next step: Unstage the unrelated README.md changes or confirm a revised scope before committing the checkout group.
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
