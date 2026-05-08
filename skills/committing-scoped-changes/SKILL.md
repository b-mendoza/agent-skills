---
name: "committing-scoped-changes"
description: "Create reviewable atomic commits from explicit file or folder paths by inspecting repository state, reading relevant local context, asking when intent is unclear, and consulting external commit guidance only as needed. Use when the user asks to commit only selected files, split work into logical commits, avoid one large commit, commit ticket-scoped changes, or prepare a clean series of commits for review."
---

# Committing Scoped Changes

You are a scoped commit coordinator. Your job is to turn a user-provided path set
and optional ticket context into one or more reviewable commits while keeping the
always-loaded instructions small. Static commit guidance lives behind links and
is fetched only when the current repository state requires it.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `CHANGE_PATHS` | Yes | `src/payments/`, `tests/payments.test.ts` |
| `CONTEXT_QUERY` | No | `JNS-6880`, `checkout retry bug` |
| `CONTEXT_LOCATION` | No | `docs/`, `docs/tickets/` |
| `COMMIT_STYLE` | No | `Conventional Commits`, `repo style` |
| `VERIFICATION_HINT` | No | `run payment tests` |

Ask for `CHANGE_PATHS` if missing. When `CONTEXT_QUERY` is supplied without a
location, search `docs/`. Default `COMMIT_STYLE` to the repository's
existing style; if the repo has no clear pattern, use Conventional Commits.

## Workflow Overview

| Phase | Purpose | Gate |
| ----- | ------- | ---- |
| Intake | Normalize paths, context query, and commit style | Required path scope is known |
| State inspection | Inspect working tree, diffs, untracked files, and recent commit style | Scoped changes are understood |
| Context lookup | Read local docs matching the context query | Intent is grounded or a question is asked |
| Boundary planning | Split scoped changes into atomic commit groups | Each group has one clear reason |
| Commit loop | Stage, review, verify, and commit one group at a time | Staged diff matches the planned group |
| Report | Return commit messages, summaries, and checks run | User can review the result |

## Reference Routing

Fetch these references only when they would change the next decision:

| Reference | URL | Use when |
| --------- | --- | -------- |
| Commit workflow skill | https://skills.sh/softaworks/agent-toolkit/commit-work | You need the detailed staging, review, or deliverable checklist |
| Conventional Commits | https://www.conventionalcommits.org/en/v1.0.0/ | Commit type, scope, breaking-change syntax, or message format is unclear |
| Atomic commits | https://www.aleksandrhovhannisyan.com/blog/atomic-git-commits/ | The diff is broad or mixed and commit boundaries need justification |

## How This Skill Works

The scoped diff and local context are the source of truth. `CHANGE_PATHS` defines
the commit boundary: include changes inside those paths, and ask before expanding
or excluding anything material. `CONTEXT_QUERY` explains why the changes exist;
use it to avoid guessing intent from code shape alone.

Commit groups should be independently reviewable and revertable. A good group can
be summarized with one specific message. If a group needs two unrelated reasons,
split it. If two file changes only make sense together, keep them together.

Use the runtime's user-question tool when scope, intent, or safety is unclear.
Ask the smallest question that unblocks the next commit decision.

## Execution Steps

### 1. Normalize Inputs

Confirm the exact `CHANGE_PATHS`. Resolve placeholders before touching git state.
If a path does not exist but may be an untracked file, verify it through the
working tree inspection phase.

### 2. Inspect State

Inspect repository status, scoped diffs, untracked files under `CHANGE_PATHS`,
and recent commit messages. Ignore unrelated changes outside the requested path
scope unless they directly affect safe staging.

### 3. Read Context

When `CONTEXT_QUERY` is provided, search `CONTEXT_LOCATION` for matching files and
read only the relevant sections. If no matching context exists and the commit
intent is not obvious from the diff, ask before committing.

### 4. Plan Atomic Commit Groups

Group changes by reviewer-facing intent: feature vs. fix, production code vs.
tests, data/config vs. behavior, or mechanical cleanup vs. logic. Keep dependent
changes together when separating them would create a broken intermediate state.

Before committing, be able to state for each group:

- The paths or hunks included
- The user-visible or reviewer-visible reason
- The proposed commit message
- The smallest meaningful verification

### 5. Commit One Group at a Time

For each group:

1. Stage only the files or hunks belonging to that group.
2. Review the staged diff against the plan.
3. Run the smallest relevant verification, using `VERIFICATION_HINT` when given.
4. Commit with the chosen style.
5. Reinspect state before starting the next group.

If staged content no longer matches the plan, unstage or adjust the group before
committing. If verification fails, fix or ask before committing based on whether
the fix is clearly inside the requested scope.

## Output Contract

On success, report:

```text
Commits created:
- <sha> <message>
  Summary: <what changed and why>
  Verification: <check run or "not run: reason">

Remaining scoped changes: <none or concise list>
Unrelated changes left untouched: <none or concise list>
```

When blocked, report:

```text
COMMIT_SCOPED_CHANGES: BLOCKED | NEEDS_CONTEXT | VERIFY_FAILED
Reason: <one line>
Next step: <one clear action or question>
```

## Example

Input:

- `CHANGE_PATHS`: `src/checkout/`, `tests/checkout/`
- `CONTEXT_QUERY`: `JNS-6880`
- `COMMIT_STYLE`: `Conventional Commits`

Flow:

1. Inspect status and scoped diffs under checkout paths.
2. Read matching `JNS-6880` docs from `docs/`.
3. Split a retry behavior fix from the related tests if each has a clear reason,
   or keep them together if the tests only verify that fix.
4. Commit each approved group and report messages plus verification.
