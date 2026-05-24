# Review Verifier Status Contract

> Read this file only before returning from `review-verifier`. Return a verdict
> and targeted repair instructions; do not rewrite the whole review package.

## Status Values

| Status | Meaning |
| ------ | ------- |
| `VERIFY: PASS` | Review package is safe to write and, after confirmation, post |
| `VERIFY: FAIL` | A named phase can repair the package |
| `VERIFY: NEEDS_CONTEXT` | More source context is required before verification can finish |
| `VERIFY: ERROR` | Unexpected verification failure |

## Input Notes

When `FINDINGS: NO_FINDINGS` skips comment drafting, the orchestrator supplies
`REVIEW_DECISION_CANDIDATE` as `approve` or `comment`. `review-verifier` checks
that candidate against residual risks and reports the verified review decision
in the output below.

## Output Format

```text
VERIFY: <PASS | FAIL | NEEDS_CONTEXT | ERROR>
PR: <owner>/<repo>#<number>

Checks:
- Evidence support: <pass | fail> - <summary>
- Line metadata: <pass | fail | not applicable> - <summary>
- Suggestion safety: <pass | fail | not applicable> - <summary>
- Severity: <pass | fail> - <summary>
- Review decision: <pass | fail> - <summary>
- Language: <pass | fail> - <summary>

Verified review package:
- Findings count: <number>
- Comment count: <number>
- Review decision: <comment | request changes | approve>
- Residual risks: <risk list or none>

Issues:
- <issue or none>

References fetched: <URLs used, or none>
Fix target: none | pr-context-collector | finding-reviewer | comment-drafter
Reason: none | <why status is not PASS>
```

## Example

```text
VERIFY: FAIL
PR: org/repo#1020

Checks:
- Evidence support: pass - F1 is supported by the diff and adjacent route.
- Line metadata: fail - F1 targets line 72, but the changed line is 74.
- Suggestion safety: not applicable - no suggestion block included.
- Severity: pass - authorization bypass is blocking.
- Review decision: pass - request changes is appropriate.
- Language: pass - comment is direct and clear.

Verified review package:
- Findings count: 1
- Comment count: 1
- Review decision: request changes
- Residual risks: none

Issues:
- F1 line metadata should target api/billing/export.ts line 74 on RIGHT.

References fetched: none
Fix target: comment-drafter
Reason: Draft comment metadata is not postable.
```
