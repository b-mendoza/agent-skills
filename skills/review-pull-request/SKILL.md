---
name: "review-pull-request"
description: "Review one pull request through a progressive, subagent-driven workflow. Use when the user asks to review a PR, audit a pull request, prepare GitHub review comments, draft request-changes feedback, write a PR review file, or optionally post approved review comments. This skill is for a single PR; ask the user to choose one PR when multiple PR URLs are supplied."
---

# Review Pull Request

You are a single-PR review orchestrator. You normalize one PR input, dispatch the
right phase subagent, make decisions from structured status blocks, and ask the
user for confirmation before any GitHub posting side effect.

The orchestrator keeps only workflow state, concise subagent summaries, user
choices, and final synthesis. Raw diffs, source files, command output, CI logs,
API payloads, and fetched website contents stay inside the phase subagent that
needs them.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PR_URL` | Yes | `https://github.com/org/repo/pull/1020` |
| `OUTPUT_FILE` | No | `pr-1020-review.md` |
| `POSTING_MODE` | No | `draft-only` or `post-after-confirmation` |
| `LANGUAGE_STYLE` | No | `natural English for a non-native speaker` |
| `REVIEW_FOCUS` | No | `full`, `security`, `correctness`, or `tests` |

If `OUTPUT_FILE` is missing, derive `pr-<number>-review.md`. Default
`POSTING_MODE` to `draft-only`, `REVIEW_FOCUS` to `full`, and `LANGUAGE_STYLE` to
natural, direct English.

## Workflow Overview

| Phase | Owner | Purpose | Continue on |
| ----- | ----- | ------- | ----------- |
| Intake | Inline | Parse one PR URL and normalize options | Inputs complete |
| Context | `pr-context-collector` | Gather PR metadata, diff shape, CI, issue links, and risk areas | `CONTEXT: PASS` |
| Findings | `finding-reviewer` | Find evidence-backed defects and residual risks | `FINDINGS: PASS` or `FINDINGS: NO_FINDINGS` |
| Comments | `comment-drafter` | Draft postable line comments and safe suggestions | `COMMENTS: PASS` |
| Verify | `review-verifier` | Check evidence, line targets, severity, suggestions, and tone | `VERIFY: PASS` |
| Write | `review-writer` | Write the local findings-first review file | `WRITE: PASS` |
| Post | `review-poster` | Optionally post approved comments to GitHub | `POST: PASS` or skipped |

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `pr-context-collector` | `./subagents/pr-context-collector.md` | Collects compact PR context without returning raw patches |
| `finding-reviewer` | `./subagents/finding-reviewer.md` | Reviews changed code for grounded findings and residual risks |
| `comment-drafter` | `./subagents/comment-drafter.md` | Converts findings into GitHub-ready comment drafts |
| `review-verifier` | `./subagents/review-verifier.md` | Validates the review package before writing or posting |
| `review-writer` | `./subagents/review-writer.md` | Writes the local Markdown review artifact |
| `review-poster` | `./subagents/review-poster.md` | Posts only exact, approved, verified comments |

Read a subagent file only when dispatching that phase.

## Progressive Disclosure

Use this skill in three layers:

| Layer | What loads | When |
| ----- | ---------- | ---- |
| Level 0 | This `SKILL.md` | Always, when the skill triggers |
| Level 1 | `./references/external-review-resources.md` and `./references/review-file-template.md` | Only when a phase needs external guidance or the review-file template |
| Level 2 | `./subagents/*.md` | Only when dispatching that subagent |

Subagents fetch external websites just in time when current GitHub behavior,
code-review judgment, security review, writing guidance, or progressive
disclosure background matters. They fetch the smallest relevant source, apply
the rule, cite the URL in their status block, and avoid returning raw web page
content to the orchestrator.

## How This Skill Works

Carry this compact state through the pipeline:

```text
Inputs: PR_URL, OUTPUT_FILE, POSTING_MODE, LANGUAGE_STYLE, REVIEW_FOCUS
Context: latest CONTEXT block or none
Findings: latest FINDINGS block or none
Comments: latest COMMENTS block or none
Verification: latest VERIFY block or none
Review file: latest WRITE block or none
Posting: skipped, pending-confirmation, posted, cancelled, or failed
```

Keep these invariants:

- Review exactly one PR per run.
- Prefer fewer, stronger findings over many weak notes.
- Treat every finding as provisional until `review-verifier` passes it.
- Use `suggestion` blocks only for local, mechanically safe edits.
- Keep posting confirmation-gated and default to draft-only output.
- Record missing context as residual risk instead of filling gaps by guesswork.

## Phase Guide

1. Normalize inputs inline. If multiple PR URLs are present, ask which single PR
   to review before dispatching any subagent.
2. Dispatch `pr-context-collector`. If it returns a large-review gate, show only
   the shortstat and changed-file groups, then ask whether to proceed.
3. Dispatch `finding-reviewer` with the context summary. If it needs narrow
   context, redispatch `pr-context-collector` once for that request, then retry.
4. Dispatch `comment-drafter` unless findings are `NO_FINDINGS`. If metadata is
   missing, collect only the requested metadata and retry once.
5. Dispatch `review-verifier`. Repair only the failing phase named in `Fix
   target`. Limit repair to two verification cycles.
6. Dispatch `review-writer` with the verified package. It loads the local review
   template only when writing the file.
7. If `POSTING_MODE=post-after-confirmation`, show the exact file preview and ask
   for final approval. Dispatch `review-poster` only after approval.

## Failure Envelope

When the workflow cannot continue, return:

```text
PR_REVIEW: AUTH | NOT_FOUND | LARGE_REVIEW | NEEDS_CONTEXT | REVIEW_ERROR | VERIFY_FAIL | WRITE_ERROR | POST_ERROR | CANCELLED
Reason: <one line>
Next step: <one clear action>
```

## Output Contract

Final success replies include:

```text
Review file: <OUTPUT_FILE>
Findings: <count or 0>
Review decision: <comment | request changes | approve>
Posting: <skipped | posted | cancelled>
Notes: <one-line residual risk or none>
```

## Example

<example>
Input: `PR_URL=https://github.com/org/repo/pull/1020`, `POSTING_MODE=draft-only`

1. `pr-context-collector` returns `CONTEXT: PASS` with shortstat, CI summary, and
   risk areas.
2. `finding-reviewer` returns `FINDINGS: PASS` with two grounded findings.
3. `comment-drafter` returns `COMMENTS: PASS` with two line comments.
4. `review-verifier` returns `VERIFY: PASS` after checking evidence and line
   targets.
5. `review-writer` writes `pr-1020-review.md`.

Output:

```text
Review file: pr-1020-review.md
Findings: 2
Review decision: request changes
Posting: skipped
Notes: none
```
</example>
