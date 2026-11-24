# Rebase a published head

Current-state reference. Update when source selection, the rebase or lease push, or local settlement changes.

## Select the source and make one offer

Use fresh preflight pins and start from the published tip. Show `Local head state` as a fact. Withhold a published-source replay over 200 commits. Set `Offer source: none` and give the reason. When preflight continues with `PASS` or `PR_EXISTS` and no offer, use the published tip for `Source SHA` and its count for `Source behind base`.

After `PREFLIGHT: PASS` or `PR_EXISTS`, if the offer is open and fewer than two stale leases have occurred:

- If `Offer source` is `published` and `Source behind base` is greater than zero, offer `GateRebase` unless `REBASE=never`. The count is `git rev-list --count <source_sha>..<base_sha>`.
- Otherwise continue from the published head. Report why a base that is ahead of the source did not lead to a proposal.

Remember a decline or a completed offer. Only a stale lease reopens the offer with fresh pins. At two stale leases, make no further offer.

## GateRebase

Fill in names, counts and full SHAs in both proposals. Apply the [approval protocol](./approval-protocol.md) to each gate separately.

Before showing this block, save `$RUN_DIR/rebase-values.json` and run `python3 -I "$SKILL_DIR/scripts/validate-output.py" digest <kind> < "$RUN_DIR/<kind>-values.json" | tee "$RUN_DIR/pending.json"` with `<kind>` replaced by `rebase`. Let the JSON appear unchanged in tool output: do not capture it in a variable, redirect it away, or replace it with an exit code. Never copy a digest into a reply to the user. Stop unless the digest succeeds and the receipt is saved.

```text
Published head: <head_remote>/<head_branch> at <old_head_sha>
Base: <base_remote>/<target_branch> at <base_sha>
Source to replay: published tip at <source_sha>
Source behind base: <count> commits
Local head state: <preflight fact>
Repository hooks run. Your checkout and local branches stay as they are.
Yes prepares a local result for inspection. No continues from the published head. Neither pushes.
Rebase this source onto the pinned base in a temporary detached worktree?
```

A pending question waits. A stop cancels; a decline continues from the published head. Only an approval recorded for `rebase` dispatches the local action. `sourceSha` is the starting commit. `oldHeadSha` is always the published tip and the only lease. After checking its record, the specialist runs:

```sh
git worktree add --detach "$RUN_DIR/rebase" <source_sha>
GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true git -C "$RUN_DIR/rebase" -c rebase.updateRefs=false -c rebase.autoSquash=false -c rebase.autoStash=false -c rerere.enabled=false rebase <base_sha>
```

