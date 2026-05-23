# Report Template

> Read this file only when writing the final review-comment-response report.
> The report path comes from the `OUTPUT_FILE` input on the writing phase.

The report must be readable without the conversation context. Keep evidence
references and URLs in place of raw payloads, full diffs, or long log output.

## Required Sections (in order)

```markdown
# PR <number> Review Comment Assessment

PR: <PR_URL>
Posting mode: <POSTING_MODE>
Posting status: <POSTING_STATUS>

## PR Summary

<short summary of the PR and review-comment response state>

## Comment Assessments

### <Comment ID>: <short topic>

- Comment: <URL or stable ID>
- Author: <login>
- Location: <path:line-range or PR conversation>
- Classification: <valid | questionable | pushback | needs-user-decision>
- Evidence: <specific evidence and URLs>
- Planned action: <action>
- Posting target: <target>
- Verification notes: <notes>

Draft reply:

> <reply text>

## Action Summary

- Implement: <items or none>
- Clarify: <items or none>
- Ask user: <items or none>

## Pushback Summary

- <items or none>

## Posting Status

<not-posted, posted, or cancelled with unsupported targets>
```

## Writing Rules

- Reuse exactly one `### <Comment ID>: <short topic>` heading per received
  comment from the verified package; do not invent additional comments.
- Keep the PR summary focused on review-comment response work, not a general
  PR change log.
- Place each draft reply inside a single blockquote so the user can copy it
  without trailing prose.
- Preserve `requires-user-choice` posting targets verbatim. Do not silently
  rewrite them to `review-comment-reply:<root-id>`.
- Cite external URLs inline next to the evidence that uses them. Do not embed
  long quotes from external pages.

## Self-Check Before Returning

Before returning `WRITE: PASS`, re-read the file and confirm:

- Every received comment from the verified package appears as a section.
- Each section contains all required bullet fields plus the draft reply
  blockquote.
- `Action Summary` and `Pushback Summary` reconcile with the per-comment
  classifications and planned actions.
- `Posting Status` matches the posting status in `WRITE` output.

## Minimal Section Example

```markdown
### C1: Align 404 mapping with route conventions

- Comment: https://github.com/org/repo/pull/123#discussion_r12345
- Author: alice
- Location: src/api.ts:42
- Classification: valid
- Evidence: src/api.ts:42 returns 500 for missing resources while existing
  route tests in tests/api.test.ts:88 expect 404 for the same case.
- Planned action: Change the missing-resource branch in `getItem` to return
  404 and add a regression test.
- Posting target: review-comment-reply:r12345
- Verification notes: tests already cover the corrected branch; no docs touch.

Draft reply:

> Good catch. I'll align the missing-resource branch with the existing 404
> tests in `tests/api.test.ts:88` and add a regression test in the same file.
```
