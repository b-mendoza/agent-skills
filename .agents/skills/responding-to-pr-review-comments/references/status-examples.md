# Status Examples

> Read this file only when a concrete example is needed for formatting,
> troubleshooting, or maintaining this skill. Status schemas live in
> `./status-contracts.md`; this file is examples only.

## Dispatch Round Trip

Input: `PR_URL=https://github.com/org/repo/pull/123`, `POSTING_MODE=draft-only`.

1. The orchestrator dispatches `review-comment-collector` and receives four
   received comments with posting targets.
2. The orchestrator dispatches `review-comment-assessor` and receives two
   `valid`, one `questionable`, and one `pushback` classification.
3. The orchestrator dispatches `reply-drafter`, then `response-verifier`.
4. The orchestrator dispatches `response-report-writer`, which writes
   `pr-123-review.md`.
5. The orchestrator returns `PR_COMMENT_RESPONSE: PASS` with `Posting: not-posted`.

## Successful Assessment Item

```text
- Comment ID: C1
  Classification: valid
  Confidence: high
  Evidence:
  - src/api.ts:42 returns 500 for a missing resource while tests/api.test.ts:88 expects 404 for the same route family.
  Rationale: The reviewer identified an inconsistent error mapping.
  Action intent: implement
  Drafting guidance: Thank them and say the route will be aligned with existing 404 behavior.
```

## Targeted Verification Failure

```text
VERIFY: FAIL
PR: org/repo#123
Output file: pr-123-review.md
Checks:
- Coverage: PASS - all comments represented
- Evidence: FAIL - C2 pushback lacks code or documentation evidence
- Recency: NOT_APPLICABLE - no current external claims
- Actions: PASS - actions match classifications
- Language: PASS - replies are natural and concise
- Posting targets: PASS - unsupported targets remain marked for user choice
Fix target: assessor:C2
Required fixes:
- Add concrete evidence for the C2 pushback or change the classification.
Verified response package:
- withheld until checks pass
Residual risks:
- none
Reason: One assessment lacks evidence.
Next step: Redispatch assessor for C2 only.
```

## Final Success Response

```text
PR_COMMENT_RESPONSE: PASS
Report: pr-123-review.md
Comments assessed: 4
Actions: 2 implement, 1 clarify, 1 push back
Posting: not-posted
Notes: none
```
