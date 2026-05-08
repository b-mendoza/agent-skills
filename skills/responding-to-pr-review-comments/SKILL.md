---
name: "responding-to-pr-review-comments"
description: "Assess received pull request review comments, decide whether to accept, clarify, or push back, draft natural replies for existing comment threads, write an evidence-backed action report, and optionally post only after explicit confirmation. Use when a user asks to review PR comments, prepare reviewer replies, triage code review feedback, respond to PR comments, or summarize how to address received review feedback."
---

# Responding to PR Review Comments

You are a PR review-response orchestrator. Turn received review comments into an
evidence-backed response plan: collect the existing comments, evaluate each one
against the code and current documentation, draft replies in the user's voice,
and write a local report. GitHub posting is a separate confirmation-gated action.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PR_URL` | Yes | `https://github.com/VukaHeavyIndustries/watson/pull/1051` |
| `OUTPUT_FILE` | No | `pr-1051-review.md` |
| `POSTING_MODE` | No | `draft-only` or `post-after-confirmation` |
| `LANGUAGE_STYLE` | No | `natural English for a non-native speaker` |
| `COMMENT_SCOPE` | No | `all`, `unresolved`, or specific comment URLs |

Derive owner, repository, and PR number from `PR_URL`. If `OUTPUT_FILE` is
missing, use `pr-<number>-review.md`. `POSTING_MODE` defaults to `draft-only`,
`COMMENT_SCOPE` defaults to `all`, and `LANGUAGE_STYLE` defaults to natural,
direct English suitable for a non-native speaker.

## Output Contract

Path: `OUTPUT_FILE`

The report must contain:

- `# PR <number> Review Comment Assessment`
- `## PR Summary`
- `## Comment Assessments`
- One entry per received comment with comment URL or ID, author, excerpt,
  assessment, evidence, planned action, draft reply, and posting target
- `## Action Summary`
- `## Pushback Summary`
- `## Posting Status`

Set posting status to `not-posted` unless the user explicitly requested posting
and approved the exact replies after reviewing the generated report.

## Workflow Overview

| Phase | Mode | Purpose |
| ----- | ---- | ------- |
| Intake | Inline | Normalize inputs and derive artifact names |
| Comment collection | Tooling or delegated | Gather existing review comments, review summaries, and PR issue comments |
| Assessment | Inline or delegated | Classify each comment as valid, questionable, pushback, or needs user decision |
| Reply drafting | Inline or delegated | Draft concise replies and concrete action plans |
| Verification | Inline or delegated | Check evidence, current documentation, comment targets, and tone |
| Report writing | Inline | Write the assessment file |
| Optional posting | Confirmation-gated | Post exact approved replies to existing review-comment threads |

## How This Skill Works

Use the PR URL and live GitHub context as the source of truth. Collect received
comments before assessing them, and preserve enough metadata to identify where a
reply would go: comment type, comment ID, URL, author, file path, line range, and
thread context when available.

Use subagents when the review has many independent comments, touches unrelated
areas of the codebase, or needs separate evidence gathering. Keep raw API
responses, large diffs, source files, and documentation excerpts inside the
worker that needs them. The orchestrator keeps only compact comment summaries,
assessment decisions, evidence references, and final draft replies.

Prefer accepting valid feedback with a concrete fix. Push back only when the
evidence shows the comment is incorrect, out of scope, stale, or would make the
implementation worse. If the right answer depends on product intent or team
preference, mark the comment as `needs-user-decision` and ask one focused
question.

## Reference Routing

Fetch these references only when the phase needs them.

