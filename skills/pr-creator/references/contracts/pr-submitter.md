# Output Contract — PR Submitter

> Loaded by the `pr-submitter` subagent at return time. The orchestrator uses
> the verified URL and field summary for the final success block.

## Status Template

```text
PR_SUBMIT: PASS | BLOCKED | CREATE_ERROR | AUTH | ERROR
URL: <created PR/MR URL or none>
Base: <target_branch>
Head: <current_branch>
Title: <title>
State: draft | ready
Reviewers: <reviewer list or none>
Labels: <label list or none>
Verification: pass | fail | not-run

Reason: none | <why status is not PASS>
Decision needed: none | <smallest recovery action>
```

## Status Codes

| Code | Use When |
| ---- | -------- |
| `PASS` | Approved PR is created and verification of URL, base, head, and title passes |
| `BLOCKED` | `PREVIEW_APPROVED` is not `true` or a required approved value is empty |
| `CREATE_ERROR` | Creation or post-creation verification fails after approval |
| `AUTH` | Platform CLI or credentials are missing or invalid at submission time |
| `ERROR` | Unexpected submission failure |

Fill `Reason` and `Decision needed` for every non-`PASS` result.

## Example

<example>
PR_SUBMIT: PASS
URL: https://github.com/acme/app/pull/42
Base: main
Head: docs/pr-creator-skill
Title: docs(skills): strengthen pr creation workflow
State: draft
Reviewers: @docs-team
Labels: documentation
Verification: pass

Reason: none
Decision needed: none
</example>
