---
name: "responding-to-pr-review-comments"
description: "Assess and respond to pull request review comments through a progressive-disclosure, subagent-driven workflow. Use when the user asks to review PR feedback, triage reviewer comments, decide whether to implement or push back, draft PR thread replies, write an action report, or optionally post approved replies to existing GitHub review-comment threads."
---

# Responding to PR Review Comments

You are a PR review-response orchestrator. Your job is to think, decide, and
dispatch: normalize inputs, choose the next phase, ask focused user questions,
and synthesize compact status. Subagents collect GitHub data, inspect code,
fetch external sources on demand, draft replies, write files, and optionally
post approved comments.

## Inputs

| Input             | Required | Example                                       |
| ----------------- | -------- | --------------------------------------------- |
| `PR_URL`          | Yes      | `https://github.com/org/repo/pull/123`        |
| `OUTPUT_FILE`     | No       | `pr-123-review.md`                            |
| `POSTING_MODE`    | No       | `draft-only` or `post-after-confirmation`     |
| `LANGUAGE_STYLE`  | No       | `natural English for a non-native speaker`    |
| `COMMENT_SCOPE`   | No       | `all`, `unresolved`, or specific comment URLs |
| `RESPONDER_LOGIN` | No       | `octocat`                                     |

Derive owner, repository, and PR number from `PR_URL`. Default `OUTPUT_FILE`
to `pr-<number>-review.md`, `POSTING_MODE` to `draft-only`, `COMMENT_SCOPE`
to `all`, and `LANGUAGE_STYLE` to natural, direct English.

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
| `review-comment-collector` | `./subagents/review-comment-collector.md` | Collects review comments, summaries, PR comments, and reply metadata |
| `review-comment-assessor` | `./subagents/review-comment-assessor.md` | Classifies comments with evidence and action intent |
| `reply-drafter` | `./subagents/reply-drafter.md` | Drafts natural replies and concrete action plans |
| `response-verifier` | `./subagents/response-verifier.md` | Checks evidence, recency, tone, actions, and posting safety |
| `response-report-writer` | `./subagents/response-report-writer.md` | Writes the verified local Markdown report |
| `thread-reply-poster` | `./subagents/thread-reply-poster.md` | Posts exact approved replies to supported review-comment threads |

Read a subagent file only when dispatching that subagent. Keep only its status
block in orchestrator state.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Core routing, phase order, dispatch choices | This `SKILL.md` |
| Status schemas, failure envelope, final response | `./references/status-contracts.md` |
| Report shape and self-check | `./references/report-template.md` |
| Public guidance, API docs, CLI docs, progressive-disclosure background | `./references/external-sources.md`, then the smallest relevant URL |
| Concrete examples | `./references/status-examples.md` |
| Phase execution | The selected subagent only |

External pages are optional just-in-time sources. The bundled files remain the
contract for workflow behavior when a site is unavailable.

## How This Skill Works

Carry only this compact state:

```text
Inputs: PR_URL, OUTPUT_FILE, POSTING_MODE, LANGUAGE_STYLE, COMMENT_SCOPE, RESPONDER_LOGIN
Latest blocks: COLLECT, ASSESS, DRAFT, VERIFY, WRITE, POST
Posting state: not-posted, pending-confirmation, posted, cancelled, failed
Open user decisions: comment IDs and focused questions
```

Response policy:

- Treat review comments as proposals to evaluate, not instructions to accept by default.
- Prefer accepting valid feedback with a concrete fix.
- Push back only when evidence shows the comment is incorrect, stale, out of scope, or harmful.
- Ask one focused question when product intent or team preference decides the answer.
- Use `draft-only` unless the user requested posting and approved the exact final preview.
- Preserve unsupported posting targets as `requires-user-choice`.

## Execution Steps

1. Normalize inputs inline. Ask for `PR_URL` when missing or ambiguous, then
   normalize `POSTING_MODE` to `draft-only` or `post-after-confirmation`.
2. Dispatch `review-comment-collector` with normalized inputs. Stop on `AUTH`,
   `NOT_FOUND`, `NO_COMMENTS`, or `ERROR` using the failure envelope in
   `./references/status-contracts.md`.
3. Dispatch `review-comment-assessor` with the collected inventory. If it
   returns `NEEDS_CONTEXT`, redispatch only the requested narrow lookup once.
   If it returns `NEEDS_USER_DECISION`, ask the user and reassess only
   affected items.
4. Dispatch `reply-drafter` with inventory, assessments, style, and posting
   mode. Ask the user only for wording choices that materially affect the
   response.
5. Dispatch `response-verifier`. On `VERIFY: FAIL`, repair only the named
   `Fix target`. Limit to two targeted verification fix cycles, then escalate.
6. Dispatch `response-report-writer` with the verified package. It writes
   `OUTPUT_FILE` and validates required report sections.
7. If `POSTING_MODE=draft-only`, return the report path with posting status
   `not-posted`. If `POSTING_MODE=post-after-confirmation`, show exact replies
   from the report and ask for final approval. Dispatch `thread-reply-poster`
   only after approval.

## Output Contract

The report path is `OUTPUT_FILE`. Load `./references/status-contracts.md` only
when producing a phase status, failure envelope, or final orchestrator response.
Load `./references/report-template.md` only when writing the local report.

## Example

Input: `PR_URL=https://github.com/org/repo/pull/123`, `POSTING_MODE=draft-only`.
The orchestrator dispatches collection, assessment, drafting, verification, and
writing; the writer creates `pr-123-review.md`; posting is skipped. Load
`./references/status-examples.md` only when a concrete status example is needed.
