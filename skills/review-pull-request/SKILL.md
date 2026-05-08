---
name: "review-pull-request"
description: "Review one pull request through a progressive, subagent-driven workflow. Use when the user asks to review a PR, audit a pull request, prepare GitHub review comments, draft request-changes feedback, write a PR review file, or optionally post approved review comments. This skill is for a single PR; ask the user to choose one PR when multiple PR URLs are supplied."
---

# Review Pull Request

You are a single-PR review orchestrator. You normalize one PR input, dispatch
the right phase subagent, decide from structured status blocks, and require
explicit confirmation before any GitHub posting side effect.

The orchestrator keeps only workflow state, concise subagent summaries, user
choices, and final synthesis. Raw diffs, source files, command output, CI logs,
API payloads, and fetched website contents stay inside the phase subagent that
needs them.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PR_URL` | Yes | `https://github.com/org/repo/pull/1020` |
| `OUTPUT_FILE` | No | `pr-1020-review.md` |
| `POSTING_MODE` | No | `draft-only` (default) or `post-after-confirmation` |
| `LANGUAGE_STYLE` | No | `natural English for a non-native speaker` (default) |
| `REVIEW_FOCUS` | No | `full` (default), `security`, `correctness`, or `tests` |

If `OUTPUT_FILE` is missing, derive `pr-<number>-review.md` from `PR_URL`.

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `pr-context-collector` | `./subagents/pr-context-collector.md` | Collect compact PR context without returning raw patches |
| `finding-reviewer` | `./subagents/finding-reviewer.md` | Surface evidence-backed defects and residual risks |
| `comment-drafter` | `./subagents/comment-drafter.md` | Convert findings into GitHub-ready comment drafts |
| `review-verifier` | `./subagents/review-verifier.md` | Validate the review package before writing or posting |
| `review-writer` | `./subagents/review-writer.md` | Write the local Markdown review artifact |
| `review-poster` | `./subagents/review-poster.md` | Post only exact, approved, verified comments |

Read a subagent file only when dispatching that phase.

## Progressive Disclosure

Run this skill in three layers. Static knowledge (GitHub mechanics, code-review
judgment, security checklists, writing rules) lives behind URLs in the
references file; subagents fetch only the rule they need at the moment they
need it.

| Layer | What loads | When |
| ----- | ---------- | ---- |
| Level 0 | This `SKILL.md` | Always, when the skill triggers |
| Level 1 | `./references/external-review-resources.md` | When any phase needs current GitHub mechanics, code-review judgment, security guidance, or writing-style rules |
| Level 1 | `./references/review-file-template.md` | Only by `review-writer` while assembling `OUTPUT_FILE` |
| Level 2 | `./subagents/<name>.md` | Only when dispatching that subagent |
| Level 3 | External URLs listed in `external-review-resources.md` | On demand, fetched by the subagent that needs the rule |

Subagents cite the URL they fetched in their status block and never forward
raw page contents to the orchestrator.

## Workflow

| Phase | Owner | Continue on |
| ----- | ----- | ----------- |
| Intake | Inline | Inputs complete |
| Context | `pr-context-collector` | `CONTEXT: PASS` |
| Findings | `finding-reviewer` | `FINDINGS: PASS` or `FINDINGS: NO_FINDINGS` |
| Comments | `comment-drafter` | `COMMENTS: PASS` (skipped if `NO_FINDINGS`) |
| Verify | `review-verifier` | `VERIFY: PASS` |
| Write | `review-writer` | `WRITE: PASS` |
| Post | `review-poster` | `POST: PASS` or skipped |

Carry this compact state through the pipeline:

```text
Inputs: PR_URL, OUTPUT_FILE, POSTING_MODE, LANGUAGE_STYLE, REVIEW_FOCUS
Latest status: <CONTEXT | FINDINGS | COMMENTS | VERIFY | WRITE | POST block>
Posting: skipped | pending-confirmation | posted | cancelled | failed
```

Keep these invariants:

- Review exactly one PR per run; ask the user to pick one if multiple URLs arrive.
- Prefer fewer, stronger findings over many weak notes.
- Treat every finding as provisional until `review-verifier` returns `PASS`.
- Use `suggestion` blocks only for local, mechanically safe edits.
- Default to `draft-only`; require explicit approval of the file preview before posting.
- Record missing context as residual risk instead of guessing.

## Phase Guide

1. Normalize inputs inline. If multiple PR URLs are present, ask which single
   PR to review before dispatching any subagent.
2. Dispatch `pr-context-collector`. On `LARGE_REVIEW_CONFIRMATION_REQUIRED`,
   show the shortstat and changed-file groups, ask whether to proceed, and
   re-dispatch with `LARGE_REVIEW_APPROVED=true` if approved.
3. Dispatch `finding-reviewer` with the context summary. On `NEEDS_CONTEXT`,
   re-dispatch `pr-context-collector` once with the narrow request, then retry.
4. Dispatch `comment-drafter` unless findings are `NO_FINDINGS`. On
   `NEEDS_METADATA`, collect only the requested metadata and retry once.
5. Dispatch `review-verifier`. On `FAIL`, repair only the phase named in
   `Fix target`. Cap repair at two verification cycles before escalating.
6. Dispatch `review-writer` with the verified package.
7. If `POSTING_MODE=post-after-confirmation`, show the exact file preview and
   ask for final approval. Dispatch `review-poster` only after approval.

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

1. `pr-context-collector` returns `CONTEXT: PASS` with shortstat, CI summary, and risk areas.
2. `finding-reviewer` returns `FINDINGS: PASS` with two grounded findings.
3. `comment-drafter` returns `COMMENTS: PASS` with two line comments.
4. `review-verifier` returns `VERIFY: PASS`.
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
