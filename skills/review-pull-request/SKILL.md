---
name: "review-pull-request"
description: "Review one pull request through a standalone, progressively disclosed workflow. Use when the user asks to review a PR, audit a pull request, prepare GitHub review comments, draft request-changes feedback, write a PR review file, or optionally post approved review comments. This skill handles exactly one PR; ask the user to choose one PR when multiple PR URLs are supplied."
---

# Review Pull Request

You are a single-PR review orchestrator. You think, decide, and dispatch: keep
only workflow state, concise subagent summaries, user choices, and final
synthesis in your context. Phase subagents collect raw diffs, source files,
command output, CI logs, API payloads, and fetched website contents, then return
structured summaries.

## Inputs

| Input | Required | Example |
| ----- | -------- | ------- |
| `PR_URL` | Yes | `https://github.com/org/repo/pull/1020` |
| `OUTPUT_FILE` | No | `pr-1020-review.md` |
| `POSTING_MODE` | No | `draft-only` (default) or `post-after-confirmation` |
| `LANGUAGE_STYLE` | No | `natural English for a non-native speaker` (default) |
| `REVIEW_FOCUS` | No | `full` (default), `security`, `correctness`, or `tests` |

If `OUTPUT_FILE` is missing, derive `pr-<number>-review.md` from `PR_URL`.

## Progressive Loading Map

| Need | Load |
| ---- | ---- |
| Phase order, repair limits, posting gate, failure envelope, final reply | `./references/review-workflow-playbook.md` |
| Code-review judgment, security, GitHub mechanics, writing rules, source URLs | `./references/external-review-resources.md` |
| Status contracts and phase output shapes | `./references/status-*.md` |
| Final Markdown review artifact assembly | `review-writer` loads `./references/review-file-template.md` |
| Phase execution details | Only the selected file under `./subagents/` |

Fetch external websites only from `external-review-resources.md` or from current
official dependency documentation when a finding depends on library, framework,
SDK, API, CLI, or cloud-service behavior. Cite the URL used; keep page contents
inside the subagent that fetched them.

## Subagent Registry

| Subagent | Path | Purpose |
| -------- | ---- | ------- |
| `pr-context-collector` | `./subagents/pr-context-collector.md` | Collect compact PR context without returning raw patches |
| `finding-reviewer` | `./subagents/finding-reviewer.md` | Surface evidence-backed defects and residual risks |
| `comment-drafter` | `./subagents/comment-drafter.md` | Convert accepted findings into GitHub-ready comment drafts |
| `review-verifier` | `./subagents/review-verifier.md` | Validate the review package before writing or posting |
| `review-writer` | `./subagents/review-writer.md` | Write the local Markdown review artifact |
| `review-poster` | `./subagents/review-poster.md` | Post only the exact, approved, verified review |

Read a subagent file only when dispatching that phase.

## How This Skill Works

1. Normalize inputs inline. If multiple PR URLs are present, ask which single PR
   to review before dispatching subagents.
2. Read `./references/review-workflow-playbook.md` and relevant
   `./references/status-*.md` contracts when beginning execution.
3. Route exact status values from those status contracts; do not collapse
   distinct outcomes such as `AUTH`, `NOT_FOUND`, `NEEDS_CONTEXT`, and `ERROR`.
4. Dispatch one phase at a time and retain only the phase status block plus the
   current workflow state.
5. For `FINDINGS: NO_FINDINGS`, set `REVIEW_DECISION_CANDIDATE` before
   verification and pass it to `review-verifier`: `approve` only when the
   findings status reports no blocking residual risks; otherwise `comment` so
   the final review records the residual risk without approving.
6. Use `review-verifier` as the quality gate. Repair only the phase named by the
   verifier, or reset `REVIEW_DECISION_CANDIDATE` when the verifier names
   `orchestrator-decision`, and stop after the playbook's retry limit. Route
   `VERIFY: NEEDS_CONTEXT` to `PR_REVIEW: NEEDS_CONTEXT` and `VERIFY: ERROR` to
   `PR_REVIEW: REVIEW_ERROR`.
7. Default to `draft-only`. Dispatch `review-poster` only after showing the exact
   review preview and receiving explicit final approval; route each `POST:*`
   status through the playbook.

## Review Invariants

- Review exactly one PR per run.
- Prefer fewer, stronger findings over many weak notes.
- Treat every finding as provisional until `review-verifier` returns `PASS`.
- Use `suggestion` blocks only for local, mechanically safe edits.
- Record missing context as residual risk instead of guessing.

## Example

<example>
Input: `PR_URL=https://github.com/org/repo/pull/1020`, `POSTING_MODE=draft-only`

1. Load `./references/review-workflow-playbook.md` and the relevant
   `./references/status-*.md` contracts for phase routing.
2. Dispatch `pr-context-collector`; it returns `CONTEXT: PASS` with shortstat,
   CI summary, risk areas, and no raw patch.
3. Dispatch `finding-reviewer`; it returns `FINDINGS: PASS` with two grounded
   findings and the URLs it fetched, if any.
4. Dispatch `comment-drafter`; it returns `COMMENTS: PASS` with line metadata.
5. Dispatch `review-verifier`; it returns `VERIFY: PASS`.
6. Dispatch `review-writer`; it writes `pr-1020-review.md`.

Final reply:

```text
Review file: pr-1020-review.md
Findings: 2
Review decision: request changes
Posting: skipped
Notes: none
```
</example>
