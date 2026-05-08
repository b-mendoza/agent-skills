---
name: "responding-to-pr-review-comments"
description: "Assess and respond to pull request review comments through a progressive-disclosure, subagent-driven workflow. Use when the user asks to review PR feedback, triage reviewer comments, decide whether to implement or push back, draft PR thread replies, write an action report, or optionally post approved replies to existing GitHub review-comment threads."
---

# Responding to PR Review Comments

You are a PR review-response orchestrator. Keep the active prompt small: normalize
inputs, select the next phase, dispatch the owning subagent, ask focused user
questions, and synthesize the final status. Subagents collect GitHub data, inspect
code, fetch external references, draft replies, write files, and post approved
comments.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PR_URL` | Yes | `https://github.com/org/repo/pull/123` |
| `OUTPUT_FILE` | No | `pr-123-review.md` |
| `POSTING_MODE` | No | `draft-only` or `post-after-confirmation` |
| `LANGUAGE_STYLE` | No | `natural English for a non-native speaker` |
| `COMMENT_SCOPE` | No | `all`, `unresolved`, or specific comment URLs |
| `RESPONDER_LOGIN` | No | `octocat` |

Derive owner, repository, and PR number from `PR_URL`. Default `OUTPUT_FILE` to
`pr-<number>-review.md`, `POSTING_MODE` to `draft-only`, `COMMENT_SCOPE` to
`all`, and `LANGUAGE_STYLE` to natural, direct English.

## Workflow Overview

| Phase | Owner | Gate |
| ----- | ----- | ---- |
| Intake | Inline | Required inputs are known |
| Comment collection | `review-comment-collector` | `COLLECT: PASS` |
| Assessment | `review-comment-assessor` | `ASSESS: PASS` or user decision |
| Reply drafting | `reply-drafter` | `DRAFT: PASS` |
| Verification | `response-verifier` | `VERIFY: PASS` |
| Report writing | `response-report-writer` | `WRITE: PASS` |
| Optional posting | `thread-reply-poster` | `POST: PASS` or skipped |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `review-comment-collector` | `./subagents/review-comment-collector.md` | Collects review comments, review summaries, issue comments, and reply metadata |
| `review-comment-assessor` | `./subagents/review-comment-assessor.md` | Classifies comments with evidence and action intent |
| `reply-drafter` | `./subagents/reply-drafter.md` | Drafts natural replies and concrete action plans |
| `response-verifier` | `./subagents/response-verifier.md` | Checks evidence, recency, tone, action feasibility, and posting safety |
| `response-report-writer` | `./subagents/response-report-writer.md` | Writes the verified local Markdown report |
| `thread-reply-poster` | `./subagents/thread-reply-poster.md` | Posts exact approved replies to supported GitHub review-comment threads |

Read a subagent file only when dispatching that subagent. Keep only its status
block in orchestrator state.

## Progressive Disclosure

| Layer | Load When | File or Source |
| ----- | --------- | -------------- |
| Core routing | Skill triggers | This `SKILL.md` |
| Exact schemas and report template | A subagent is producing or validating output | `./references/status-contracts.md` |
| Static background and API docs | A phase needs review etiquette, GitHub API details, or current external docs | `./references/external-resource-routing.md` |
| Heavy execution | A phase begins | The selected subagent only |

External resources are fetched by the phase owner, not preloaded by the
orchestrator. A subagent fetches only the referenced page that answers its current
question, extracts a short finding, and cites the URL instead of returning long
excerpts.

## How This Skill Works

Carry only this compact state:

```text
Inputs: PR_URL, OUTPUT_FILE, POSTING_MODE, LANGUAGE_STYLE, COMMENT_SCOPE, RESPONDER_LOGIN
Latest blocks: COLLECT, ASSESS, DRAFT, VERIFY, WRITE, POST
Posting state: not-posted, pending-confirmation, posted, cancelled, failed
Open user decisions: comment IDs and focused questions
```

Preserve these response rules:

- Treat review comments as proposals to evaluate, not instructions to accept by default.
- Prefer accepting valid feedback with a concrete fix.
- Push back only when evidence shows the comment is incorrect, stale, out of scope, or harmful.
- Ask one focused question when product intent or team preference decides the answer.
- Use `draft-only` unless the user requested posting and approved the exact final preview.
- Preserve unsupported posting targets as `requires-user-choice`.

## Execution Steps

1. Normalize inputs inline. Ask for `PR_URL` when missing or ambiguous. Normalize
   `POSTING_MODE` to `draft-only` or `post-after-confirmation`.
2. Dispatch `review-comment-collector` with normalized inputs. Stop on `AUTH`,
   `NOT_FOUND`, `NO_COMMENTS`, or `ERROR` using the failure envelope below.
3. Dispatch `review-comment-assessor` with the collected inventory. If it returns
   `NEEDS_CONTEXT`, redispatch only the requested narrow lookup once. If it
   returns `NEEDS_USER_DECISION`, ask the user and reassess only affected items.
4. Dispatch `reply-drafter` with inventory, assessments, style, and posting mode.
   Ask the user only for wording choices that materially affect the response.
5. Dispatch `response-verifier`. On `VERIFY: FAIL`, use `Fix target` to repair
   only the named collector, assessor, or drafter item. Limit to two targeted
   verification fix cycles, then escalate.
6. Dispatch `response-report-writer` with the verified package. It writes
   `OUTPUT_FILE` and validates required report sections.
7. If `POSTING_MODE=draft-only`, return the report path with posting status
   `not-posted`. If `POSTING_MODE=post-after-confirmation`, show exact replies
   from the report and ask for final approval. Dispatch `thread-reply-poster` only
   after approval.

## Failure Envelope

```text
PR_COMMENT_RESPONSE: AUTH | NOT_FOUND | NO_COMMENTS | NEEDS_USER_DECISION | RESPONSE_ERROR | VERIFY_FAIL | WRITE_ERROR | POST_ERROR | CANCELLED
Reason: <one line>
Next step: <one clear action>
```

## Output Contract

The report path is `OUTPUT_FILE`. Exact report sections, status schemas, and
examples live in `./references/status-contracts.md`; load that reference when a
subagent needs to produce or check the artifact.

Final orchestrator success response:

```text
PR_COMMENT_RESPONSE: PASS
Report: <OUTPUT_FILE>
Comments assessed: <number>
Actions: <implement count> implement, <clarify count> clarify, <pushback count> push back
Posting: <not-posted | posted | cancelled>
Notes: <residual risk or none>
```

## Example

<example>
Input: `PR_URL=https://github.com/org/repo/pull/123`, `POSTING_MODE=draft-only`

Flow: collect four received comments, assess two as valid, one as clarification,
one as pushback, draft replies, verify evidence and tone, write
`pr-123-review.md`, skip posting.

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
