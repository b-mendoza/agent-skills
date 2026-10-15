# Review File Template

> Read this file only from `review-writer` while assembling `OUTPUT_FILE`. Preserve the complete verified records, exact summary, comments, metadata, sources and suggestion blocks.

The review must stand alone without chat context. Both variants use the same canonical package. Preserve Markdown bytes after removing only record-container indentation; do not wrap prose or duplicate a suggestion outside its exact Body. The posting-status vocabulary is exactly `draft`, `posted`, `cancelled`, `failed`. Update mode may change only that value and the reserved receipt content.

## With Findings

```markdown
# PR <number> Review

PR: <PR_URL>

Dimensions reviewed: <declared dimension order>

Reviewed base: <REVIEWED_BASE_SHA>

Reviewed head: <REVIEWED_HEAD_SHA>

PR state: <open | closed | merged; label non-open as historical assessment>

## Findings

### 1. [<severity>] <finding title>

- Finding ID: `<id>`
- Candidate IDs: <retained original IDs>
- Disposition: <confirmed | adjusted; original severity when adjusted>
- Confidence: <verified confidence>
- Location: <inline | summary>
- File/line: `<path>:<line-or-range>`; side `<RIGHT|LEFT>` (inline findings only)
- Evidence: <verified evidence with path:line>
- Failure scenario: <verified failure scenario>
- Fix: <verified minimal fix>
- External sources: <claim-specific URLs or none>
- Dedup: <new | follow-up | summary | unknown>

For a follow-up, preserve the complete helper-returned target together:

- thread_id: <GraphQL review-thread node ID>
- is_resolved: <true | false>
- viewer_can_unresolve: <true | false>
- path: <thread path>
- line: <thread line or null>
- root_comment_id: <REST root decimal string or null>
- root_url: <helper-returned existing thread URL or null>
- comments_total: <integer>
- comments_returned: <integer>
- comments_truncated: <true | false>
- Reopen: <yes | no, from the verified comment>

For an actual new inline comment only:

- Line metadata: `path=<path>`, `line=<ending line>`, `side=<RIGHT|LEFT>`, `start_line=<starting line or none>`, `start_side=<RIGHT|LEFT|none>`

Draft PR comment (new or follow-up only):

<exact self-contained Body, including any actual verified suggestion fence>

Suggestion: <none | included in body>

For `summary` or `unknown` findings, omit target/comment metadata and the Draft PR comment subsection. Keep the complete finding record and its exact summary observation; never invent `n/a` line numbers. Unknown dedup blocks posting.

## Dropped Candidates

- <candidate ID and retained written reason, or none>

## Review Decision

<exact verified comment | request changes | approve value>

## Review Summary

<exact canonical Review summary Markdown, including merge-readiness reasoning>

## Coverage Limits

- Inspected: <actual joined file/ranges, in declared dimension order>
- Gaps: <unavailable, truncated, binary, omitted/out-of-focus evidence or none>
- History availability: <complete | partial | unknown and material limits>

## Residual Risks

- <unchanged verified residual risks or none>

## Verification Notes

- <supplied observed checks/results and material omissions, or none>
- CI: <refreshed decision-used observation/time or collection-time qualification>

## Posting

Posting status: <draft | posted | cancelled | failed>

<!-- posting-receipt:start -->

<none before posting; later actual action outcomes, IDs/URLs, confirmed reopens and failed/unattempted/uncertain actions>
<!-- posting-receipt:end -->
```

The conditional explanations above are template instructions, not artifact prose. Preserve all fields supplied by canonical records; omit only fields the package itself omits. A suggestion is a real fence inside the exact Body, never a second copied patch. A verified summary finding can have neither a new inline comment nor a reply, so inline/reply totals need not equal total findings.

## No Findings

Use the verified decision and exact summary from the same full package. Approval means merge-ready within disclosed evidence; blocking residual risk requires comment without endorsement. A closed/merged PR is a historical assessment.

```markdown
# PR <number> Review

PR: <PR_URL>

Dimensions reviewed: <declared dimension order>

Reviewed base: <REVIEWED_BASE_SHA>

Reviewed head: <REVIEWED_HEAD_SHA>

PR state: <open | closed | merged; label non-open as historical assessment>

## Findings

No findings in the inspected scope. This is not proof of correctness.

## Dropped Candidates

- <candidate ID and retained written reason, or none>

## Review Decision

<exact verified approve | comment value>

## Review Summary

<exact canonical Review summary Markdown>

## Coverage Limits

- Inspected: <actual joined file/ranges, in declared dimension order>
- Gaps: <unavailable, truncated, binary, omitted/out-of-focus evidence or none>
- History availability: <complete | partial | unknown and material limits>

## Residual Risks

- <unchanged verified residual risks or none>

## Verification Notes

- <supplied observed checks/results and material omissions, or none>
- CI: <refreshed decision-used observation/time or collection-time qualification>

## Posting

Posting status: <draft | posted | cancelled | failed>

<!-- posting-receipt:start -->

<none before posting; later actual action outcomes, IDs/URLs and failed/unattempted/uncertain actions>
<!-- posting-receipt:end -->
```

## Required Post-Write Check

Confirm `## Findings`, `## Dropped Candidates`, `## Review Decision`, `## Review Summary`, `## Coverage Limits`, `## Residual Risks`, `## Verification Notes` and `## Posting` exist in both variants. Confirm PR/dimensions are separate paragraphs, full reviewed identities/state are present, records/summary/body bytes match the verified package, and receipt markers occur exactly once in order. Status/receipt updates must preserve every substantive byte. Claim-specific URLs do not establish aggregate source coverage or human test execution.
