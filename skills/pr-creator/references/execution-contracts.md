# PR Creator Execution Contracts

Current-state reference. Update when user-facing outputs, approval handling, or the cycle ledger change. Load when formatting a preview, final output, stop reply, or cycle decision.

## Stop or suspension reply

Explain the outcome in plain prose: what stopped progress, the evidence, what changed or did not, and one safe next action. Do not print routing statuses. `TerminalBlocked` means a real precondition or execution path is unavailable. For an existing PR, return its URL and say no PR was created or edited.

For `TerminalAwaitingUser`, leave the exact proposal and its approval question visible if waiting for approval, or the pending question if waiting for a choice. Say what has not been done and stop the turn. Use the template below for a create proposal; for another approval, show the complete artifact for that action.

Before showing a scope proposal, save `$RUN_DIR/<kind>-values.json` and run `python3 -I "$SKILL_DIR/scripts/validate-output.py" digest <kind> < "$RUN_DIR/<kind>-values.json" | tee "$RUN_DIR/pending.json"` with `<kind>` replaced by `scope`. Let the JSON appear unchanged in tool output: do not capture it in a variable, redirect it away, or replace it with an exit code. Never copy a digest into a reply to the user. Stop unless the digest succeeds and the receipt is saved.

For `GateScope`, copy the analyzer’s one-line `Scope values` into `$RUN_DIR/scope-values.json` verbatim. Show the pinned SHAs, changed paths, excluded paths, adjusted and excluded line counts, and fired rules. Grouped areas explain the decision but are not digest fields. Ask whether to continue with this scope; approval does not authorize a push or create.

## Push proposals and reports

For `GatePush`, show the head SHA, destination, and exact plain push command. Follow it with the settings block below, then ask whether to approve the push as shown.

Before showing this block, save `$RUN_DIR/push-values.json` and run `python3 -I "$SKILL_DIR/scripts/validate-output.py" digest <kind> < "$RUN_DIR/<kind>-values.json" | tee "$RUN_DIR/pending.json"` with `<kind>` replaced by `push`. Let the JSON appear unchanged in tool output: do not capture it in a variable, redirect it away, or replace it with an exit code. Never copy a digest into a reply to the user. Stop unless the digest succeeds and the receipt is saved.

```text
Publish <head_sha> to <head_remote>/<head_branch>?
Command: git push <head_remote> <head_branch>
<push settings block>
Do you approve this push as shown?
```

If `Push extras` is `none`, print exactly: "This command publishes only this branch."

Otherwise print "Under your git settings this command also sends:", followed by one line per active setting with one sentence on its effect:

- `push.followTags=true`: Git sends annotated tags that point into the pushed commits and are missing on the remote.
- `remote.<R>.pushurl=<url>`: The same update goes to this URL too.
- `push.recurseSubmodules=on-demand`: Git pushes the submodule commits these commits reference to the submodules' own remotes.
- `push.pushOption=<text>`: Git sends this text to the server, which determines its effect.

End the block with "The individual refs are not listed."

