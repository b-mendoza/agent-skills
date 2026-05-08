# Output Contract — Preflight Validator

> Loaded by the `preflight-validator` subagent at return time. The orchestrator
> uses only the summary fields to decide whether to push, retry, or escalate.

## Status Template

```text
PREFLIGHT: PASS | PUSH_REQUIRED | AUTH | BASE_BRANCH_MISSING | HEAD_BRANCH_UNPUSHED | BLOCKED | ERROR
Platform: <platform>
Base branch: <target_branch>
Head branch: <current_branch>
Head remote state: up-to-date | missing | local-ahead | unknown
Push attempted: yes | no

Reason: none | <why status is not PASS>
Decision needed: none | <smallest user decision or recovery action>
```

## Status Codes

| Code | Use When |
| ---- | -------- |
| `PASS` | Auth, target ref, and source ref are all comparable remotely |
| `PUSH_REQUIRED` | Source branch is missing or local-ahead and no `PUSH_APPROVED=true` was supplied |
| `AUTH` | Platform CLI, token, or permission is missing or invalid |
| `BASE_BRANCH_MISSING` | Target branch cannot be found on the remote |
| `HEAD_BRANCH_UNPUSHED` | Source branch is still not comparable after an approved push |
| `BLOCKED` | Repository or platform state prevents safe progress |
| `ERROR` | Unexpected validation failure |

Fill `Reason` and `Decision needed` for every non-`PASS` result.

## Example

<example>
PREFLIGHT: PUSH_REQUIRED
Platform: github
Base branch: main
Head branch: feat/checkout-redesign
Head remote state: local-ahead
Push attempted: no

Reason: Local branch has commits that are not on origin/feat/checkout-redesign.
Decision needed: Ask the user whether to push the current branch.
</example>
