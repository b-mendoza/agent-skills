# Rebase or publish a rewritten head

Current-state reference. Update when source selection, the rebase or lease push, or local settlement changes.

## Select the source and make one offer

On both the create and existing-PR paths, use fresh preflight pins. An existing PR with `EXISTING_PR=stop`, or an existing-PR action request with no open PR, stops before the offer. Start from the published tip unless a local `<head_branch>` exists and has diverged from it. A diverged local branch can be the source even when it is not checked out. Show `Local head state` as a fact.

For diverged tips, preflight compares each branch's series against its own merge-base with the pinned base. Run `git range-diff --no-color --no-patch <mbP>..<published> <mbL>..<local>`, where `<mbP>` is the published tip's merge-base with the base and `<mbL>` is the local tip's merge-base with the base. Read the sign on each row:

| Sign | Meaning |
| --- | --- |
| `=` | Identical pair. |
| `!` | Differing pair. Keep both SHAs and the subject. |
| `>` | Local-only commit. Keep its SHA and subject. |
| `<` | Published-only commit. Keep its SHA and subject. |

Any `<` means `Offer source: none`. Name the published-only commits. For a checked-out head with no open PR, preflight returns `HEAD_BRANCH_UNPUSHED` and the run stops. For a named branch not checked out, or with an open PR, report the withheld offer and continue from the published head. Count each range before comparing. If either exceeds 200 commits, withhold the offer. Also withhold a published-source replay over 200 commits. Use the [preflight contract](./preflight-validator-contract.md) limit of 20 rows per list; name any omissions and withhold a local offer if it would hide differences. For these limits use `Offer source: none` and give the reason. When preflight can continue with `PASS` or `PR_EXISTS` and no offer, use the published tip for `Source SHA` and its count for `Source behind base`. Pairing is git's heuristic. A `!` row calls for review, not an assertion that the two commits do the same thing.

If every row is `=` and `<mbL>` is a strict ancestor of `<mbP>`, the local tip is an older copy of the same series. Set `Offer source: published` and leave the three commit lists empty. Explain the local state and give the `git reset --keep` hint below. Otherwise, with no `<`, use the local tip and keep the differing pairs and local-only commits for the force-push proposal.

After `PREFLIGHT: PASS` or `PR_EXISTS`, if the offer is open and fewer than two stale leases have occurred:

- If `Offer source` is `published` or `local` and `Source behind base` is greater than zero, offer `GateRebase` unless `REBASE=never`. The count is `git rev-list --count <source_sha>..<base_sha>`.
- If `Offer source` is `local` and `Source behind base` is zero, go directly to `GateForcePush`. This publishes without rebasing, so `REBASE=never` does not prevent the offer.
- Otherwise continue from the published head. Report why a base that is ahead of the source or a local branch that was not offered did not lead to a proposal.

Remember a decline or a completed offer. Only a stale lease reopens the offer with fresh pins. At two stale leases, make no further offer.

## GateRebase

Fill in names, counts and full SHAs in both proposals. Apply the [approval protocol](./approval-protocol.md) to each gate separately.

Before showing this block, save `$RUN_DIR/rebase-values.json` and run `python3 -I "$SKILL_DIR/scripts/validate-output.py" digest <kind> < "$RUN_DIR/<kind>-values.json" | tee "$RUN_DIR/pending.json"` with `<kind>` replaced by `rebase`. Let the JSON appear unchanged in tool output: do not capture it in a variable, redirect it away, or replace it with an exit code. Never copy a digest into a reply to the user. Stop unless the digest succeeds and the receipt is saved.

