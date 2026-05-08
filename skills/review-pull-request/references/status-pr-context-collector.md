# PR Context Collector Status Contract

> Read this file only before returning from `pr-context-collector`. Return a
> compact status block; do not include raw patches, source files, API payloads,
> command output, or fetched web page contents.

## Status Values

| Status | Meaning |
| ------ | ------- |
| `CONTEXT: PASS` | Context summary is ready for finding review |
| `CONTEXT: LARGE_REVIEW_CONFIRMATION_REQUIRED` | Size or scope needs user approval before deep inspection |
| `CONTEXT: AUTH` | GitHub or repository permission failed |
| `CONTEXT: NOT_FOUND` | PR or repository was not found |
| `CONTEXT: NEEDS_CONTEXT` | A narrow missing-context request is required |
| `CONTEXT: ERROR` | Unexpected context collection failure |

## Output Format

```text
CONTEXT: <PASS | LARGE_REVIEW_CONFIRMATION_REQUIRED | AUTH | NOT_FOUND | NEEDS_CONTEXT | ERROR>
PR: <owner>/<repo>#<number>
Title: <title>
Base: <base branch>
Head: <head branch>
Output file: <path>
Shortstat: <files changed, insertions, deletions>
Changed-file groups: <compact grouped list>
CI: <status and failed check summary, or none found>
Linked issue/context: <issue, requirement, or none found>
Behavior summary: <what changed, grounded in the diff>
Risk areas: <areas worth reviewing and why>
Test signals: <tests added, changed, missing, or inconclusive>
References fetched: <URLs used, or none>
Context limitations: <unavailable source, auth gap, or none>
Reason: none | <why status is not PASS>
Decision needed: none | <smallest orchestrator action>
```

## Example

```text
CONTEXT: LARGE_REVIEW_CONFIRMATION_REQUIRED
PR: org/repo#1020
Title: Add billing export endpoint
Base: main
Head: billing-export
Output file: pr-1020-review.md
Shortstat: 42 files changed, 1320 insertions, 180 deletions
Changed-file groups: API: 14 files; UI: 18 files; Tests: 6 files
CI: passing
Linked issue/context: BILL-44 export workflow
Behavior summary: Adds export route, UI action, and CSV generation path.
Risk areas: API/UI contract mismatch; large surface area
Test signals: API tests added; no authorization negative test found
References fetched: none
Context limitations: none
Reason: Review size gate exceeded.
Decision needed: Ask whether to proceed with one large review.
```
