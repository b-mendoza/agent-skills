# Review Workflow Playbook

> Read this file after input normalization. Keep only status summaries in the
> orchestrator context; raw diffs, command output, API payloads, and fetched web
> pages stay inside the subagent that produced them.

## Phase Sequence

| Phase | Owner | Continue on |
| ----- | ----- | ----------- |
| Intake | Inline | Inputs complete |
| Context | `pr-context-collector` | `CONTEXT: PASS` |
| Findings | `finding-reviewer` | `FINDINGS: PASS` or `FINDINGS: NO_FINDINGS` |
| Comments | `comment-drafter` | `COMMENTS: PASS` or skipped after the no-finding decision checkpoint |
| Verify | `review-verifier` | `VERIFY: PASS` |
| Write | `review-writer` | `WRITE: PASS` |
| Post | `review-poster` | `POST: PASS` or skipped |

## State Envelope

Carry this compact state between phases:

```text
Inputs: PR_URL, OUTPUT_FILE, POSTING_MODE, LANGUAGE_STYLE, REVIEW_FOCUS
Latest status: <CONTEXT | FINDINGS | COMMENTS | VERIFY | WRITE | POST block>
Review decision candidate: none | comment | approve
Posting: skipped | pending-confirmation | posted | cancelled | failed
Repair cycles: <0-2>
```

## Execution Rules

1. If multiple PR URLs are present, ask the user to choose one before dispatch.
2. On `CONTEXT: LARGE_REVIEW_CONFIRMATION_REQUIRED`, show shortstat and
   changed-file groups, ask whether to proceed, and re-dispatch context
   collection with `LARGE_REVIEW_APPROVED=true` only if approved.
3. Route each context status explicitly: `CONTEXT: AUTH` to `PR_REVIEW: AUTH`,
   `CONTEXT: NOT_FOUND` to `PR_REVIEW: NOT_FOUND`, `CONTEXT: NEEDS_CONTEXT` to
   `PR_REVIEW: NEEDS_CONTEXT`, and `CONTEXT: ERROR` to `PR_REVIEW: REVIEW_ERROR`.
4. Route initial `FINDINGS: ERROR` to `PR_REVIEW: REVIEW_ERROR`.
5. On `FINDINGS: NEEDS_CONTEXT`, dispatch `pr-context-collector` once with the
   narrow request, then retry findings once. Route retry `FINDINGS: NEEDS_CONTEXT`
   to `PR_REVIEW: NEEDS_CONTEXT`; route retry `FINDINGS: ERROR` to
   `PR_REVIEW: REVIEW_ERROR`. If the narrow context collection returns
   `CONTEXT: LARGE_REVIEW_CONFIRMATION_REQUIRED`, use the same approval gate as
   rule 2 and re-dispatch the narrow request with `LARGE_REVIEW_APPROVED=true`
   only if approved.
6. On `FINDINGS: NO_FINDINGS`, skip `comment-drafter`, set
   `REVIEW_DECISION_CANDIDATE`, and pass it to `review-verifier`: `approve` when
   residual risks do not block approval; otherwise `comment`.
7. Route initial `COMMENTS: ERROR` to `PR_REVIEW: REVIEW_ERROR`.
8. On `COMMENTS: NEEDS_METADATA`, collect only the requested line metadata and
   retry comment drafting once. Route retry `COMMENTS: NEEDS_METADATA` or
   `COMMENTS: ERROR` to `PR_REVIEW: REVIEW_ERROR`.
9. On `VERIFY: FAIL`, repair only the phase named in `Fix target`, then re-run
   verification. Stop after two verification repair cycles and escalate to
   `PR_REVIEW: VERIFY_FAIL`. Route `VERIFY: NEEDS_CONTEXT` to
   `PR_REVIEW: NEEDS_CONTEXT`; route `VERIFY: ERROR` to `PR_REVIEW: REVIEW_ERROR`.
10. Dispatch `review-writer` only after `VERIFY: PASS`; route `WRITE: ERROR` to
    `PR_REVIEW: WRITE_ERROR`.
11. If `POSTING_MODE=post-after-confirmation`, show the exact file preview and
    ask for final approval. Dispatch `review-poster` only after approval.
12. Route `POST: PASS` to posted success. Route `POST: PREVIEW_REQUIRED`,
     `POST: AUTH`, `POST: METADATA_INVALID`, and `POST: ERROR` to
     `PR_REVIEW: POST_ERROR` with the poster's `Reason` and `Next step`.

## Failure Envelope

When the workflow cannot continue, return:

```text
PR_REVIEW: AUTH | NOT_FOUND | LARGE_REVIEW | NEEDS_CONTEXT | REVIEW_ERROR | VERIFY_FAIL | WRITE_ERROR | POST_ERROR | CANCELLED
Reason: <one line>
Next step: <one clear action>
```

## Final Output Contract

Final success replies include:

```text
Review file: <OUTPUT_FILE>
Findings: <count or 0>
Review decision: <comment | request changes | approve>
Posting: <skipped | posted | cancelled>
Notes: <one-line residual risk or none>
```

## Dispatch Example

<example>
Input: `PR_URL=https://github.com/org/repo/pull/1020`, `POSTING_MODE=draft-only`

1. `pr-context-collector` returns `CONTEXT: PASS` with shortstat, CI summary,
   changed-file groups, risk areas, and references fetched.
2. `finding-reviewer` returns `FINDINGS: PASS` with two grounded findings.
3. `comment-drafter` returns `COMMENTS: PASS` with two line comments.
4. `review-verifier` returns `VERIFY: PASS`.
5. `review-writer` returns `WRITE: PASS` for `pr-1020-review.md`.
6. Final reply uses the Final Output Contract.
</example>
