# Scoped commit state machine

This is the single normative source for transitions, guards, retries, and terminals. Read it before intake; examples elsewhere are illustrative.

## Execution

Emit `Phase N/4 - Name` only on a real transition. Route on the tables; evaluate rows top to bottom, first match wins; never infer a status. Initialize `plan_rounds=0`, `approval_reasks=0`, and a per-payload `envelope_repairs=0`.
Every question names the missing input in prose and ends the turn. When every approved group has committed with `Preserved` equal, report the created commits and preservation evidence in prose.

1. `Phase 1/4 - Intake` (inline). Require the verbatim request, else `BLOCKED`. Check path grammar; each path must exist in the worktree or in `HEAD`; missing or ambiguous (file and directory collide, glob-like) → ask one question. Resolve `SKILL_DIR`; run `sh "$SKILL_DIR/scripts/validate-output.sh" plan` on the plan envelope in Example A and require exit 0, else `TOOLS_MISSING`. `git rev-parse --is-inside-work-tree` must print `true`, else `BLOCKED`. Resolve repository root with `git rev-parse --show-toplevel` and run collection there. Missing Python 3, collector, or a non-SHA-1 repository → `TOOLS_MISSING`; collector read failures → `ERROR` with no digest accepted. Any of `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`, `rebase-merge/`, `rebase-apply/`, `BISECT_LOG` under `git rev-parse --git-dir` → `BLOCKED`. `git symbolic-ref -q HEAD` non-zero → `DETACHED_HEAD=true` (warning, not a block). If an applicable higher-priority instruction requires another branch, `BLOCKED` before planning; ask the user to select it outside this workflow, never create or switch it under commit approval. `git status --porcelain -- <CHANGE_PATHS>` empty → `NO_SCOPED_CHANGES`.
2. `Phase 2/4 - Plan`. Dispatch the planner with `CHANGE_PATHS`, `COMMIT_STYLE`, `CONTEXT_QUERY`, `CONTEXT_LOCATION`, `VERIFICATION_HINT`, `DETACHED_HEAD`, `SKILL_DIR`, `MUTATION_LIMITS`, and `USER_DECISIONS` in the evidence block. `plan_rounds += 1`. Validate through `G_PLAN_ENVELOPE`.

   | Planner result                                       | Route                                                                   |
   | ---------------------------------------------------- | ----------------------------------------------------------------------- |
   | `COMMIT_PLAN: PASS`                                  | Gate                                                                    |
   | `COMMIT_PLAN: NEEDS_DECISION` and `plan_rounds` < 3  | Ask the one question; append the answer to `USER_DECISIONS`; redispatch |
   | `COMMIT_PLAN: NEEDS_DECISION` and `plan_rounds` >= 3 | `BLOCKED`                                                               |
   | `COMMIT_PLAN: NO_CHANGES`                            | `NO_SCOPED_CHANGES`                                                     |
   | `COMMIT_PLAN: ERROR`                                 | `ERROR`                                                                 |

3. `Phase 3/4 - Gate` `G_PLAN_APPROVAL` (inline, see below).
4. `Phase 4/4 - Execute`. For each group in order, dispatch the executor with `SKILL_DIR`, `MUTATION_LIMITS`, and the group block verbatim as `APPROVED_GROUP` in the evidence block. Validate through `G_EXECUTE_ENVELOPE`.

   | Executor result                                           | Route                                                    |
   | --------------------------------------------------------- | -------------------------------------------------------- |
   | Host denies executor dispatch before an envelope exists | `BLOCKED`: name the group and host denial, list already-created commits; never retry inline, escalate permissions, or dispatch later groups |
   | `COMMIT_EXECUTE: PASS`                                    | Record the commit and verification evidence; next group, or Final when none remain |
   | `COMMIT_EXECUTE: DIVERGED`                                | `BLOCKED` naming the group                               |
   | `COMMIT_EXECUTE: HOOK_MUTATION`                           | `BLOCKED` naming the group and SHA                       |
   | `COMMIT_EXECUTE: VERIFY_FAILED`                           | `VERIFY_FAILED`                                          |
   | `COMMIT_EXECUTE: COMMIT_ERROR` (including hook rejection) | `COMMIT_ERROR`                                           |
   | `COMMIT_EXECUTE: ERROR`                                   | `ERROR`                                                  |

   Any non-`PASS` stops the series; commits already created are listed in the final report.

## Status Payload Gates

| Gate                 | Payload               | Checker                                                        |
| -------------------- | --------------------- | -------------------------------------------------------------- |
| `G_PLAN_ENVELOPE`    | every planner output  | `sh "$SKILL_DIR/scripts/validate-output.sh" plan < payload`    |
| `G_EXECUTE_ENVELOPE` | every executor output | `sh "$SKILL_DIR/scripts/validate-output.sh" execute < payload` |

Predicate: exit 0. On a malformed, missing or rejected payload with `envelope_repairs=0`, increment it and request one repair. For a planner payload, redispatch with the printed findings. For an executor payload, request only a corrected receipt from existing evidence; never repeat execution or commit. A second rejection or unavailable receipt → `ERROR`, inspect/report existing commits. A missing validator → `TOOLS_MISSING`, never hand-validate as a substitute. Route only after exit 0.

## G_PLAN_APPROVAL

Keep `COMMIT_PLAN` internal. Show each planned group in order with its exact message, paths, expansions, verification command, omissions, and warnings in readable Markdown. Retain the original envelope and digests internally for execution; do not print status or digest routing fields. Warnings must name detached HEAD when set and every group path in `MM` state, because `git commit --only` commits the worktree version and discards the staged version of that path. Disclose that verification checks the shared worktree, not isolated commit trees. Ask one question: `approve`, `revise: <what to change>`, or `stop`. State that no commits have been made and end the turn.

| Answer           | Route                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `approve`        | Execute exactly the displayed plan                                                                      |
| `revise: <note>` | Append the note to `USER_DECISIONS`; redispatch the planner under the `plan_rounds` cap, else `BLOCKED` |
| `stop`           | `BLOCKED` (user declined)                                                                               |
| Ambiguous and `approval_reasks=0` | Increment `approval_reasks`; ask one targeted question and wait |
| Ambiguous and `approval_reasks>=1` | `BLOCKED` |

Approval binds to the displayed plan and its per-group digests; the executor recomputes each digest and returns `DIVERGED` on mismatch. A changed plan requires a new preview. Earlier conversation never pre-approves a plan.

## Terminals

| Terminal | User-visible outcome |
| --- | --- |
| Final | Report created commits, actual verification and preservation evidence, scoped remainder, and next action. |
| BLOCKED | State the missing consent, declined plan, state drift, host denial, or unsafe state; list existing commits without retrying. |
| NO_SCOPED_CHANGES | State that no eligible changes were found and no commits were made. |
| TOOLS_MISSING | Name the unavailable capability; no manual substitute for a failed validator or collector. |
| VERIFY_FAILED / COMMIT_ERROR / ERROR | Name the failed phase, report observed evidence and any created commits; stop the series. |

Questions wait for one named user reply and end the turn. Unavailable reply means remain at that gate without mutation. Missing, unknown, or malformed subagent output uses its envelope-error route, never PASS.