Refuse a head named like the target or default branch, merges in `base_sha..source_sha`, shallow history or missing objects, a result with no commits ahead of the base, and missing or mismatched approval. Return `BLOCKED` with no branch or checkout changes. The only settings that rule out the branch push itself are a mirror remote and `push.recurseSubmodules=only`; report the [specific limitation](./execution-contracts.md#push-proposals-and-reports) and block before rebasing. Preflight withholds the offer under either limitation. Disclose `push.followTags`, a differing push URL or `push.recurseSubmodules=on-demand` instead of refusing them.

If a worktree was created, remove it before reporting a clean stop. On conflict, collect the paths, run `git -C "$RUN_DIR/rebase" rebase --abort`, then `git worktree remove "$RUN_DIR/rebase"`. Never resolve, skip or continue. Report the paths and end the run without creating or editing a PR. A rerun can decline the offer and use the published head.

Only a clean rebase with verified ancestry, counts, both run refs, a removed worktree and an unchanged checkout reaches the second gate.

## GateForcePush

Use the template below for this run's rebase result. An existing open PR gets the URL line exactly as shown. Fill the [push settings block](./execution-contracts.md#push-proposals-and-reports) from `REBASED`. Start it with "Under your git settings this command also sends:", list one line per setting with its effect, and end it with "The individual refs are not listed." With no settings use "This command publishes only this branch."

Before showing this block, save `$RUN_DIR/force-push-values.json` and run `python3 -I "$SKILL_DIR/scripts/validate-output.py" digest <kind> < "$RUN_DIR/<kind>-values.json" | tee "$RUN_DIR/pending.json"` with `<kind>` replaced by `force-push`. Let the JSON appear unchanged in tool output: do not capture it in a variable, redirect it away, or replace it with an exit code. Never copy a digest into a reply to the user. Stop unless the digest succeeds and the receipt is saved.

```text
Rewrite the published branch <head_remote>/<head_branch>?
Old tip: <old_head_sha>
New tip: <new_head_sha>
Pinned base: <base_remote>/<target_branch> at <base_sha>
Local head state: <preflight fact>
Source: this run's rebase result
Commits ahead of base: <before> before, <after> after
Patches changed per git range-diff: <number, including additions and removals>
Git re-creates commits with the local committer identity. Existing signatures do not carry over.
Repository hooks run during the push.
The open PR <URL> will show the rewritten commits.
Command: git push --force-with-lease=refs/heads/<head_branch>:<old_head_sha> <head_remote> <new_head_sha>:refs/heads/<head_branch>
<push settings block>
Backup: refs/pr-creator/backup/<run-id> at <old_head_sha>
The backup exists only on this machine.
Restore command (yours to run, never the skill's): git push --force-with-lease=refs/heads/<head_branch>:<new_head_sha> <head_remote> <old_head_sha>:refs/heads/<head_branch>
Approve this exact command? If you decline or request a change, nothing is pushed.
```

Only `branch-rebaser` may execute a force form. Preflight carries none. The only form the skill may execute is the **Command** above, after verifying a separate `force-push` record for those SHAs. The lease is the published tip the user saw. With `source: rebase`, the new tip must be this run's approved rebase result on the pinned base. The restore command is for the user only. `--force`, an unpinned `--force-with-lease`, `+refspec`, and branch deletion are forbidden.

Re-read the settings before pushing and block if they differ. Do not retry a push or alter a lease. On `LEASE_REJECTED`, remove the attempt's recorded refs with their expected values: the rebased ref, if present, at the new SHA and the backup, if present, at the old SHA. Delete both together in one `git update-ref --stdin` transaction when both exist. If deletion fails, stop with `ERROR`. Otherwise report `Backup ref: n/a` and say in `Reason` that nothing was published by this attempt; return to preflight for fresh pins. Other definite rejections stop the run. An uncertain outcome or failed readback is an error; do not claim nothing changed.

A pending question waits; an explicit stop cancels. After a rebase this run produced, a decline or change request goes to `GateRebaseResult` instead.

## GateRebaseResult and settlement

Ask: "Nothing was pushed. Do you want to `preserve` the rebased result locally or `discard` it?" This is a choice, not approval. Write no approval record. If the user answers neither choice, ask again with both choices. If the user stops, cancel and clean up both refs. Otherwise `SettleRebase` runs the matching action.

For `preserve`, `branch-rebaser` rechecks the current ref and worktree conditions and takes the first applicable row. Here `<b>` is the selected head branch, `<local>` its freshly read tip and `<new>` this run's verified rebased tip.

| Case | Condition | Command |
| --- | --- | --- |
| No local branch | The ref is absent. | `git branch <b> <new>` |
| Local branch checked out nowhere | Its tip is the replayed source or an ancestor of that source. | `git update-ref refs/heads/<b> <new> <local>` |
| Local branch checked out in this checkout | Same ancestry condition; no staged change and no merge, rebase, cherry-pick or bisect in progress. | `git reset --keep <new>` |
| Otherwise, or the command aborts | Leave the checkout and local branch as they were. | Keep aside this run's `refs/pr-creator/<run-id>/rebased`. |

Compare HEAD, the branch ref, other local refs, `git status --porcelain` and a digest of `git diff` before and after. Verify only the expected HEAD and ref moves occurred and that status and the diff digest match. For a fallback, verify the checkout and branch are unchanged before reporting `KEPT`. If the result was kept aside, report that ref and leave it through cleanup. If verification fails, report the error and evidence rather than claiming `KEPT`. On either verified preserve outcome, remove the run's backup at the expected old SHA and report `Backup ref: n/a`. When the local branch holds the result, remove the rebased ref at the expected new SHA in the same transaction.

For `discard`, delete the run's rebased and backup refs together in one `git update-ref --stdin` transaction with their expected new and old SHAs respectively. Verify both refs are gone and the checkout and local branch are unchanged. Report `DISCARDED` and no kept ref only after that verification.

After either verified result, mark the offer declined and continue through `ContinueRequest` with the published head and pins unchanged. Use the [settlement report](./execution-contracts.md#stop-or-suspension-reply) in the reply, the preview note and the final report.

## After a verified push

Re-pin in preflight; report a base that moved again rather than offering another rebase. In the final report show the original SHA, the retained `refs/pr-creator/backup/<run-id>` and the expanded user-run restore command above. Include: "The backup exists only on this machine." After a push with extras, use the [settings report](./execution-contracts.md#push-proposals-and-reports).

The push did not move the local branch. After a verified push, show the expanded `git reset --keep <new_head_sha>` only as a user-run hint with `<head_branch>` checked out at `<old_head_sha>`, after saving local work and confirming they want the published history. If the local tip differs, preserve its commits first; do not recommend a blind reset. The skill runs neither recovery command.
