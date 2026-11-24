---
name: "branch-rebaser"
description: "Replay the approved source in a detached worktree, publish a pinned head, or settle an unpublished rebase after the user's choice."
---

# Branch rebaser

Perform one action per dispatch. A rebase approval never authorizes a push.

## Inputs

| Input | Meaning |
| --- | --- |
| `ACTION` | `rebase`, `push`, `keep` or `discard` |
| `HEAD_REMOTE`, `HEAD_BRANCH` | Named head remote and short branch name |
| `BASE_REMOTE`, `TARGET_BRANCH` | Named base remote and short target branch name |
| `BASE_SHA`, `OLD_HEAD_SHA` | Full pinned base and published head commit IDs |
| `SOURCE_SHA` | Commit the rebase replays; use the recorded source when settling that rebase |
| `NEW_HEAD_SHA` | Full result of this run's rebase, or the local tip for direct publish |
| `SOURCE` | Push only: `rebase` or `local-branch` |
| `APPROVAL_RECORD`, values file path | For rebase or push: this run's matching record and `RUN_DIR/<kind>-values.json` |
| `CONTRACT_PATH` | Resolved `references/branch-rebaser-contract.md` |
| `SKILL_DIR`, `RUN_DIR`, `MUTATION_LIMITS` | Absolute package root, recorded run directory and unchanged write limits |

## Instructions

Work from the repository root. Reject redirected or symlinked run paths. If `RUN_DIR` is inside the repository, require `git check-ignore --quiet -- "$RUN_DIR/probe"`; otherwise require the approved external scratch directory. Derive `<run-id>` from its final component. Construct and validate this run's refs yourself: `refs/pr-creator/<run-id>/rebased` and `refs/pr-creator/backup/<run-id>`. Require direct refs, valid short branch names, configured non-option remote names and full commit IDs. Pass expanded arguments literally, never as shell code; brace shell variables before a colon, e.g. `"${NEW_HEAD_SHA}:refs/heads/${HEAD_BRANCH}"`.

Before any write, refuse the target branch and either remote's default branch as head (`git ls-remote --symref <remote> HEAD`; block if unknown). For rebase or push refuse shallow or unrelated history, missing required objects or a merge in the published or replay series; do not fetch to repair it. Snapshot the user's `git rev-parse HEAD`, `git for-each-ref refs/heads`, `git status --porcelain` and digest of `git diff` with `GIT_OPTIONAL_LOCKS=0`. Repeat on every exit after an attempted write; unexpected differences mean `ERROR`, never a repair.

### Settings and approval

For rebase or push, require one fetch URL for the head remote. Compare `git remote get-url --push --all R` with `git remote get-url R` for head remote `R`. Read `git config --get --type=bool push.followTags`, `git config --get --type=bool remote.R.mirror`, `git config --get push.recurseSubmodules` (if unset, `git config --get --type=bool submodule.recurse`; true means `on-demand`), and `git config --get-all push.pushOption`. A mirror rejects a single-branch refspec; recursion `only` does not push the branch. Return `BLOCKED` with the limitation before rebasing or pushing. Sort active settings: `push.followTags=true`, `remote.R.pushurl=<url>` for each differing push URL, `push.recurseSubmodules=on-demand`, `push.pushOption=<text>` per option. Use the actual remote name; no inferred ref list. Block on unreadable or ambiguous settings or credentials rather than exposing them. Join settings with `; ` in `Push extras`, or report `none` for `extras: []`.

Before any rebase or push write, construct the values from the actual arguments. For `rebase` use exactly `baseRemote targetBranch baseSha headRemote headBranch oldHeadSha sourceSha`. For `force-push` use `headRemote headBranch baseSha oldHeadSha newHeadSha source extras action`, with `action` the literal expanded command below. Require equality with the values file. Pipe `{"values": <actual values>, "approval": <APPROVAL_RECORD>}` to `python3 -I "${SKILL_DIR}/scripts/validate-output.py" verify <kind>`; require exit 0 yourself or return `BLOCKED`, nothing changed.

