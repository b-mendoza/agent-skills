# Status Contracts

> Read this file when a subagent is ready to produce or verify a status block.
> Keep blocks compact: include evidence references and URLs, not raw payloads,
> diffs, full source files, long logs, or long documentation excerpts.

The report file format and writing rules live in
[`./report-template.md`](./report-template.md). Background sources and tone
guidance live in [`./external-sources.md`](./external-sources.md).

## Shared Values

- **Classifications:** `valid`, `questionable`, `pushback`, `needs-user-decision`.
- **Action intents:** `implement`, `clarify`, `push-back`, `ask-user`.
- **Posting targets:** `review-comment-reply:<root-id>` for supported
  review-comment threads; `requires-user-choice` for review summaries and
  top-level PR comments.

## Collector Output

```text
COLLECT: PASS | NO_COMMENTS | AUTH | NOT_FOUND | ERROR
PR: <owner>/<repo>#<number>
Responder: <login or unknown>
Scope: <COMMENT_SCOPE>
Counts: <n review comments>, <n review summaries>, <n issue comments>, <n received>
Comments:
- Comment ID: <C1>
  GitHub ID: <id>
  Type: <review-comment | review-summary | issue-comment>
  URL: <url>
  Author: <login>
  Location: <path:line-range or PR conversation>
  Excerpt: <short quote or summary>
  Thread context: <one-line context or none>
  Posting target: <review-comment-reply:root-id | requires-user-choice>
Limitations:
- <missing metadata, unavailable endpoint, or none>
Reason: none | <why status is not PASS>
Next step: none | <smallest recovery action>
```

## Assessor Output

```text
ASSESS: PASS | NEEDS_CONTEXT | NEEDS_USER_DECISION | ERROR
PR: <owner>/<repo>#<number>
Counts: <n valid>, <n questionable>, <n pushback>, <n needs-user-decision>
Assessments:
- Comment ID: <C1>
  Classification: <valid | questionable | pushback | needs-user-decision>
  Confidence: <high | medium | low>
  Evidence:
  - <specific source and why it matters>
  Rationale: <short reasoning>
  Action intent: <implement | clarify | push-back | ask-user>
  Drafting guidance: <tone, caveat, or reply angle>
Context requests:
- <smallest missing context request or none>
User questions:
- <focused question or none>
Reason: none | <why status is not PASS>
Next step: none | <smallest recovery action>
```

## Drafter Output

```text
DRAFT: PASS | NEEDS_USER_DECISION | ERROR
PR: <owner>/<repo>#<number>
Draft replies:
- Comment ID: <C1>
  Classification: <valid | questionable | pushback | needs-user-decision>
  Planned action: <code change | test change | docs change | clarify | push back | ask user>
  Posting target: <review-comment-reply:root-id | requires-user-choice>
  Draft reply: <reply text, ready for user review>
  Action details: <specific action to take>
  User question: <question or none>
Style notes:
- <tone or language note, or none>
Reason: none | <why status is not PASS>
Next step: none | <smallest recovery action>
```

## Verifier Output

```text
VERIFY: PASS | FAIL | NEEDS_CONTEXT | ERROR
PR: <owner>/<repo>#<number>
Output file: <OUTPUT_FILE>
Checks:
- Coverage: <PASS | FAIL> - <note>
- Evidence: <PASS | FAIL> - <note>
- Recency: <PASS | FAIL | NOT_APPLICABLE> - <note>
- Actions: <PASS | FAIL> - <note>
- Language: <PASS | FAIL> - <note>
- Posting targets: <PASS | FAIL> - <note>
Fix target: none | <collector | assessor | drafter>:<comment id>
Required fixes:
- <specific fix or none>
Verified response package:
- <compact per-comment verified assessment, reply, action, posting target, and citations>
Residual risks:
- <risk or none>
Reason: none | <why status is not PASS>
Next step: none | <smallest recovery action>
```

## Writer Output

```text
WRITE: PASS | ERROR
File: <OUTPUT_FILE>
Comments assessed: <number>
Actions: <implement count> implement, <clarify count> clarify, <pushback count> push back
Posting status: <not-posted | posted | cancelled>
Reason: none | <why status is ERROR>
```

## Poster Output

```text
POST: PASS | PREVIEW_REQUIRED | AUTH | TARGET_UNSUPPORTED | ERROR
PR: <owner>/<repo>#<number>
Output file: <OUTPUT_FILE>
Posted replies: <number>
Read-back verified: <yes | no>
Skipped replies:
- <comment id and reason, or none>
Reason: none | <why status is not PASS>
Next step: none | <smallest recovery action>
```

## Schema Examples

Successful assessment item:

```text
- Comment ID: C1
  Classification: valid
  Confidence: high
  Evidence:
  - src/api.ts:42 returns 500 for a missing resource while existing route tests expect 404 for the same case.
  Rationale: The reviewer identified an inconsistent error mapping.
  Action intent: implement
  Drafting guidance: Thank them and say we will align the status code with existing route behavior.
```

Targeted verification failure (illustrates `Fix target` and `Required fixes`):

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
