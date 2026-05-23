# Status Contracts

> Read this file when a subagent or orchestrator is ready to produce or verify a
> status block. Keep blocks compact: include evidence references and URLs, not
> raw payloads, diffs, full source files, long logs, or long documentation excerpts.

The report file format lives in [`./report-template.md`](./report-template.md).
Background sources live in [`./external-sources.md`](./external-sources.md).
Concrete examples live in [`./status-examples.md`](./status-examples.md).

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

## Orchestrator Failure Envelope

```text
PR_COMMENT_RESPONSE: AUTH | NOT_FOUND | NO_COMMENTS | NEEDS_USER_DECISION | RESPONSE_ERROR | VERIFY_FAIL | WRITE_ERROR | POST_ERROR | CANCELLED
Reason: <one line>
Next step: <one clear action>
```

## Final Orchestrator Success

```text
PR_COMMENT_RESPONSE: PASS
Report: <OUTPUT_FILE>
Comments assessed: <number>
Actions: <implement count> implement, <clarify count> clarify, <pushback count> push back
Posting: <not-posted | posted | cancelled>
Notes: <residual risk or none>
```

Use [`./status-examples.md`](./status-examples.md) only when a concrete example
is needed.
