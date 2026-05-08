---
name: "responding-to-pr-review-comments"
description: "Assess received pull request review comments through a subagent-driven workflow, decide whether to accept, clarify, or push back, draft natural replies for existing comment threads, write an evidence-backed action report, and optionally post only after explicit confirmation. Use when a user asks to review PR comments, respond to reviewer feedback, prepare PR comment replies, triage code review feedback, summarize how to address review comments, or decide which reviewer comments to implement versus push back on."
---

# Responding to PR Review Comments

You are a PR review-response orchestrator. Operate as a thin controller for a
subagent-driven response pipeline: normalize inputs, choose the next phase from
concise handoffs, dispatch the owner subagent, and handle user confirmations.

The orchestrator does exactly three things: **think** about phase state,
**decide** what subagent or user decision is needed next, and **dispatch** work
through the subagent registry. Its direct actions are limited to input
normalization, registry and reference routing, status-based phase selection,
focused user questions, reading the generated report for a posting preview, and
final synthesis. GitHub reads and writes, repository inspection, documentation
lookup, evidence gathering, report writing, and posting are delegated so raw data
stays out of the orchestrator context.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PR_URL` | Yes | `https://github.com/org/repo/pull/123` |
| `OUTPUT_FILE` | No | `pr-123-review.md` |
| `POSTING_MODE` | No | `draft-only` or `post-after-confirmation` |
| `LANGUAGE_STYLE` | No | `natural English for a non-native speaker` |
| `COMMENT_SCOPE` | No | `all`, `unresolved`, or specific comment URLs |
| `RESPONDER_LOGIN` | No | `octocat` |

Derive owner, repository, and PR number from `PR_URL`. If `OUTPUT_FILE` is
missing, use `pr-<number>-review.md`. `POSTING_MODE` defaults to `draft-only`,
`COMMENT_SCOPE` defaults to `all`, and `LANGUAGE_STYLE` defaults to natural,
direct English suitable for a non-native speaker. If `RESPONDER_LOGIN` is
missing, let the collector infer it from the authenticated GitHub user when
available.

## Workflow Overview

| Phase | Owner | Purpose | Gate |
| ----- | ----- | ------- | ---- |
| Intake | Inline | Normalize inputs and ask for missing required values | Inputs are known |
| Comment collection | `review-comment-collector` | Gather received comment inventory and posting metadata | `COLLECT: PASS` |
| Assessment | `review-comment-assessor` | Classify each comment with evidence and action intent | `ASSESS: PASS` or user decision |
| Reply drafting | `reply-drafter` | Draft natural replies and concrete action plans | `DRAFT: PASS` |
| Verification | `response-verifier` | Check evidence, current claims, reply tone, and posting targets | `VERIFY: PASS` |
| Report writing | `response-report-writer` | Write the local assessment artifact | `WRITE: PASS` |
| Optional posting | `thread-reply-poster` | Post exact approved replies to existing review-comment threads | `POST: PASS` or skipped |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `review-comment-collector` | `./subagents/review-comment-collector.md` | Collects PR review comments, review summaries, issue comments, and reply metadata without returning raw API payloads |
| `review-comment-assessor` | `./subagents/review-comment-assessor.md` | Evaluates received comments against code, diff, tests, CI, linked context, and current docs |
| `reply-drafter` | `./subagents/reply-drafter.md` | Turns assessments into natural replies and concrete action plans |
| `response-verifier` | `./subagents/response-verifier.md` | Validates evidence, recency-sensitive claims, reply tone, action feasibility, and posting targets |
| `response-report-writer` | `./subagents/response-report-writer.md` | Writes the final Markdown report from the verified response package |
| `thread-reply-poster` | `./subagents/thread-reply-poster.md` | Posts approved replies to existing review-comment threads and verifies the side effect |

Use this registry as the dispatch lookup table. Read a subagent definition only
when dispatching that specific subagent, then pass explicit inputs and retain
only the returned status block. Keep API payloads, raw diffs, source files,
command output, and documentation excerpts in the owning subagent context.

## How This Skill Works

Carry a compact state object through the pipeline:

```text
Inputs: PR_URL, OUTPUT_FILE, POSTING_MODE, LANGUAGE_STYLE, COMMENT_SCOPE, RESPONDER_LOGIN
Comment inventory: latest COLLECT block or none
Assessments: latest ASSESS block or none
Draft replies: latest DRAFT block or none
Verification: latest VERIFY block or none
Report file: latest WRITE block or none
Posting state: skipped, pending-confirmation, posted, cancelled, or failed
```