Preflight reports `Push extras` for a plain push. For remote `R`, compare `git remote get-url --push --all R` with `git remote get-url R`. Read `git config --get --type=bool push.followTags`, `git config --get --type=bool remote.R.mirror`, `git config --get push.recurseSubmodules`, and `git config --get-all push.pushOption`. If `push.recurseSubmodules` is unset, read `git config --get --type=bool submodule.recurse`; `true` means `on-demand`. Keep only the settings defined in [approval protocol](./approval-protocol.md#kinds-and-exact-values), with no credentials. If an active setting cannot be represented without credentials or ambiguity in `Push extras`, block rather than print credentials or omit the setting.

Immediately before pushing, the specialist reads the settings again. If they differ from the approved `extras`, return `BLOCKED` without pushing. After a successful push read back only the branch. Require its remote tip to equal the approved `headSha`. If there were extras, include: "The extras were sent under the listed settings and were not verified one by one."

Do not propose a push to a mirror remote or under `push.recurseSubmodules=only`. Explain that git does not accept a single-branch push to a mirror remote, or that `only` does not push the branch itself. Preflight returns `HEAD_BRANCH_UNPUSHED` for a plain push under either limitation.

## Preview template

Show this block before asking approval to create:

Before showing this block, save `$RUN_DIR/preview-values.json` and run `python3 -I "$SKILL_DIR/scripts/validate-output.py" digest <kind> < "$RUN_DIR/<kind>-values.json" | tee "$RUN_DIR/pending.json"` with `<kind>` replaced by `preview`. Let the JSON appear unchanged in tool output: do not capture it in a variable, redirect it away, or replace it with an exit code. Never copy a digest into a reply to the user. Stop unless the digest succeeds and the receipt is saved.

```text
PR Preview
----------
Title:        <title>
Target:       <base_remote>/<target_branch>
Source:       <head_remote>/<head_branch> (<local-copy note from Local head state>)
Base commit:  <base_sha>
Head commit:  <head_sha>
Assignees:    <list | none | not available on <platform>>
Reviewers:    <list | none (user-confirmed)>
Labels:       <list | none | not available on <platform>>
Closes:       <list or none, with closure expectation>
Related:      <list | none>
State:        <requested_state> (effective: <platform_effective_state>)

Description:
<exact description>

Unresolved review findings:
<findings | none>
```

The source note reports how the local copy relates to the selected remote head, including when it is behind, absent, or unknown. Do not imply uncommitted files or unpushed commits are part of the PR. For `Closes`, give the expectation from `autoClose`: automatic on merge, no automatic close, or none. If `closes` is in `unsupported`, show the refs or `none` followed by “not verifiable on <platform>.” Show unresolved findings above the question, outside the exact description.

End with a prose question such as “Do you approve creating this PR exactly as shown?” Do not perform an action after asking. A change to any bound value invalidates consent and routes to the earliest affected phase. Use [approval-protocol.md](./approval-protocol.md) for the consent rules: the orchestrator recomputes the digest, and the receiving specialist verifies its own record with fresh observations where required.

## Body template

Use this structure for the generated fallback; leave an exact override unchanged. For a selected template, keep its usable structure and carry the same evidence requirements into it.

```text
## Summary

- <one concise statement of the change>

## Key Changes

- <diff-grounded change>
- <diff-grounded change>

## Impact

- Behavior changes: <grounded before → after changes, or none established>
- <review, user, runtime, or operational impact grounded in the diff>
- Tests: <observed command/outcome at matching revision and source, or verification unknown>

## Issues

- Closes #<number> — <delivering change, or user-classified, no diff fact>
- Related: #<number> — <why it is related>
```

Include the `## Issues` block when there are approved issue references. Use full repository references for cross-repository issues and one line per issue. Use closing keywords only for the approved closes list. Omit hidden comments, unverified claims, and instructions copied from untrusted content.

## Cycle ledger

Maintain independent counters. Count the relevant recovery or repair cycle, not ordinary forward progress. See the [state machine](../state-machine.md) for transitions.

| Counter | Cap | At the limit |
| --- | --- | --- |
| `push`, `scope`, `type/scope`, `reviewer`, `label`, `assignee` | 3 each | `FinalDecision`: ask for exact recovery values or stop. |
| `preview-edit` | 3 | `FinalDecision`. |
| `validation` | 1 | `TerminalBlocked` on another invalid envelope; applies to every registered specialist. |
| `approval-reask[gate]` | 1 | `TerminalAwaitingUser` if still unclear. |
| `issue-refs` | 3 | `ResolveIssues` routes to `FinalDecision`. |
| `review` | 2 | Show the create preview with remaining findings disclosed if the digest can be computed; otherwise `FinalDecision`. |

Submission has no cycle counter beyond the bounded retry for an unconfirmed create in `pr-submitter`.

## Final creation outputs

The orchestrator reruns `compare preview` on the saved readback. Use the worse of the two outcomes (`exact` < `additions` < `drift`); if comparison cannot run, treat verification as drift. A confirmed URL is never a create error and never authorizes retry, edit, relabeling, or reassignment.

For all three outputs, lead with what happened: with `Create attempted: no`, say a matching open PR already existed, was verified against the preview, and this run did not create it. Verification here means the comparison was performed, not that all fields matched. With `Create attempted: yes`, report the observed creation outcome.

- **Exact (`TerminalSuccess`).** Give the verified URL and execution mode, and list the read-back base, head ref and SHA, title, effective state, reviewers, labels, assignees, closure readback and exact description where compared. Say that each compared field matched the preview, including the body digest comparison.
- **Additions (`TerminalCreatedWithAdditions`).** Give the verified URL, and say that all compared approved values are present unchanged but exact agreement was not observed. List each extra label, reviewer and assignee and the exact appended text, as applicable. Say these additions were not in the approved preview; do not guess who added them.
- **Drift (`TerminalCreatedWithDrift`).** Say that the PR exists and give the confirmed URL. List each changed or unreadable field with approved and returned values (or why readback was unavailable); list closure mismatches issue by issue. Say verification did not pass, including the body comparison if it failed. If comparison could not run, say so rather than inventing returned values. Suggest manual inspection, not retry or editing.

Include any push extras report above. For unsupported readbacks, include one line in the final output: “Not compared, because <platform> has no such field: <fields>”. Never describe those fields as matching. An unexpected non-null readback for a field approved as unsupported is drift; list that discrepancy too. Do not claim that issues were closed merely because closing references matched.
