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
Offer source: <published | local | none>
Source SHA: <full SHA | unavailable>
Source behind base: <count | unavailable>
Differing pairs: <list of - published-SHA ! local-SHA "subject" | none>
Local-only commits: <list of - SHA "subject" | none>
Published-only commits: <list of - SHA "subject" | none>
Head behind base: <count | unavailable>
Head ahead of base: <count | unavailable>
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

`PASS` and `PR_EXISTS` require a known base repository; other statuses may report `unavailable`. `PASS` requires full base and head SHAs, nonnegative ahead/behind counts, and no existing PR. `PR_EXISTS` identifies an open PR/MR for the same base and head by HTTPS URL. `PUSH_REQUIRED` applies only to a checkout head requiring publication: `Head SHA` is the full SHA of the local branch tip to publish, not the remote tip; `PUSH_REJECTED` means an approved plain push failed. `HEAD_BRANCH_UNPUSHED` means the head cannot safely be published. `AUTH`, `BASE_BRANCH_MISSING`, `BLOCKED`, and `ERROR` identify authentication, missing base, unmet precondition, and unexpected failure respectively.

`PASS` and `PR_EXISTS` require a full source SHA and a nonnegative source-behind count. For a published source all three commit lists are `none`, including when the diverged local branch is an older copy of the same series. A local source requires a diverged head and no published-only commits. A published commit with no local counterpart requires `Offer source: none`. With `none`, preflight makes no rebase or publish offer. State why in `Reason`: a published commit with no local counterpart, a series longer than 200 commits, a mirror remote, or `push.recurseSubmodules=only`. Report at most twenty rows per list, one per line with full SHAs and a quoted subject. `Push extras` lists active `key=value` git settings only, one string per setting, without URL credentials or dry-run rows.
