# Contract: preflight-validator

Return one JSON object. Use shared types and artifacts from
[execution-contracts.md](./execution-contracts.md). The consumer runs `python3
-I "${SKILL_DIR}/scripts/validate-output.py" preflight-validator` on stdin. No
secrets or raw command/API output.

Status enum: `PASS | PUSH_REQUIRED | PUSH_REJECTED | PR_EXISTS | AUTH |
BASE_BRANCH_MISSING | HEAD_BRANCH_UNPUSHED | BLOCKED | ERROR | TOOLS_MISSING`.
Always required: `status`, `reason`, `decision_needed`.

| Key                                                        | Type / values                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| `head_remote`, `base_remote`, `base_branch`, `head_branch` | Nonempty string or `null`                                     |
| `head_remote_state`                                        | `up-to-date`, `missing`, `local-ahead`, `diverged`, `unknown` |
| `base_sha`, `head_sha`                                     | Full remote SHA or `null`                                     |
| `existing_pr`                                              | HTTP(S) URL or `null`                                         |
| `push_attempted`                                           | Boolean                                                       |
| `push`                                                     | Exact push artifact from execution contracts, or `null`       |
| `approval_record`                                          | Exact approval record from execution contracts, or `null`     |
| `push_rejection_reason`                                    | Nonempty string or `null`                                     |
| `missing_tools`                                            | Nonempty capability array; required for `TOOLS_MISSING`       |

Status-dependent required keys and invariants:

| Status          | Additional required keys / conditions                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PASS`          | All fact keys above except `missing_tools`; remotes, branches, and SHAs nonnull; `head_remote_state=up-to-date`, `existing_pr=null`, `push_rejection_reason=null`. |
| `PUSH_REQUIRED` | `push`, `push_attempted=false`, `approval_record`; push artifact nonnull, approval may be null/stale; question in `decision_needed`.                               |
| `PUSH_REJECTED` | `push`, `push_attempted=true`, `approval_record`, `push_rejection_reason`; all nonnull, matching push approval, question/next action.                              |
| `PR_EXISTS`     | `existing_pr` nonnull; stop without updating the object.                                                                                                           |
| Other statuses  | Common keys only, plus `missing_tools` for `TOOLS_MISSING`.                                                                                                        |

Whenever `push_attempted=true`, require nonnull `push` and `approval_record`:
`checkpoint=push`, matching `run_id` and canonical artifact digest, and a user
approval reference. A supplied push's remote/destination must match any supplied
`head_remote`/`head_branch`. On `PASS` after pushing,
`head_sha=push.source_sha`. Without a push, `PASS` has `push=null` and
`approval_record=null`. The digest binds the exact
`<source_sha>:refs/heads/<destination_branch>`, not a local branch tip; actual
consent and the post-push remote verification remain evidence duties.

`HEAD_BRANCH_UNPUSHED` means source is not comparable and cannot be safely
published here. `AUTH` means insufficient platform authentication;
`BASE_BRANCH_MISSING` means confirmed absent base. `BLOCKED` covers unavailable
safe prerequisites/approval, `TOOLS_MISSING` required missing/denied capability,
`ERROR` unexpected operation failure. A rejected push never authorizes force or
divergence repair. After `HEAD_MOVED`, obtain fresh remote pins here before any
new analysis or preview.
