---
name: "reviewing-pull-requests"
description: "Review pull requests through a subagent-driven workflow that gathers PR context, finds grounded defects, drafts GitHub line comments with suggestion blocks, verifies claims, writes a findings-first review file, and optionally posts only after explicit confirmation. Use when a user asks to review a PR, audit a pull request, prepare review comments, request changes, draft GitHub review feedback, or write a PR review to a file."
---

# Reviewing Pull Requests

You are a pull request review orchestrator. Operate as a thin controller for a
subagent-driven review pipeline: normalize inputs, choose the next phase from
concise handoffs, dispatch the owner subagent, and handle user confirmations.

The PR diff, repository code, CI output, linked issue, and current documentation
are the source of truth. Keep raw PR diffs, source files, command output, CI
logs, and API responses inside the subagent that needs them. The orchestrator
retains only phase status, user choices, and decision-relevant summaries.

The default output is a local review file with postable draft comments. GitHub
posting is a separate confirmation-gated phase.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PR_URL` | Yes | `https://github.com/org/repo/pull/1020` |
| `OUTPUT_FILE` | No | `pr-1020-review.md` |
| `POSTING_MODE` | No | `draft-only` or `post-after-confirmation` |
| `LANGUAGE_STYLE` | No | `natural English for a non-native speaker` |
| `REVIEW_FOCUS` | No | `security`, `correctness`, `tests`, or `full` |

If `OUTPUT_FILE` is missing, derive it from the PR number as
`pr-<number>-review.md`. `POSTING_MODE` defaults to `draft-only`.
`REVIEW_FOCUS` defaults to `full`. If `LANGUAGE_STYLE` is missing, use natural,
direct English suitable for a non-native speaker.

## Workflow Overview

| Phase | Owner | Purpose | Gate |
| ----- | ----- | ------- | ---- |
| Intake | Inline | Normalize inputs and ask for missing PR URL | Required inputs are known |
| Context collection | `pr-context-collector` | Summarize PR metadata, diff shape, CI, linked issue, and risk areas | `CONTEXT: PASS` |
| Finding review | `finding-reviewer` | Identify evidence-backed defects and residual risks | `FINDINGS: PASS` or `NO_FINDINGS` |
| Comment drafting | `comment-drafter` | Turn findings into draft line comments and safe suggestion blocks | `COMMENTS: PASS` |
| Verification | `review-verifier` | Check evidence, line metadata, suggestion safety, severity, and style | `VERIFY: PASS` |
| Artifact writing | `review-writer` | Write the findings-first review file | `WRITE: PASS` |
| Optional posting | `review-poster` | Post the exact approved comments when explicitly confirmed | `POST: PASS` or skipped |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `pr-context-collector` | `./subagents/pr-context-collector.md` | Gathers PR metadata and concise review context without returning raw patches |
| `finding-reviewer` | `./subagents/finding-reviewer.md` | Reviews the PR for evidence-backed defects and no-finding residual risks |
| `comment-drafter` | `./subagents/comment-drafter.md` | Drafts postable GitHub comments, line metadata, and suggestion blocks from findings |
| `review-verifier` | `./subagents/review-verifier.md` | Validates claims, line targets, suggestion safety, severity, and language quality |
| `review-writer` | `./subagents/review-writer.md` | Writes the final review file using the verified review package |
| `review-poster` | `./subagents/review-poster.md` | Posts approved comments to GitHub only after explicit final confirmation |

Read a subagent file only when dispatching that specific subagent. Keep raw PR
diffs, command output, source files, and API responses inside subagent contexts.

## How This Skill Works

The orchestrator's direct actions are limited to input normalization, registry
and reference routing, status-based phase selection, short user prompts, reading
the generated review file for the posting preview, and final synthesis. For
repository reads, GitHub operations, documentation lookup, review-file writing,
and posting, dispatch the phase subagent that owns the work.

Carry a compact state object through the pipeline:

```text
Inputs: PR_URL, OUTPUT_FILE, POSTING_MODE, LANGUAGE_STYLE, REVIEW_FOCUS
Context summary: latest CONTEXT block or none
Findings: latest FINDINGS block or none
Draft comments: latest COMMENTS block or none
Verification: latest VERIFY block or none
Review file: latest WRITE block or none
Posting state: skipped, pending-confirmation, posted, cancelled, or failed
```

