# Contract: branch-rebaser

Return exactly one status block. Do not include tokens, raw platform responses, or full command output.

```text
REBASE: <REBASED | PUSHED | CONFLICT | LEASE_REJECTED | PUSH_REJECTED | KEPT | DISCARDED | BLOCKED | ERROR>
Action: <rebase | push | keep | discard>
Approval record: <valid | missing | digest-mismatch | n/a>
Head remote: <head remote | n/a>
Head branch: <head branch | n/a>
Base SHA: <full SHA | n/a>
Old head SHA: <full SHA | n/a>
New head SHA: <full SHA | n/a>
Commits before: <commit count | n/a>
Commits after: <commit count | n/a>
Patches changed: <patch differences | none | n/a>
Conflict paths: <paths | none>
Backup ref: <local backup ref | n/a>
Push command: <push command | n/a>
Push extras: <none | settings joined by "; ">
Remote head after: <full SHA | n/a>
Worktree removed: <yes | no>
Checkout unchanged: <yes | no>
Local branch: <moved | created | unchanged | n/a>
Kept ref: <ref | n/a>
Uncommitted changes preserved: <yes | no | n/a>
Reason: <one line>
Decision needed: <none | next action>
```

`REBASED` requires action `rebase`, three full SHAs, and distinct old and new heads. `CONFLICT` identifies conflict paths. Both require the temporary worktree removed and the checkout unchanged. `PUSHED` requires action `push`, a confirmed remote head equal to the new SHA, and a backup under `refs/pr-creator/backup/`. `LEASE_REJECTED` means the pinned lease no longer matched; report `Backup ref: n/a` after removing both attempt refs and state in `Reason` that nothing was published; `PUSH_REJECTED` means another push rejection. `BLOCKED` and `ERROR` name an unmet precondition or unexpected failure.

`KEPT` follows a `keep` choice. If the local branch moved or was created, report its ref under `refs/heads/` and whether uncommitted changes were preserved (`yes` or `n/a`). If the branch is unchanged, report this run’s `refs/pr-creator/<run-id>/rebased` as the kept ref. `DISCARDED` follows a `discard` choice: the checkout is unchanged and no ref is kept. Both require `Approval record: n/a` and `Backup ref: n/a`. Rebase and push outcomes reporting a write or attempted write require a valid approval record. `Push extras` lists active `key=value` git settings only, without URL credentials or dry-run rows.