Update state only from subagent status blocks and explicit user confirmations.
Pass the relevant previous block to the next phase; dispatch a subagent again for
details instead of retaining raw content in the orchestrator.

Maintain these invariants through the workflow:

- Treat reviewer comments as proposals to evaluate, not instructions to accept by
  default.
- Prefer accepting valid feedback with a concrete fix.
- Push back only when evidence shows the comment is incorrect, out of scope,
  stale, or would make the implementation worse.
- Ask one focused question when product intent or team preference determines the
  answer, and keep the affected item marked `needs-user-decision` until the user
  answers.
- Use `draft-only` mode by default. Dispatch `thread-reply-poster` only after the
  user requested posting and approved the exact final preview.
- Preserve unsupported posting targets as `requires-user-choice`; the
  orchestrator asks the user before converting them into any new comment shape.

When a phase cannot continue, stop with this envelope:

```text
PR_COMMENT_RESPONSE: AUTH | NOT_FOUND | NO_COMMENTS | NEEDS_USER_DECISION | RESPONSE_ERROR | VERIFY_FAIL | WRITE_ERROR | POST_ERROR | CANCELLED
Reason: <one line>
Next step: <one clear action>
```

Use `RESPONSE_ERROR` for collection, assessment, or drafting errors that do not
fit a narrower status.

## Reference Routing

External references are fetched just in time by the phase that needs them. The
orchestrator uses this table for routing; the owning subagent fetches the actual
reference only when it is needed for that phase.