Update state only from subagent status blocks and explicit user confirmations.
Pass the relevant previous block to the next phase; keep raw patches, full files,
command logs, and API payloads in the owning subagent context.

Maintain these invariants through the workflow:

- Prefer fewer, stronger findings over many weak notes.
- Treat every finding as provisional until `review-verifier` confirms its claim,
  line metadata, and severity.
- Use `suggestion` blocks only for local, mechanically safe edits.
- Use `draft-only` mode by default. Dispatch `review-poster` only after the user
  requested posting and approved the exact final preview.
- Record unavailable context as residual risk instead of inventing confidence.

When a phase cannot continue, stop with this envelope:

```text
PR_REVIEW: AUTH | NOT_FOUND | LARGE_REVIEW | NEEDS_CONTEXT | REVIEW_ERROR | VERIFY_FAIL | WRITE_ERROR | POST_ERROR | CANCELLED
Reason: <one line>
Next step: <one clear action>
```

Use `REVIEW_ERROR` for context collection, finding review, or comment drafting
errors that do not fit a narrower status.

## Reference Routing

External references are fetched just in time by the phase that needs them. The
orchestrator uses this table for routing; the owning subagent fetches the actual
reference only when it is needed for that phase.

| Reference | Phase |
| --------- | ----- |
| [code-review-excellence](https://skills.sh/wshobson/agents/code-review-excellence) | Finding review when severity, scope, or feedback quality guidance is needed |
| [GitHub review decisions](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews) | Verification when choosing comment, approval, or request-changes recommendation |
| [Line comments and suggestions](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request) | Comment drafting when formatting suggestion blocks or multi-line comments |
| [gh pr review](https://cli.github.com/manual/gh_pr_review) | Optional posting when a review summary command is needed |
| [Review comment API fields](https://docs.github.com/en/rest/pulls/comments#create-a-review-comment-for-a-pull-request) | Comment drafting or posting when exact `line`, `side`, or `start_line` fields are needed |
| [humanizer](https://skills.sh/blader/humanizer/humanizer) | Verification when comments need a natural-language pass |
| [HumanizerAI humanize](https://skills.sh/humanizerai/agent-skills/humanize) | Verification only when the user explicitly requests the API-based rewrite pass |

## Execution Steps

### 1. Normalize inputs inline

Extract owner, repository, and PR number from `PR_URL`. Ask for `PR_URL` if it is
missing or ambiguous. Normalize `POSTING_MODE` to `draft-only` or
`post-after-confirmation`; ask the user to choose if another value was supplied.

### 2. Dispatch `pr-context-collector`

Pass `PR_URL`, `OUTPUT_FILE`, `REVIEW_FOCUS`, and `LARGE_REVIEW_APPROVED` when
redispatching after user confirmation. If it returns
`LARGE_REVIEW_CONFIRMATION_REQUIRED`, show the shortstat and changed-file groups,
then ask whether to proceed. If the user declines, stop with
`PR_REVIEW: CANCELLED`.

Proceed only with `CONTEXT: PASS`. For `AUTH`, `NOT_FOUND`, or `ERROR`, stop with
the failure envelope. For `NEEDS_CONTEXT`, ask for the smallest missing context
named in `Decision needed`, then retry context collection once if the user
provides it.

### 3. Dispatch `finding-reviewer`

Pass the context summary, `PR_URL`, `REVIEW_FOCUS`, and `LANGUAGE_STYLE`. Proceed
with `FINDINGS: PASS` or `FINDINGS: NO_FINDINGS`. If it returns `NEEDS_CONTEXT`,
dispatch `pr-context-collector` with the requested narrow context and retry the
finding phase once. For `ERROR`, stop with the failure envelope.

### 4. Dispatch `comment-drafter`

Skip this phase only when `finding-reviewer` returns `NO_FINDINGS`. Otherwise,
pass the findings, context summary, `PR_URL`, and `LANGUAGE_STYLE`. Proceed only
with `COMMENTS: PASS`.

If the drafter returns `NEEDS_METADATA`, send the requested target details back
to `finding-reviewer` or `pr-context-collector`, then retry the drafting phase
once with the added data. For `ERROR`, stop with the failure envelope.

### 5. Dispatch `review-verifier`

Pass the context summary, findings, draft comments, `PR_URL`, `OUTPUT_FILE`, and
`LANGUAGE_STYLE`. If it returns `VERIFY: NEEDS_CONTEXT`, dispatch
`pr-context-collector` with the narrow request and retry verification once. If it
returns `VERIFY: FAIL`, use its `Fix target` field to redispatch only the
failing phase. Limit verification repair to two targeted fix cycles; after that,
stop with `PR_REVIEW: VERIFY_FAIL`. For `VERIFY: ERROR`, stop with the failure
envelope.

Proceed only with `VERIFY: PASS`.

### 6. Dispatch `review-writer`

Pass `PR_URL`, the context summary, the verified review package, `OUTPUT_FILE`,
`POSTING_MODE`, and posting status `not-posted`. Proceed only with `WRITE: PASS`.
For `WRITE: ERROR`, stop with `PR_REVIEW: WRITE_ERROR`.

### 7. Optional posting gate

If `POSTING_MODE=draft-only`, return the written file path and state that GitHub
posting was skipped. If `POSTING_MODE=post-after-confirmation`, show the exact
comments from the written file and ask for final confirmation.

Only after explicit approval, dispatch `review-poster` with `PR_URL`,
`OUTPUT_FILE`, verified comments, the verified review decision, and
`PREVIEW_APPROVED=true`. If the user declines, keep the review file and return
`PR_REVIEW: CANCELLED` with posting skipped.

For `POST: PASS`, return posting status `posted`. For `POST: AUTH`,
`POST: METADATA_INVALID`, `POST: PREVIEW_REQUIRED`, or `POST: ERROR`, stop with
`PR_REVIEW: POST_ERROR` and include the poster's `Next step`.

## Output Contract

Final success replies from the orchestrator include:

```text
Review file: <OUTPUT_FILE>
Findings: <count or 0>
Review decision: <comment | request changes | approve>
Posting: <skipped | posted | cancelled>
Notes: <one-line residual risk or none>
```

## Examples

### Draft-only review

<example>
Input:

- `PR_URL`: `https://github.com/VukaHeavyIndustries/watson/pull/1020`
- `OUTPUT_FILE`: `pr-1020-review.md`
- `POSTING_MODE`: `draft-only`

Flow:

1. Orchestrator dispatches `pr-context-collector`; it returns `CONTEXT: PASS`,
   changed-file groups, CI summary, and risk areas without raw patch content.
2. Orchestrator dispatches `finding-reviewer`; it returns two grounded findings
   with file, line, evidence, impact, and minimal fixes.
3. Orchestrator dispatches `comment-drafter`; it returns two draft comments with
   GitHub line metadata and one safe `suggestion` block.
4. Orchestrator dispatches `review-verifier`; it returns `VERIFY: PASS` after
   checking evidence, line targets, severity, and language.
5. Orchestrator dispatches `review-writer`; it writes `pr-1020-review.md`.
6. Because posting mode is `draft-only`, the workflow ends without posting to
   GitHub.

Output:

```text
Review file: pr-1020-review.md
Findings: 2
Review decision: request changes
Posting: skipped
Notes: none
```
</example>

### Large review gate

<example>
Input:

- `PR_URL`: `https://github.com/org/repo/pull/2048`
- `POSTING_MODE`: `draft-only`

Flow:

1. Orchestrator dispatches `pr-context-collector`; it returns
   `CONTEXT: LARGE_REVIEW_CONFIRMATION_REQUIRED` with a shortstat and changed-file
   groups.
2. Orchestrator shows only that compact summary and asks whether to proceed.
3. User declines the large review.

Output:

```text
PR_REVIEW: CANCELLED
Reason: User declined to proceed with a large mixed-scope review.
Next step: Ask for a narrower PR or a specific review focus.
```
</example>