### Rebase

1. Re-read the selected remote refs and require both pins. If `SOURCE_SHA` differs from the published tip, require it to be the diverged named local tip and repeat the series check below, including disclosure limits. Require a fresh worktree path and unused run refs (an existing backup is acceptable only at the same old tip). Count `git rev-list --count <base_sha>..<source_sha>`. Run:

   ```sh
   git worktree add --detach "$RUN_DIR/rebase" <source_sha>
   GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true git -C "$RUN_DIR/rebase" -c rebase.updateRefs=false -c rebase.autoSquash=false -c rebase.autoStash=false -c rerere.enabled=false rebase <base_sha>
   ```

2. On conflict, capture unmerged paths in the detached worktree before `git -C "$RUN_DIR/rebase" rebase --abort`, then `git worktree remove "$RUN_DIR/rebase"`. Report `CONFLICT` only after confirming cleanup and the checkout snapshot. Never resolve, skip or continue. On other failures abort an active rebase, remove only this dispatch's worktree and report any incomplete cleanup.
3. Read detached `HEAD` as the new tip. Require `git merge-base --is-ancestor <base_sha> <new_head_sha>` and count `git rev-list --count <base_sha>..<new_head_sha>`. If zero or the new tip equals the published tip, remove the worktree and return `BLOCKED` without recording refs or pushing. With `git range-diff --no-color --no-patch <base_sha>..<source_sha> <base_sha>..<new_head_sha>`, count `!`, `<` and `>` summary rows, not `=`. In one `git update-ref --stdin` transaction create the rebased ref at the new tip and the backup at `OLD_HEAD_SHA` (verify an identical existing backup rather than overwrite it). Remove the worktree, confirm removal and compare the checkout snapshot. Return `REBASED` with counts, backup, proposed command and current `Push extras`. Stop.

### Push

Require that the new tip contains the pinned base and has commits ahead. For `SOURCE=rebase`, require this run's rebased ref at `NEW_HEAD_SHA` and backup at `OLD_HEAD_SHA`. For `SOURCE=local-branch`, run no rebase command. Immediately before writing, require the named local tip still equals `NEW_HEAD_SHA`, diverges from `OLD_HEAD_SHA`, and passes this read-only series check:

- Take `mbP` and `mbL` as the respective merge-bases of the published and local tips with `BASE_SHA`. Count each range; block if either exceeds 200. Run `git range-diff --no-color --no-patch <mbP>..<published> <mbL>..<local>`. Read each sign: `=` same, `!` differing pair, `>` local-only, `<` published-only. Require no `<`, no undisclosed differing pair or local-only commit, and complete, verifiable output. Never publish a truncated series disclosure.

For either source, check the remote head against `OLD_HEAD_SHA`: a moved or deleted head is `LEASE_REJECTED`, even if already at the new tip. For direct publish create this run's backup ref create-only at that published tip; no rebased ref is needed. Immediately before sending, repeat the settings check and require exact equality with approved `extras`; any difference means `BLOCKED`, nothing pushed. Run exactly once:

```sh
git push --force-with-lease=refs/heads/<head_branch>:<old_head_sha> <head_remote> <new_head_sha>:refs/heads/<head_branch>
```

Never retry or change the lease. A stale lease or an already-up-to-date no-op is `LEASE_REJECTED`; another definite rejection is `PUSH_REJECTED`. On a definite stale lease with no publication, remove this attempt's refs in one `git update-ref --stdin` transaction with expected SHAs (direct publish: only its backup, if created). Report `Backup ref: n/a` and say nothing was published by this attempt. Failed cleanup, partial or uncertain publication, or failed readback is `ERROR`, not a claim that nothing changed. Require success and `git ls-remote <head_remote> refs/heads/<head_branch>` returning exactly `NEW_HEAD_SHA` for that ref before `PUSHED`. Then delete this run's rebased ref, if it exists, with its expected SHA: the published branch now holds those commits. Keep the backup. Only the branch is read back; extras were sent under the listed settings and not verified one by one.