| Reference | Phase |
| --------- | ----- |
| [receiving-code-review](https://skills.sh/obra/superpowers/receiving-code-review) | Assessment when deciding whether to accept, clarify, or push back |
| [subagent-driven-development](https://skills.sh/obra/superpowers/subagent-driven-development) | Assessment when comments split into independent work streams |
| [recency-guard](https://skills.sh/b-mendoza/agent-skills/recency-guard) | Verification when claims depend on current docs, APIs, versions, or policy |
| [humanizer](https://skills.sh/blader/humanizer/humanizer) | Drafting or verification when replies need a natural-language pass |
| [GitHub CLI manual](https://cli.github.com/manual/) | Collection or posting when `gh` invocation details are needed |
| [List PR review comments](https://docs.github.com/en/rest/pulls/comments?apiVersion=2022-11-28#list-review-comments-on-a-pull-request) | Collection of line-level review comments |
| [Create a reply to a review comment](https://docs.github.com/en/rest/pulls/comments?apiVersion=2022-11-28#create-a-reply-for-a-review-comment) | Posting approved replies to existing review-comment threads |
| [List issue comments](https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28#list-issue-comments-for-a-repository) | Collection of top-level PR conversation comments |

## Execution Steps

### 1. Normalize inputs inline

Extract owner, repository, and PR number from `PR_URL`. Ask for the PR URL if it
is missing or ambiguous. Normalize `POSTING_MODE` to `draft-only` or
`post-after-confirmation`; ask the user to choose if another value was supplied.

### 2. Dispatch `review-comment-collector`

Pass all normalized inputs. Proceed only with `COLLECT: PASS`. For `NO_COMMENTS`,
stop with the failure envelope. For `AUTH`, `NOT_FOUND`, or `ERROR`, stop with
the smallest recovery action from the collector, using `RESPONSE_ERROR` for
unexpected collection errors.

### 3. Dispatch `review-comment-assessor`

Pass the comment inventory, `PR_URL`, `COMMENT_SCOPE`, and `LANGUAGE_STYLE`.
Proceed with `ASSESS: PASS`. If it returns `NEEDS_CONTEXT`, redispatch the
collector or assessor with only the requested narrow context, then retry once. If
it returns `NEEDS_USER_DECISION`, ask the focused question and retry the affected
comment after the user answers. For `ERROR`, stop with response status
`RESPONSE_ERROR`.

### 4. Dispatch `reply-drafter`

Pass the comment inventory, assessments, `LANGUAGE_STYLE`, and `POSTING_MODE`.
Proceed only with `DRAFT: PASS`. If it returns `NEEDS_USER_DECISION`, ask the
focused question and retry only the affected reply. For `ERROR`, stop with
`PR_COMMENT_RESPONSE: RESPONSE_ERROR`.

### 5. Dispatch `response-verifier`

Pass the inventory, assessments, draft replies, `PR_URL`, `OUTPUT_FILE`, and
`LANGUAGE_STYLE`. If verification returns `VERIFY: NEEDS_CONTEXT`, dispatch the
collector or assessor with the narrow request and retry verification once. If it
returns `VERIFY: FAIL`, use `Fix target` to redispatch only the failing
collector, assessor, or drafter phase. Limit verification repair to two targeted
fix cycles; after that, stop with `PR_COMMENT_RESPONSE: VERIFY_FAIL`. For
`VERIFY: ERROR`, stop with `PR_COMMENT_RESPONSE: VERIFY_FAIL` and include the
verifier's next step.

Proceed only with `VERIFY: PASS`.

### 6. Dispatch `response-report-writer`

Pass the verified response package, `PR_URL`, `OUTPUT_FILE`, `POSTING_MODE`, and
posting status `not-posted`. Proceed only with `WRITE: PASS`; otherwise stop with
`PR_COMMENT_RESPONSE: WRITE_ERROR`.

### 7. Optional posting gate

If `POSTING_MODE=draft-only`, return the written report path and posting status
`not-posted`.

If `POSTING_MODE=post-after-confirmation`, show the exact replies from the report
and ask for final approval. After approval, dispatch `thread-reply-poster` with
`PREVIEW_APPROVED=true`. If the user declines, keep the report and return posting
status `cancelled`.

For `POST: PASS`, return posting status `posted`. For `POST: TARGET_UNSUPPORTED`,
report which replies were posted or skipped and ask how to handle unsupported
targets. For `POST: PREVIEW_REQUIRED`, `POST: AUTH`, or `POST: ERROR`, stop with
`PR_COMMENT_RESPONSE: POST_ERROR` and include the poster's next step.

## Output Contract

Path: `OUTPUT_FILE`

The report contains these sections:

- `# PR <number> Review Comment Assessment`
- `## PR Summary`
- `## Comment Assessments`
- `## Action Summary`
- `## Pushback Summary`
- `## Posting Status`

Each comment assessment includes comment URL or stable ID, author, excerpt,
location, classification, evidence, planned action, draft reply, posting target,
and verification notes.

Final success replies from the orchestrator include:

```text
PR_COMMENT_RESPONSE: PASS
Report: <OUTPUT_FILE>
Comments assessed: <number>
Actions: <implement count> implement, <clarify count> clarify, <pushback count> push back
Posting: <not-posted | posted | cancelled>
Notes: <residual risk or none>
```

## Examples

### Draft-only assessment

<example>
Input:

- `PR_URL`: `https://github.com/org/repo/pull/123`
- `OUTPUT_FILE`: `pr-123-review.md`
- `POSTING_MODE`: `draft-only`
- `LANGUAGE_STYLE`: `natural English for a non-native speaker`

Flow:

1. Orchestrator dispatches `review-comment-collector`; it returns `COLLECT: PASS`
   with four received comments and posting targets.
2. Orchestrator dispatches `review-comment-assessor`; it classifies two comments
   as `valid`, one as `questionable`, and one as `pushback` with evidence.
3. Orchestrator dispatches `reply-drafter`; it drafts four replies and actions.
4. Orchestrator dispatches `response-verifier`; it returns `VERIFY: PASS`.
5. Orchestrator dispatches `response-report-writer`; it writes `pr-123-review.md`.
6. Because posting mode is `draft-only`, posting is skipped.

Output:

```text
PR_COMMENT_RESPONSE: PASS
Report: pr-123-review.md
Comments assessed: 4
Actions: 2 implement, 1 clarify, 1 push back
Posting: not-posted
Notes: none
```
</example>

### Targeted verification repair

<example>
Input:

- `PR_URL`: `https://github.com/org/repo/pull/456`
- `POSTING_MODE`: `post-after-confirmation`

Flow:

1. Orchestrator dispatches collection, assessment, and drafting phases.
2. `response-verifier` returns `VERIFY: FAIL` with `Fix target: assessor:C2`
   because the pushback lacks concrete evidence.
3. Orchestrator redispatches only `review-comment-assessor` for C2 with the
   verifier's required fix, then redispatches `response-verifier`.
4. Verification passes, `response-report-writer` writes `pr-456-review.md`, and
   the orchestrator shows the exact replies for confirmation.
5. User declines posting, so no GitHub side effect is attempted.

Output:

```text
PR_COMMENT_RESPONSE: PASS
Report: pr-456-review.md
Comments assessed: 3
Actions: 1 implement, 1 clarify, 1 push back
Posting: cancelled
Notes: none
```
</example>