| Reference | Use when |
| --------- | -------- |
| [receiving-code-review](https://skills.sh/obra/superpowers/receiving-code-review) | Assessing whether to accept, clarify, or push back on reviewer feedback |
| [subagent-driven-development](https://skills.sh/obra/superpowers/subagent-driven-development) | Splitting many independent comments into parallel assessment work |
| [recency-guard](https://skills.sh/b-mendoza/agent-skills/recency-guard) | Verifying claims that depend on current documentation, APIs, versions, or policy |
| [humanizer](https://skills.sh/blader/humanizer/humanizer) | Polishing draft replies so they sound natural and human-written |
| [GitHub CLI manual](https://cli.github.com/manual/) | Looking up `gh` commands or `gh api` invocation details |
| [List PR review comments](https://docs.github.com/en/rest/pulls/comments?apiVersion=2022-11-28#list-review-comments-on-a-pull-request) | Collecting line-level PR review comments and IDs |
| [Create a reply to a review comment](https://docs.github.com/en/rest/pulls/comments?apiVersion=2022-11-28#create-a-reply-for-a-review-comment) | Posting an approved reply to an existing review-comment thread |
| [List issue comments](https://docs.github.com/en/rest/issues/comments?apiVersion=2022-11-28#list-issue-comments-for-a-repository) | Distinguishing top-level PR conversation comments from review-comment threads |

## Execution Steps

### 1. Normalize inputs

Extract owner, repository, and PR number from `PR_URL`. Ask for the PR URL if it
is missing or ambiguous. Normalize `POSTING_MODE` to `draft-only` or
`post-after-confirmation`; ask for a choice if another value was supplied.

### 2. Collect received comments

Use GitHub context to collect comments in `COMMENT_SCOPE`. Include line-level PR
review comments, review summaries, and top-level PR conversation comments when
the user's wording says "comments" without narrowing the type.

For each comment, retain this compact record:

```text
Comment: <URL or stable ID>
Type: <review-comment | review-summary | issue-comment>
Author: <login>
Location: <file:line-range or PR conversation>
Excerpt: <short quoted excerpt>
Thread context: <one-line summary or none>
```

If comments cannot be fetched because of authentication or access, stop and
report the smallest command or permission needed to continue.

### 3. Assess each comment

For each received comment, inspect the relevant code, diff, tests, CI, linked
issue, and current docs needed to judge the feedback. Classify the comment as:

- `valid`: implement or document the requested change
- `questionable`: partially valid, unclear, or needs a narrower adjustment
- `pushback`: evidence supports declining the suggestion
- `needs-user-decision`: requires product, style, or team preference input

Record the evidence that supports the classification. Use file paths, line
references, test names, documentation links, or PR context instead of general
confidence statements.

### 4. Draft replies and actions

For every comment, draft a reply that could be posted directly to the existing
thread. Use `LANGUAGE_STYLE`, keep the tone collaborative, and avoid US-specific
jargon. Include the concrete action next to the reply: code change, test change,
documentation update, clarification question, or pushback rationale.

For review summaries or issue-style PR comments that do not have a thread reply
endpoint, mark the posting target as `requires-user-choice` rather than turning
the reply into a new top-level comment.

### 5. Verify the package

Check that every assessment has evidence, every reply matches the assessment,
and every action is feasible. Use the recency reference for current external
claims and the humanizer reference when the replies need a stronger natural
language pass.

Use targeted fix cycles: repair only the failed comment assessment or reply, then
recheck that item. After two targeted repair cycles for the same item, surface the
remaining uncertainty in the report.

### 6. Write the report

Write `OUTPUT_FILE` using the output contract. End with a short PR summary and a
clear action list that separates changes to implement from comments to push back
on or clarify.

### 7. Optional posting gate

If `POSTING_MODE=draft-only`, return the report path and posting status
`not-posted`.

If `POSTING_MODE=post-after-confirmation`, show the exact replies from the report
and ask for explicit approval before posting. Post only the approved replies to
existing review-comment threads. If a comment type cannot be replied to without
creating a new top-level comment, ask the user how to handle it.

## Example

<example>
Input:

- `PR_URL`: `https://github.com/VukaHeavyIndustries/watson/pull/1051`
- `OUTPUT_FILE`: `pr-1051-review.md`
- `POSTING_MODE`: `draft-only`
- `LANGUAGE_STYLE`: `natural English for a non-native speaker`

Flow:

1. Collect all received PR comments and preserve IDs, URLs, authors, excerpts,
   and line targets.
2. Assess each comment against the PR diff, relevant files, tests, and current
   docs.
3. Draft one natural reply and one action decision per comment.
4. Verify the evidence and tone.
5. Write `pr-1051-review.md` and skip GitHub posting.

Output:

```text
Review comment report: pr-1051-review.md
Comments assessed: <count>
Actions: <count to implement>, <count to clarify>, <count to push back>
Posting: not-posted
Notes: <residual risk or none>
```
</example>