### Keep or discard

Require the user's `preserve` or `discard` answer for this run's unpublished rebase and both run refs at their recorded new and old tips. These are choices, not approval records; `KEPT` and `DISCARDED` carry `Approval record: n/a` and `Backup ref: n/a`.

For `keep` after `preserve`, let `<b>` be only `HEAD_BRANCH` and `<new>` this run's rebased tip. Immediately re-check the branch ref, occupancy across **all** worktrees (`git worktree list --porcelain`), and checkout snapshot yourself. Run at most one branch-changing command:

| Condition | Action |
| --- | --- |
| No local branch; not checked out anywhere (including unborn branches) | `git branch <b> <new>` |
| Checked out nowhere; `<local>` equals or is an ancestor of `SOURCE_SHA` | `git update-ref refs/heads/<b> <new> <local>` |
| Checked out here only; same ancestry; no staged changes and no merge, rebase, cherry-pick or bisect in progress | `git reset --keep <new>` |
| Otherwise, or the command aborts | Keep this run's rebased ref aside; do not try another command. |

Compare `HEAD`, the branch ref, all other local refs, porcelain status and diff digest before and after. Only the intended branch may move or appear, at `<new>`; only a reset may move this checkout's `HEAD`. Status and diff digest must match, including on abort. If verification fails return `ERROR`, keep the refs and do not undo the change. On success remove the backup with its expected old SHA; when the branch holds the result also remove the rebased ref with its expected new SHA in the same transaction. Report `KEPT`: `Local branch` moved, created or unchanged; `Kept ref` the local head ref or the kept-aside rebased ref; `Uncommitted changes preserved` yes or n/a as verified.

For `discard`, delete **both** refs in one `git update-ref --stdin` transaction: `delete refs/pr-creator/<run-id>/rebased <new_head_sha>` and `delete refs/pr-creator/backup/<run-id> <old_head_sha>`. Require success, both refs absent and checkout unchanged before `DISCARDED` with `Kept ref: n/a`. Never retry a failed transaction without expected values. For either choice report what actually differs from the published head; if a kept local branch diverges, explain that `git pull` would merge the histories under merge behavior and a later run can offer publication. Nothing was published.

## Output Format

Read `CONTRACT_PATH`. Pipe the complete block on stdin: `printf '%s\n' "$block" | python3 -I "${SKILL_DIR}/scripts/validate-output.py" envelope branch-rebaser`. Return exactly that `REBASE` block after exit 0; never write a checker input file. Report cleanup failures in `Reason`.

## Scope

Only the detached worktree, this run's two refs and the approved push are in scope, except that `keep` may create or move the head branch to this run's rebased commit. Never delete a branch or run `git pull`, `git merge`, `git stash`, `git checkout` or `git switch` in the user's checkout. Never resolve a conflict, bypass hooks with `--no-verify`, add another push refspec, use `--force`, an unpinned lease or `+refspec`.

## Escalation

| Status | When |
| --- | --- |
| `REBASE: REBASED` | Detached replay verified, refs recorded, worktree removed and checkout unchanged. |
| `REBASE: PUSHED` | The approved push succeeded and branch readback matches. |
| `REBASE: CONFLICT` | Conflicted paths captured, rebase aborted, cleanup and checkout verified. |
| `REBASE: LEASE_REJECTED` | Lease stale or push a no-op; nothing published and attempt refs cleaned up. |
| `REBASE: PUSH_REJECTED` | Another definite rejection, with no uncertain or partial publication. |
| `REBASE: KEPT` | Preserve choice verified; branch or kept-aside ref holds the result and backup is gone. |
| `REBASE: DISCARDED` | Discard choice verified; both refs removed and checkout unchanged. |
| `REBASE: BLOCKED` | Approval, choice or safety precondition failed. |
| `REBASE: ERROR` | Unexpected failure, incomplete cleanup, unexpected checkout change or uncertain remote outcome. |
