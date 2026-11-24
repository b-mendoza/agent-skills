# Contract: preflight-validator

Return exactly one status block. Do not include secrets, tokens, or full command output.

```text
PREFLIGHT: <PASS | PUSH_REQUIRED | PUSH_REJECTED | PR_EXISTS | AUTH | BASE_BRANCH_MISSING | HEAD_BRANCH_UNPUSHED | BLOCKED | ERROR>
Platform: <github | github-enterprise | gitlab | bitbucket | unknown>
Unsupported fields: <none | comma list of labels, assignees, closes>
Head remote: <name>
Base remote: <name>
Base repository: <repo path | unavailable>
Base branch: <target branch>
Head branch: <selected branch>
Head remote state: <up-to-date | missing | local-ahead | diverged | unknown>
Head source: <checkout | remote>
Local head state: <local relation to the remote head | unknown>
Base SHA: <sha | unavailable>
Head SHA: <sha | unavailable>
Existing PR: <none | url>
Push attempted: <yes | no>
Push command: <git push head_remote head_branch | none>
Push extras: <none | settings joined by "; ">
Push rejection reason: <diverged | protected branch | permission | other | n/a>
Approval record: <valid | missing | digest-mismatch | n/a>
Reason: <one line>
Decision needed: <none | approve plain push | user resolves rejected push | next action>
```

`PASS` and `PR_EXISTS` require a known base repository; other statuses may report `unavailable`.

Code semantics:

- `PR_EXISTS`: an open PR/MR already targets the same base from the same head.
- `PUSH_REQUIRED`: the checkout head must be published and no valid push approval is present. `Head SHA` is the full SHA of the local tip to publish. Never request or attempt a plain push for `Head source: remote`.
- `PUSH_REJECTED`: approved plain push was rejected; do not retry with force.
- `HEAD_BRANCH_UNPUSHED`: the selected head is not comparable and cannot be safely published by this skill. A missing named remote head returns this status even if a local copy exists.

`Push extras` lists active `key=value` git settings only, one string per setting, without URL credentials or dry-run rows. For a completed push, verify the published branch tip against the approved SHA; do not report that each extra was verified.
