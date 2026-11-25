# Scoped commit state machine

This is the single normative source for transitions, guards, retries, and terminals. Read it before intake; examples elsewhere are illustrative.

## Execution

Emit `Phase N/4 - Name` only on a real transition. Route on the tables; evaluate rows top to bottom, first match wins; never infer a status. Initialize `plan_rounds=0`, `approval_reasks=0`, `push_reasks=0`, and a per-payload `envelope_repairs=0`.
Every question names the missing input in prose and ends the turn. When every approved group has committed with `Preserved` equal, report the created commits and preservation evidence in prose.

1. `Phase 1/4 - Intake` (inline). Apply these routes to requested actions, not mentions or prohibitions such as “do not push” or “don't amend”. Before any dispatch, stop at the first applicable blocking route:

   | Request | Route |
   | --- | --- |
   | Amend or rewrite history | `BLOCKED`: “I cannot amend commits or rewrite history. No commits made. If you want a new local commit instead, ask for one.” |
   | A guaranteed maximum split is a condition | “I cannot guarantee that split. No commits made. Would you like the normal grouping instead?” End the turn. On yes, resume intake with normal grouping in the requested mode; otherwise stop without a plan. |

   Derive `RUN_MODE` from the current request in this order:
   - If the user asks for a commit plan without asking to commit (e.g. “Plan the commits for a.txt”), or requests a commit and says not to commit yet, use `plan-only`. A request to see the plan before committing (e.g. “Show me the plan before committing”) on its own is a commit request.
   - If the user requests a commit, use `commit` and require `COMMIT_REQUEST_QUOTE` verbatim, else `BLOCKED`.
   - Otherwise, use `BLOCKED`. A bare scope, skill invocation, or instruction not to commit without a request to plan or commit is insufficient.

   Derive `CHECKS=candidate` only when the user asks in words to verify each commit on its own tree; otherwise use `CHECKS=worktree`.

   Derive `PUSH_REQUESTED` in commit mode from an explicit request to push this series. Otherwise it is false. A push request does not confirm a push.

   When granularity is a preference, continue with normal grouping. Say “There is no granularity setting. I'll show the proposed grouping; at commit approval, use `revise: <change>` to adjust it.” In plan-only mode say “There is no granularity setting. I'll show the proposed grouping without committing.” Include the notice in the visible preview if not already stated.

   In either mode, resolve `SKILL_DIR`; run `sh "$SKILL_DIR/scripts/validate-output.sh" plan` on the plan envelope in Example A and require exit 0, else `TOOLS_MISSING`. `git rev-parse --is-inside-work-tree` must print `true`, else `BLOCKED`. Resolve repository root with `git rev-parse --show-toplevel` and run collection there. Require Python 3 (3.9+ for hunk listing), the collector, and `git rev-parse --show-object-format` reporting `sha1`; commit mode additionally needs Python 3.9+ and the candidate script; an unavailable capability or unsupported object format → `TOOLS_MISSING`; collector read failures → `ERROR` with no digest accepted. Any of `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `rebase-merge/`, `rebase-apply/`, `BISECT_LOG` under `git rev-parse --git-dir` → `BLOCKED`. `git symbolic-ref -q HEAD` non-zero → `DETACHED_HEAD=true` (warning, not a block). If an applicable higher-priority instruction requires another branch, `BLOCKED` before planning; ask the user to select it outside this workflow, never create or switch it under commit approval.

   - Without exclusions, set `SCOPE_FROZEN=false` and check path grammar; each path must exist in the worktree or in `HEAD`. Missing or ambiguous input (file and directory collide, glob-like) → ask one question. `git --literal-pathspecs status --porcelain -- <CHANGE_PATHS>` empty → `NO_SCOPED_CHANGES`.
   - With exclusions, ask “Which paths should I include, or should I start with all changes?” if the user named neither. Otherwise, from the root run `python3 -I "$SKILL_DIR/scripts/collect-state.py" resolve-scope (--all | --include=PATH ...) --exclude=PATH ...`, using one individually quoted argument per option (for example, `'--include=src/' '--exclude=src/generated/'`). Use only the collector's complete successful output, not a hand-filtered status listing.

     | Scope resolution | Route |
     | --- | --- |
     | Exit 0 with paths | Set `CHANGE_PATHS` to those lines and `SCOPE_FROZEN=true`. |
     | Exit 0 with no output | `NO_SCOPED_CHANGES`: “No eligible changes remain after exclusions. No commits made.” |
     | Missing capability | `TOOLS_MISSING`. |
     | Exit 2 | `ERROR`: “Scope resolution failed: <diagnostic>. No commits made.” |
     | Exit 3 | Ask “I cannot resolve this selection: <diagnostic>. What corrected scope should I use?” End the turn and resolve again on the answer. |

   Apply the file/directory collision check to frozen entries too; ask rather than interpreting a frozen file as a directory prefix.

2. `Phase 2/4 - Plan`. Include any requested hunk split and ordering in `USER_DECISIONS` as evidence of grouping intent. Dispatch the planner with `CHANGE_PATHS`, `SCOPE_FROZEN`, `COMMIT_STYLE`, `CONTEXT_QUERY`, `CONTEXT_LOCATION`, `VERIFICATION_HINT`, `CHECKS`, `DETACHED_HEAD`, `SKILL_DIR`, `MUTATION_LIMITS`, and `USER_DECISIONS` in the evidence block. `plan_rounds += 1`. Validate through `G_PLAN_ENVELOPE`.

   | Planner result                                       | Route                                                                   |
   | ---------------------------------------------------- | ----------------------------------------------------------------------- |
   | `COMMIT_PLAN: PASS` and `RUN_MODE=commit`             | `G_PLAN_APPROVAL`                                                       |
   | `COMMIT_PLAN: PASS` and `RUN_MODE=plan-only`          | `PLANNED_ONLY`                                                          |
   | `COMMIT_PLAN: NEEDS_DECISION` and `plan_rounds` < 3  | Ask the one question. A changed scope starts a new intake; otherwise append the answer to `USER_DECISIONS` and redispatch with the same scope. |
   | `COMMIT_PLAN: NEEDS_DECISION` and `plan_rounds` >= 3 | `BLOCKED`                                                               |
   | `COMMIT_PLAN: NO_CHANGES`                            | `NO_SCOPED_CHANGES`                                                     |
   | `COMMIT_PLAN: ERROR`                                 | `ERROR`                                                                 |

3. `Phase 3/4 - Gate` `G_PLAN_APPROVAL` (inline, see below).
4. `Phase 4/4 - Execute`. For each group in order, dispatch the executor with `SKILL_DIR`, `MUTATION_LIMITS`, the approved series `CHECKS`, and the group block verbatim as `APPROVED_GROUP` in the evidence block. If the host denies dispatch, take the first row below; otherwise validate through `G_EXECUTE_ENVELOPE` before routing.

   | Executor result                                           | Route                                                    |
   | --------------------------------------------------------- | -------------------------------------------------------- |
   | Host denies executor dispatch before an envelope exists | `BLOCKED`: name the group and host denial, list already-created commits; never retry inline, escalate permissions, or dispatch later groups |
   | `COMMIT_EXECUTE: PASS`                                    | Record the commit and verification evidence; execute the next group if any. After the last group, run `G_PUSH_APPROVAL` only if a push was requested and the upstream is usable; otherwise Final. |
   | `COMMIT_EXECUTE: DIVERGED`                                | `BLOCKED` naming the group                               |
   | `COMMIT_EXECUTE: HOOK_MUTATION`                           | `BLOCKED` naming the group and SHA                       |
   | `COMMIT_EXECUTE: VERIFY_FAILED`                           | `VERIFY_FAILED`                                          |
   | `COMMIT_EXECUTE: COMMIT_ERROR` (including hook rejection) | `COMMIT_ERROR`                                           |
   | `COMMIT_EXECUTE: ERROR`                                   | `ERROR`                                                  |

   Any non-`PASS` stops the series without opening the push gate; list all commits already created.

## Status Payload Gates

| Gate                 | Payload               | Checker                                                        |
| -------------------- | --------------------- | -------------------------------------------------------------- |
| `G_PLAN_ENVELOPE`    | every planner output  | `sh "$SKILL_DIR/scripts/validate-output.sh" plan < payload`    |
| `G_EXECUTE_ENVELOPE` | every executor output | `sh "$SKILL_DIR/scripts/validate-output.sh" execute < payload` |

A host-denied executor dispatch takes the Phase 4 denial row without validation or repair. Predicate: exit 0. On a malformed, missing or rejected payload with `envelope_repairs=0`, increment it and request one repair. For a planner payload, redispatch with the printed findings. For an executor payload, request only a corrected receipt from existing evidence; never repeat execution or commit. A second rejection or unavailable receipt → `ERROR`, inspect/report existing commits. A missing validator → `TOOLS_MISSING`, never hand-validate as a substitute. Route payloads only after exit 0.

For a shape-valid `COMMIT_PLAN: PASS`, require `Checks:` to equal the dispatched `CHECKS`; a mismatch uses the same envelope repair. For each executor receipt with verification fields, require the approved verification value and scope for that group. Repair a mismatch from existing evidence only.

After every shape-valid `COMMIT_PLAN: PASS` with `SCOPE_FROZEN=true`, require each group to have `Expansions: none` and every group path to equal a member of `CHANGE_PATHS` before routing to either display. Treat a violation as an envelope rejection under the same one-repair limit; tell the planner what violated the boundary. Never trim the plan.

## Readable Plan

When `SCOPE_FROZEN=true`, show “Resolved scope (frozen):” and list every path in `CHANGE_PATHS` before the first group, including omitted paths.

Show each group in order with its exact commit message, paths, expansions, and proposed verification (the literal command, `same as group N`, or `none` with the reason). Show the plan's omissions and warnings. For each split path run `python3 -I "$SKILL_DIR/scripts/collect-state.py" hunks 'path'` before display. Show each group’s NEW hunk numbers with their headers and first changed lines as quoted data. If `git rev-parse HEAD` differs from the plan base or the listing fails or lacks a selected hunk, stop with `ERROR` rather than requesting approval. State that staged content of a split file will be replaced by the committed hunks. Name detached HEAD when set and every whole-file member in `MM` state, because committing the whole file takes the worktree version instead of its staged version. State the approved setting in one sentence: “Each distinct command runs once on the shared worktree, not on isolated commit trees” or “Each group’s command runs on its own candidate tree, with ignored files linked from the worktree.” Use readable Markdown; keep the envelope, status, and digests internal.

## G_PLAN_APPROVAL

When `PUSH_REQUESTED`, resolve the [push destination](#push-destination) before displaying the gate. Show the [readable plan](#readable-plan) and the destination notice when applicable. Retain the original envelope and digests internally for execution. Ask one question: `approve`, `revise: <what to change>`, or `stop`. State that no commits have been made and nothing has been pushed, and end the turn.

| Answer           | Route                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `approve`        | Execute exactly the displayed plan. An otherwise valid approval may also ask to push this series: set `PUSH_REQUESTED=true`. If the request first arrives here, resolve the destination and give the same notice before execution. An explicit instruction to keep the series local cancels any earlier push request. |
| `revise: <note>` | A changed scope starts a new intake. Otherwise update `CHECKS` if the note changes where to run checks, keep the frozen list, append the note to `USER_DECISIONS`, and redispatch under the `plan_rounds` cap, else `BLOCKED`. |
| `stop`           | `BLOCKED` (user declined)                                                                               |
| Ambiguous and `approval_reasks=0` | Increment `approval_reasks`; ask one targeted question and wait |
| Ambiguous and `approval_reasks>=1` | `BLOCKED` |

Approval binds to the displayed plan and its per-group digests; the executor recomputes each digest and returns `DIVERGED` on mismatch. A changed plan requires a new preview. Earlier conversation never pre-approves a plan.

## Push destination

Use the current branch from `git symbolic-ref -q HEAD`. On detached HEAD there is no usable upstream. For an attached branch, run `git for-each-ref --format='%(upstream:remotename) %(upstream:remoteref) %(upstream) %(push)' refs/heads/<branch>`. Require one row with a single configured upstream remote name (not `.` and not an option), a single upstream remote ref under `refs/heads/`, and a nonempty `%(upstream)` equal to `%(push)`. Otherwise the destination is unusable; give a reason without URLs, such as “this branch has no upstream” or “a plain push from this branch would not go to its upstream”. Use `git remote get-url --all <remote>` and `git remote get-url --push --all <remote>` to require the same single endpoint for reads and writes; keep the endpoint internal. A missing, unusable, or mismatched destination does not block local commits. Use the configured upstream only.

- Usable: “Approval creates local commits only. After the whole series succeeds, I'll show the exact push to <remote> <branch> and ask separately.” Use the upstream branch name without `refs/heads/` for `<branch>`.
- Unusable: “I cannot push this branch (<reason>). Approving this plan creates local commits only.” Name the reason without URLs, and include it with the local result.

## G_PUSH_APPROVAL

Run inline after every approved group returned `PASS`. This gate cannot run in plan-only mode or after a stopped series. Repeat the [Push destination](#push-destination) check and require the current branch, upstream, and single endpoint to match the resolved destination. A changed or unavailable destination ends the run with “The push destination changed or is unavailable. Nothing was pushed.” Then:

1. Read `HEAD` with `git rev-parse HEAD`. It must equal the last receipt's commit; resolve the receipt SHA to a full ID with `git rev-parse --verify '<receipt-sha>^{commit}'`. On mismatch or failed read, finish: “I cannot confirm that HEAD matches the last commit from this run. Nothing was pushed.”
2. Read the live `OLD` with `git ls-remote --exit-code --refs <remote> <remoteref>`. Require one row giving the full SHA and the exact destination ref. If unavailable, finish: “I could not read the live tip of <remote> <branch>. Nothing was pushed.”
3. Require `git merge-base --is-ancestor <OLD> HEAD` to succeed. Otherwise finish: “The remote has commits this branch lacks. Nothing was pushed.” Leave both refs alone; do not fetch, pull or rebase.
4. If `OLD` equals `HEAD`, finish: “The branch is already up to date. Nothing was pushed.”
5. List the range with `git log --reverse --format='%h %s' <OLD>..HEAD`. Mark each commit “this run” if it matches a receipt SHA and “earlier, not created by this run” otherwise. If the list cannot be read completely, finish: “I could not list all commits for the push. Nothing was pushed.”
6. Show the remote name, full destination ref, full `OLD` and new tip, each listed commit with its mark, and the exact command from step 7. Say “Nothing has been pushed. Reply `push` to publish exactly these commits, or `stop` to keep them local.” End the turn.
7. On `push`, repeat the destination check and steps 1–3. Require the same `OLD` and `HEAD` as shown; any drift ends the run with the reason and “Nothing was pushed.” Run exactly once: `git push --porcelain --no-follow-tags --recurse-submodules=no -- <remote> <new-tip-sha>:<remoteref>`, passing the literal remote name and the literal SHA/ref pair as separately quoted arguments. Hooks run. On a nonzero exit, give the first diagnostic line and say “Nothing is known to have been published.” On exit 0, repeat step 2 and require the remote ref to equal the new tip. If confirmed, say “Pushed <OLD>..<new tip> to <remote> <branch>”. Otherwise say “The push exited successfully, but I could not confirm the remote ref at <new tip>.” Do not retry. In all user-facing text, use the remote name only and redact any URL or endpoint path from diagnostics.

| Answer | Route |
| --- | --- |
| `push` | Step 7. |
| `stop` | Final: “The commits remain local. Nothing was pushed.” |
| Unclear and `push_reasks=0` | Increment `push_reasks`; ask once for `push` or `stop` and wait without mutation. |
| Unclear and `push_reasks>=1` | Same as `stop`. |

## Terminals

| Terminal | User-visible outcome |
| --- | --- |
| Final | Report created commits, actual verification and preservation evidence, scoped remainder, and next action. Include the push gate's outcome when it ran. |
| `PLANNED_ONLY` | Show the [readable plan](#readable-plan), say “Nothing was pushed.” Then say: “Plan only. No commits made. No verification commands ran. To commit, make a new commit request; I'll prepare a fresh plan for approval.” Discard the executable plan and digests and end the run without an approval question, Phase 3, or executor dispatch. |
| BLOCKED | State the missing consent, declined plan, state drift, host denial, or unsafe state; list existing commits without retrying. |
| NO_SCOPED_CHANGES | State that no eligible changes were found and no commits were made. |
| TOOLS_MISSING | Name the unavailable capability; no manual substitute for a failed validator or collector. |
| VERIFY_FAILED / COMMIT_ERROR / ERROR | Name the failed phase, report observed evidence and any created commits; stop the series. On a failed candidate check, tell the user they can start again and ask for checks on the working tree; do not switch scope in this run. |

For every terminal, say “Nothing was pushed” if no push was attempted; use the gate outcome if an attempt could have published.

Questions wait for one named user reply and end the turn. Unavailable reply means remain at that gate without mutation. Except for host-denied executor dispatches, missing, unknown, or malformed subagent output uses its envelope-error route, never PASS.

## After Plan Only

With no approval gate open, answer `approve`, `revise: <note>`, `push`, or `stop` on its own with: “No approval gate is open. No commits made. Ask me to commit if you want a fresh plan.” Add “Nothing was pushed.” End the turn without tooling.

A new commit request starts a new run at intake: collect current state, plan again, and request approval for the fresh plan, even when the worktree has not changed.