```text
Published head: <head_remote>/<head_branch> at <old_head_sha>
Base: <base_remote>/<target_branch> at <base_sha>
Source to replay: <published tip | local branch tip> at <source_sha>
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

Use the template below for either source. Include the differing pairs and local-only commit lists whenever the commits come from the local branch, including after rebasing a local source. Show `none` for an empty list. Use the rebase detail lines only for this run's rebase result. For direct publication, say that the new tip is the local branch tip, which already contains the pinned base, and no rebase runs. The backup line describes the ref that will be recorded before the direct push, not a ref already created. An existing open PR gets the URL line exactly as shown. Fill the [push settings block](./execution-contracts.md#push-proposals-and-reports) from `REBASED` for a rebase result or from preflight for direct publication. Start it with "Under your git settings this command also sends:", list one line per setting with its effect, and end it with "The individual refs are not listed." With no settings use "This command publishes only this branch."

Before showing this block, save `$RUN_DIR/force-push-values.json` and run `python3 -I "$SKILL_DIR/scripts/validate-output.py" digest <kind> < "$RUN_DIR/<kind>-values.json" | tee "$RUN_DIR/pending.json"` with `<kind>` replaced by `force-push`. Let the JSON appear unchanged in tool output: do not capture it in a variable, redirect it away, or replace it with an exit code. Never copy a digest into a reply to the user. Stop unless the digest succeeds and the receipt is saved.

```text
Rewrite the published branch <head_remote>/<head_branch>?
Old tip: <old_head_sha>
New tip: <new_head_sha>
Pinned base: <base_remote>/<target_branch> at <base_sha>
Local head state: <preflight fact>
<source: this run's rebase result or the local branch tip, without a rebase>
<local source: full differing pairs and local-only commits with subjects>
<rebase only: Commits ahead of base: <before> before, <after> after>
<rebase only: Patches changed per git range-diff: <number, including additions and removals>>
<rebase only: Git re-creates commits with the local committer identity. Existing signatures do not carry over.>
Repository hooks run during the push.
The open PR <URL> will show the rewritten commits.
Command: git push --force-with-lease=refs/heads/<head_branch>:<old_head_sha> <head_remote> <new_head_sha>:refs/heads/<head_branch>
<push settings block>
Backup: refs/pr-creator/backup/<run-id> at <old_head_sha>
The backup exists only on this machine.
Restore command (yours to run, never the skill's): git push --force-with-lease=refs/heads/<head_branch>:<new_head_sha> <head_remote> <old_head_sha>:refs/heads/<head_branch>
Approve this exact command? If you decline or request a change, nothing is pushed.
```

Only `branch-rebaser` may execute a force form. Preflight carries none. The only form the skill may execute is the **Command** above, after verifying a separate `force-push` record for those SHAs. The lease is the published tip the user saw. With `source: rebase`, the new tip must be this run's approved rebase result on the pinned base. With `source: local-branch`, it must still be the exact local branch tip and contain the pinned base. Before a direct push, the rebaser repeats the series check and requires no `<` row and no undisclosed differing pair or local-only commit. Both sources require a counterpart for every published commit when the commits come from the local branch. The restore command is for the user only. `--force`, an unpinned `--force-with-lease`, `+refspec`, and branch deletion are forbidden.

For direct publication the rebaser records the backup at the published tip before pushing. In either case re-read the settings before pushing and block if they differ. Do not retry a push or alter a lease. On `LEASE_REJECTED`, remove the attempt's recorded refs with their expected values: the rebased ref, if present, at the new SHA and the backup, if present, at the old SHA. Delete both together in one `git update-ref --stdin` transaction when both exist. If deletion fails, stop with `ERROR`. Otherwise report `Backup ref: n/a` and say in `Reason` that nothing was published by this attempt; return to preflight for fresh pins. Other definite rejections stop the run. An uncertain outcome or failed readback is an error; do not claim nothing changed.

A pending question waits; an explicit stop cancels. Declining or requesting a change after a direct publish proposal does not move the local branch, leaves nothing to settle, and continues through `ContinueRequest` from the published head. After a rebase this run produced, a decline or change request goes to `GateRebaseResult` instead.

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

The push did not move the local branch. After a verified push, show the expanded `git reset --keep <new_head_sha>` only as a user-run hint with `<head_branch>` checked out at `<old_head_sha>`, after saving local work and confirming they want the published history. If the local tip differs, preserve its commits first; do not recommend a blind reset. For an older copy verified by the series tie-break, the equivalent hint uses the pinned published SHA and requires the checked-out branch still to be at the compared local tip, with local work saved. The skill runs neither recovery command.
