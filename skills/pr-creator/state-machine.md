# State machine for pr-creator

This is the sole normative routing source. [SKILL.md](./SKILL.md) summarizes it;
[flow-diagram.md](./flow-diagram.md) is illustrative. JSON, artifact, approval,
and final-output details belong to [execution-contracts.md](./references/execution-contracts.md)
and the six specialist contracts linked below. No nested dispatch or parallel join.

## Evaluation order and boundary gate

Evaluate the following global guards first, then the human-gate/counter guards
when applicable, then the matching state's rows in listed first-match order. Route only on checked fields, never on prose or a
producer's claim that it validated. For submitter known-object replies, `status`
means the checker's independently derived status, not the producer's verdict.

| Priority | Applies at                                        | Guard / event                                                                        | Route                                                                                                                                                              |
| -------- | ------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1        | Every specialist return                           | Missing output, or consumer checker exits 1 or 2, including malformed/unknown status | `TerminalError`, reason malformed/missing output or checker failure; no repair, redispatch, or mutating retry. After submission disclose that an object may exist. |
| 2        | Every specialist return                           | Consumer checker/interpreter cannot execute                                          | `TerminalBlocked`, reason `TOOLS_MISSING`; do not parse any field. After a create attempt also state that a remote object may exist.                               |
| 2b       | Any step before any create attempt                | Shell, Git, platform, or lookup capability unavailable/denied                        | `TerminalBlocked`, reason `TOOLS_MISSING`; do not parse unchecked fields.                                                                                          |
| 3        | After an object is established by a valid receipt | Later tool/auth/readback unavailable                                                 | `TerminalGaps`; preserve known identity, disclose unavailable facts, never retry create. Missing/malformed replies still take priority 1.                          |
| 4        | Any active state                                  | Unrecoverable operation failure not covered above                                    | `TerminalError` with evidence; no speculative recovery.                                                                                                            |
| 5        | Every specialist return                           | Consumer checker exits 0                                                             | Apply that specialist state's status rows below.                                                                                                                   |

The same checker gate applies before using any specialist field, even a question,
URL, or partial fact. If the checker cannot execute at any specialist return,
priority 2 applies; never infer validity. Approval-mode exits 1/2 also go directly to
`TerminalError`. Exact invocations are in [SKILL.md](./SKILL.md#consumer-checker-gates).
No missing output or malformed submitter receipt authorizes a create retry.
After a create attempt with no known object, failed/denied/inconclusive lookup
uses the submitter's checked `CREATE_UNCERTAIN` receipt and route, not a generic
tooling/operation failure. Preserve its warning and supported check commands.

## States

| State                                                                 | Responsibility                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ResolveMode`                                                         | Resolve absolute package root and dispatch/inline adapter.                                      |
| `NormalizeInputs` / `GateInput`                                       | Normalize public inputs; resolve an invalid requested state.                                    |
| `InitRun`                                                             | Declare fixed limits, capture baseline, and create the private external run directory.          |
| `InspectRepo`                                                         | Run `repo-state-inspector` and its consumer gate.                                               |
| `ResolveRepoFacts`                                                    | Route checked topology, target, create-path, and state facts.                                   |
| `GateTopology` / `GateTargetBranch`                                   | Obtain explicit remote pair or target, then re-inspect.                                         |
| `AdaptPlatform` / `GatePlatformTooling`                               | Bounded capability lookup or tooling choice, then checked re-inspection.                        |
| `GateStateFallback`                                                   | Obtain an explicit draft-to-ready choice for a checked ready path.                              |
| `RunPreflight`                                                        | Run `preflight-validator`; establish fresh remote pins and duplicate/auth/publication facts.    |
| `GatePush` / `GatePushRejected`                                       | Exact SHA/refspec approval, or user-confirmed external resolution without automatic repair.     |
| `AnalyzeDiff` / `GateScope`                                           | Run `diff-analyzer` against current pins; obtain head-bound scope consent if needed.            |
| `ResolveSources`                                                      | Resolve read-only title/template sources under the shared source contract.                      |
| `DraftPr` / `GateDraftChoice`                                         | Run `pr-drafter`; resolve type/scope/title-rule/template choices.                               |
| `SuggestMetadata` / `GateReviewer` / `GateLabels`                     | Run `review-metadata-suggester`; resolve reviewers, existing labels, and requested assignees.   |
| `ShowPreview` / `GatePreview`                                         | Freeze/check and show the full exact artifact, then await its answer.                           |
| `RouteRevision`                                                       | Invalidate approval and choose the earliest affected phase.                                     |
| `FreezeApproval`                                                      | Bind actual current-run user consent to the checker-derived preview digest.                     |
| `SubmitPr`                                                            | Run `pr-submitter`, bounded internal uncertainty handling, and independent consumer comparison. |
| `TerminalPass` / `TerminalGaps` / `TerminalBlocked` / `TerminalError` | Clean owned artifacts and emit exactly one final envelope.                                      |

Grouped rows name distinct states, not combined executions. All state names in
transition tables refer to the states above.

## Intake, topology, and capabilities

| From                  | Status / event                                                                  | Guard and action                                                                          | To                    |
| --------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------- |
| `[*]`                 | Run start                                                                       | Initialize native-session counters at zero before any gate; no prior-run consent applies. | `ResolveMode`         |
| `ResolveMode`         | Root and adapter resolved                                                       | Unknown root is `TOOLS_MISSING`; missing dispatch alone uses disclosed inline mode.       | `NormalizeInputs`     |
| `NormalizeInputs`     | Invalid `PR_STATE`                                                              | Ask draft/ready; do not default an invalid value.                                         | `GateInput`           |
| `NormalizeInputs`     | Inputs usable                                                                   | Keep target unset until inspected; no silent default branch.                              | `InitRun`             |
| `GateInput`           | Valid state supplied                                                            | Consume `input_cycles`; normalize again.                                                  | `NormalizeInputs`     |
| `InitRun`             | Owned run initialized                                                           | Create only once; revisits reuse this run and its counters.                               | `InspectRepo`         |
| `InspectRepo`         | `PASS`                                                                          | Use checked facts, including unresolved topology/target.                                  | `ResolveRepoFacts`    |
| `InspectRepo`         | `BLOCKED`, `TOOLS_MISSING`                                                      | Retain the domain reason.                                                                 | `TerminalBlocked`     |
| `InspectRepo`         | `ERROR`                                                                         | Unexpected inspection failure.                                                            | `TerminalError`       |
| `ResolveRepoFacts`    | Topology ambiguous                                                              | Ask for one checked candidate remote pair.                                                | `GateTopology`        |
| `ResolveRepoFacts`    | Target missing                                                                  | Offer the inspector's candidate, never silently select it.                                | `GateTargetBranch`    |
| `ResolveRepoFacts`    | Adapter needed, path null, platform unknown, or requested-state support unknown | Resolve before deriving effective state.                                                  | `AdaptPlatform`       |
| `ResolveRepoFacts`    | Draft requested, confirmed unsupported                                          | Require a checked safe ready path before offering fallback.                               | `GateStateFallback`   |
| `ResolveRepoFacts`    | Ready requested, confirmed unsupported                                          | No silent state substitution.                                                             | `TerminalBlocked`     |
| `ResolveRepoFacts`    | Checked path and requested state supported                                      | Set effective state to requested state.                                                   | `RunPreflight`        |
| `GateTopology`        | Valid pair supplied                                                             | Consume `topology_cycles`; pass choices for re-inspection.                                | `InspectRepo`         |
| `GateTargetBranch`    | Explicit target supplied                                                        | Consume `target_cycles`; pass it for re-inspection.                                       | `InspectRepo`         |
| `AdaptPlatform`       | Capability evidence obtained                                                    | Consume `platform_cycles`; re-inspect using the checked adapter/source.                   | `InspectRepo`         |
| `AdaptPlatform`       | Still uncertain after bounded lookup                                            | Ask for host/approved tooling; no invented support.                                       | `GatePlatformTooling` |
| `GatePlatformTooling` | Usable tooling/host answer                                                      | Consume `platform_cycles`; check it, do not treat the answer as proof.                    | `InspectRepo`         |
| `GateStateFallback`   | `APPROVED`                                                                      | Checked ready path exists; keep requested draft, set effective ready.                     | `RunPreflight`        |
| `GateStateFallback`   | `APPROVED`, no checked ready path                                               | No safe fallback established.                                                             | `TerminalBlocked`     |
| `GateStateFallback`   | `REVISE` with usable state/tooling change                                       | Consume `platform_cycles`; clear stale capability facts/approvals.                        | `InspectRepo`         |

## Preflight, scope, drafting, and metadata

Status sets are owned by the [preflight](./references/preflight-validator-contract.md),
[diff](./references/diff-analyzer-contract.md), [drafter](./references/pr-drafter-contract.md),
and [metadata](./references/review-metadata-suggester-contract.md) contracts. Inspector
facts above follow its [contract](./references/repo-state-inspector-contract.md).

| From               | Status / event                                                                    | Guard and action                                                                                                                   | To                 |
| ------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `RunPreflight`     | `PASS`                                                                            | Fresh base/head pins; success wins even at a recovery cap.                                                                         | `AnalyzeDiff`      |
| `RunPreflight`     | `PR_EXISTS`                                                                       | Include existing URL; do not update it.                                                                                            | `TerminalBlocked`  |
| `RunPreflight`     | `PUSH_REQUIRED`                                                                   | `push_cycles < 3`; prepare/check exact `push.json`.                                                                                | `GatePush`         |
| `RunPreflight`     | `PUSH_REJECTED`                                                                   | `push_cycles < 3`; clear push authorization, explain rejection.                                                                    | `GatePushRejected` |
| `RunPreflight`     | `PUSH_REQUIRED`, `PUSH_REJECTED`                                                  | `push_cycles >= 3`; reason `ESCALATED` plus original status.                                                                       | `TerminalBlocked`  |
| `RunPreflight`     | `AUTH`, `BASE_BRANCH_MISSING`, `HEAD_BRANCH_UNPUSHED`, `BLOCKED`, `TOOLS_MISSING` | Preserve the exact prerequisite/tool reason.                                                                                       | `TerminalBlocked`  |
| `RunPreflight`     | `ERROR`                                                                           | Unexpected operation failure.                                                                                                      | `TerminalError`    |
| `GatePush`         | `APPROVED`                                                                        | Consume `push_cycles`; bind real consent to checked push artifact. Only exact non-force SHA/refspec may run; verify published SHA. | `RunPreflight`     |
| `GatePush`         | `REVISE`, topology/state changed                                                  | Consume `push_cycles`; clear approval and stale facts.                                                                             | `InspectRepo`      |
| `GatePush`         | `REVISE`, publication change only                                                 | Consume `push_cycles`; clear approval; obtain a new artifact before any push.                                                      | `RunPreflight`     |
| `GatePushRejected` | User confirms manual resolution                                                   | Consume `push_cycles`; recheck fresh facts without reusing approval. No force/divergence repair or automatic re-publication.       | `RunPreflight`     |
| `AnalyzeDiff`      | `PASS`                                                                            | Current pinned three-dot facts; fired scope rules may remain after matching scope consent.                                         | `ResolveSources`   |
| `AnalyzeDiff`      | `LARGE_PR_CONFIRMATION_REQUIRED`                                                  | `scope_cycles < 3`.                                                                                                                | `GateScope`        |
| `AnalyzeDiff`      | `LARGE_PR_CONFIRMATION_REQUIRED`                                                  | `scope_cycles >= 3`; reason `ESCALATED`.                                                                                           | `TerminalBlocked`  |
| `AnalyzeDiff`      | `EMPTY_DIFF`, `TOOLS_MISSING`                                                     | Retain reason; no creation.                                                                                                        | `TerminalBlocked`  |
| `AnalyzeDiff`      | `ERROR`                                                                           | Pin mismatch or unreliable analysis is an error, not repinning permission.                                                         | `TerminalError`    |
| `GateScope`        | `APPROVED`                                                                        | Consume `scope_cycles`; record ordinary consent bound to current pins, not push/create authorization.                              | `AnalyzeDiff`      |
| `GateScope`        | `REVISE` with user-confirmed external branch/scope change                         | Consume `scope_cycles`; clear pins and all head-bound consent/approval. Never edit or split commits here.                          | `RunPreflight`     |
| `ResolveSources`   | Sources resolved or confirmed absent                                              | Follow shared title/body priority; pass resolved source inputs to drafter.                                                         | `DraftPr`          |
| `ResolveSources`   | Template/default/rule selection uncertain                                         | `type_scope_cycles < 3`; expose visible choices or explicit fallback, never pretend failed discovery means absence.                | `GateDraftChoice`  |
| `ResolveSources`   | Selection still required                                                          | `type_scope_cycles >= 3`; reason `ESCALATED`.                                                                                      | `TerminalBlocked`  |
| `DraftPr`          | `PASS`                                                                            | Exact body and source notes separated.                                                                                             | `SuggestMetadata`  |
| `DraftPr`          | `NEEDS_CHOICE`                                                                    | `type_scope_cycles < 3`.                                                                                                           | `GateDraftChoice`  |
| `DraftPr`          | `NEEDS_CHOICE`                                                                    | `type_scope_cycles >= 3`; reason `ESCALATED`.                                                                                      | `TerminalBlocked`  |
| `DraftPr`          | `TOOLS_MISSING`                                                                   | Required drafting/discovery capability unavailable.                                                                                | `TerminalBlocked`  |
| `DraftPr`          | `ERROR`                                                                           | Unrecoverable evidence/drafting failure.                                                                                           | `TerminalError`    |
| `GateDraftChoice`  | Template/title-rule source choice resolved                                        | Consume `type_scope_cycles`; retain explicit local/remote source intent.                                                           | `ResolveSources`   |
| `GateDraftChoice`  | Type/scope choice resolved, sources already resolved                              | Consume `type_scope_cycles`; pass selected values.                                                                                 | `DraftPr`          |
| `SuggestMetadata`  | `PASS`                                                                            | Canonical reviewers, labels, and assignees; no requested assignment is silently dropped.                                           | `ShowPreview`      |
| `SuggestMetadata`  | `NEEDS_REVIEWER`                                                                  | `reviewer_cycles < 3`.                                                                                                             | `GateReviewer`     |
| `SuggestMetadata`  | `INVALID_LABELS`                                                                  | `label_cycles < 3`.                                                                                                                | `GateLabels`       |
| `SuggestMetadata`  | `NEEDS_REVIEWER`                                                                  | `reviewer_cycles >= 3`; reason `ESCALATED`.                                                                                        | `TerminalBlocked`  |
| `SuggestMetadata`  | `INVALID_LABELS`                                                                  | `label_cycles >= 3`; reason `ESCALATED`.                                                                                           | `TerminalBlocked`  |
| `SuggestMetadata`  | `AUTH`, `BLOCKED`, `TOOLS_MISSING`                                                | Assignment `BLOCKED` is not a reviewer gate; retain invalid/unverifiable/unsupported assignment evidence.                          | `TerminalBlocked`  |
| `SuggestMetadata`  | `ERROR`                                                                           | Unexpected metadata lookup failure.                                                                                                | `TerminalError`    |
| `GateReviewer`     | Named reviewers or explicit `none`                                                | Consume `reviewer_cycles`; none requests no reviewers, not no platform additions.                                                  | `SuggestMetadata`  |
| `GateLabels`       | Existing labels selected or invalid requests removed                              | Consume `label_cycles`; never create a label.                                                                                      | `SuggestMetadata`  |

## Preview and submission

Use the [submitter contract](./references/pr-submitter-contract.md). A known-object
producer `PASS` or `GAPS_FOUND` is independently compared by the checker; either
producer value may become either checked value. Do not compare full-body digests
for equality or reject valid success because a non-PASS ledger is exhausted.

| From             | Status / event                                                | Guard and action                                                                                                     | To                |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `ShowPreview`    | Artifact checked                                              | Freeze owned `preview.json` and literal `body.md`; show the entire exact preview and notes from the shared contract. | `GatePreview`     |
| `GatePreview`    | `APPROVED`                                                    | Exact shown artifact, actual user approval in this run.                                                              | `FreezeApproval`  |
| `GatePreview`    | `REVISE` with usable changes                                  | Consume `preview_edit_cycles`; invalidate approval.                                                                  | `RouteRevision`   |
| `RouteRevision`  | Repository/remotes/branches/platform/state/create-plan change | Clear affected facts and head-bound consent.                                                                         | `InspectRepo`     |
| `RouteRevision`  | Head/publication/pin change                                   | Clear pins and head-bound consent.                                                                                   | `RunPreflight`    |
| `RouteRevision`  | Diff/scope interpretation change with valid pins              | Clear affected downstream results.                                                                                   | `AnalyzeDiff`     |
| `RouteRevision`  | Title/body/override/rule/template change                      | Clear source/draft and downstream approvals.                                                                         | `ResolveSources`  |
| `RouteRevision`  | Reviewer/label/assignee change only                           | Revalidate all requested metadata.                                                                                   | `SuggestMetadata` |
| `RouteRevision`  | Out-of-scope mutation or no safe affected phase               | No scope widening; explain pending change.                                                                           | `TerminalBlocked` |
| `FreezeApproval` | Artifact unchanged and actual consent reference retained      | Bind current run/checkpoint/digest; submit exact artifact only.                                                      | `SubmitPr`        |
| `FreezeApproval` | Artifact changed                                              | Consume `preview_edit_cycles`; invalidate consent and choose earliest affected phase.                                | `RouteRevision`   |
| `FreezeApproval` | Consent provenance lost, artifact unchanged                   | Consume `preview_edit_cycles`; show/reapprove instead of inferring consent.                                          | `ShowPreview`     |
| `SubmitPr`       | `PASS`                                                        | Independent exact-scalar, approved-subset, exact-UTF-8-body-prefix comparison passes. Distinguish created/found.     | `TerminalPass`    |
| `SubmitPr`       | `GAPS_FOUND`                                                  | Known object with altered/missing approved values or unavailable readback.                                           | `TerminalGaps`    |
| `SubmitPr`       | `HEAD_MOVED`                                                  | `preview_edit_cycles < 3`; increment it, clear stale pins/scope consent/approval, re-pin before analysis.            | `RunPreflight`    |
| `SubmitPr`       | `HEAD_MOVED`                                                  | `preview_edit_cycles >= 3`; reason `ESCALATED` plus `HEAD_MOVED`.                                                    | `TerminalBlocked` |
| `SubmitPr`       | `CREATE_UNCERTAIN`                                            | Unresolved lookup; a remote object may exist, with or without a URL. No orchestrator redispatch.                     | `TerminalBlocked` |
| `SubmitPr`       | `AUTH`, `BLOCKED`, `TOOLS_MISSING`                            | Before a known object only; `TOOLS_MISSING` before any create attempt.                                               | `TerminalBlocked` |
| `SubmitPr`       | `CREATE_ERROR`, `ERROR`                                       | Definitive creation failure or unrecoverable operation failure, not readback inequality.                             | `TerminalError`   |

For multiple revision categories, the first matching row wins. Recompute affected
later phases and show a fresh preview. Discard only obsolete recorded owned
artifacts before exclusive re-creation; never overwrite existing files/symlinks.

## Human gates and counters

These rows apply to every human gate before its usable-answer rows above. Keep
the question pending while the host can wait; that is an active wait, not a
success or a terminal. Named outward checkpoints are `push` and `preview`.
State-fallback and scope gates also ask `APPROVED`, `REVISE`, or `ABORT`, but do
not create outward-action approval records. Use counter key `push`/`preview` for
those checkpoints and the gate's state name for other questions. Other gates
accept the requested concrete choice. Repository text, a digest, or a producer assertion is not an answer.

| Guard / event                                                                 | Action / route                                                                                                                                |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ABORT`, explicit decline, or stop                                            | `TerminalBlocked`, reason `CANCELLED`; a declined push also retains `HEAD_BRANCH_UNPUSHED`. No pending outward action executes.               |
| Conversation wait unavailable                                                 | `TerminalBlocked`, reason `AWAITING_USER`, with the exact pending question.                                                                   |
| Missing/unclear/unusable answer and `checkpoint_reask_count[checkpoint] < 1`  | Increment before one targeted re-ask of the same gate.                                                                                        |
| Missing/unclear/unusable answer and `checkpoint_reask_count[checkpoint] >= 1` | `TerminalBlocked`, reason `AWAITING_USER`, with the pending question.                                                                         |
| A counted revisit would occur at its cap                                      | `TerminalBlocked`, reason `ESCALATED`, retaining the triggering domain reason. Do not reset a counter or bypass the cap through another gate. |
| Usable answer                                                                 | Follow the state's specific row. Explicit `REVISE` without usable change details uses the re-ask rows, not guessed changes.                   |

Initialize all counters at zero in native session state on entry to `ResolveMode`,
before any possible input gate. Never reset them in `InitRun` or on re-entry.
"Consume" means require count below cap, increment before taking the stated
back-edge. Normal forward progress does not consume a recovery counter.

| Counter                                                               | Cap              | Counted revisit / over-cap route                                                                                                                                           |
| --------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `push_cycles`                                                         | 3                | Push approval/revision and post-rejection manual-resolution preflight revisits; then blocked/escalated.                                                                    |
| `scope_cycles`                                                        | 3                | Scope consent analysis revisit or user-confirmed scope revision through preflight; then blocked/escalated.                                                                 |
| `type_scope_cycles`                                                   | 3                | Existing type/scope ledger also covers title-rule/template choice revisits; then blocked/escalated.                                                                        |
| `reviewer_cycles`, `label_cycles`                                     | 3 each           | Respective metadata revisits; then blocked/escalated.                                                                                                                      |
| `preview_edit_cycles`                                                 | 3                | Preview revision, changed/lost approval provenance, or `HEAD_MOVED` recovery; then blocked/escalated.                                                                      |
| `input_cycles`, `topology_cycles`, `target_cycles`, `platform_cycles` | 3 each           | Respective input/re-inspection revisits, including state-fallback revision; then blocked/escalated.                                                                        |
| `checkpoint_reask_count[checkpoint]`                                  | 1 per named gate | One clarification, then blocked/awaiting-user. Never reset after an artifact revision.                                                                                     |
| `platform_lookup_count[decision]`                                     | 1                | One authoritative URL for an unresolved capability/syntax decision; still uncertain at cap goes to `GatePlatformTooling`, not another fetch.                               |
| `create_retry_count`                                                  | 1                | Submitter-internal retry only after successful supported lookup establishes absence; at cap unresolved outcome is `CREATE_UNCERTAIN`, then blocked.                        |
| `uncertain_lookup_count[create_attempt]`                              | 1 per attempt    | One supported lookup after each ambiguous create. Found means verify, established absence may enable the one retry, failed/inconclusive lookup remains `CREATE_UNCERTAIN`. |
| `readback_count[known_object]`                                        | 1                | One supported follow-up readback beyond create/lookup-returned fields; remaining unavailable fields are `GAPS_FOUND`. No polling.                                          |

The last three counters live inside the single submitter invocation; they are
not permission for the orchestrator to redispatch it. Recheck the unchanged
approval/head/duplicate safeguards before any permitted retry. A head change at
that recheck means no retry: return `CREATE_UNCERTAIN` with `create_attempted=true`
and the warning that a remote object may exist; use its existing route above.
`HEAD_MOVED` is reserved for zero create attempts. Never retry a known object,
definitive error, malformed receipt, or inconclusive lookup.
There is no `FinalDecision` escape that resets an exhausted ledger.

## Terminals and reachability

At every terminal capture after-status when tooling permits, compare with the
baseline if established, inspect hunks for unexpected deltas on already-dirty
paths, and report without auto-repair. Disclose unavailable status evidence.
If a run directory was created, delete only recorded owned run files, then
remove the owned directory only if empty. Cleanup failure is disclosed, never repaired by recursive deletion or a
new outward action. Emit the [final envelope](./references/execution-contracts.md#final-envelope)
with evidence, URL when known, and one next step when action remains.

| Terminal          | Final status            | Reason / output                                                                                                                                                                                                                                |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TerminalPass`    | `PR_CREATE: PASS`       | Verified created or immediate race-found object. Print actual full returned body and `Platform additions after create:`, including none.                                                                                                       |
| `TerminalGaps`    | `PR_CREATE: GAPS_FOUND` | Known object with verification gaps. Created objects use `PR created; verification gaps`; found objects say found. Print actual body when available, never the approved input as readback, plus additions/unavailable facts.                   |
| `TerminalBlocked` | `PR_CREATE: BLOCKED`    | Unmet prerequisite, `AUTH`, `BASE_BRANCH_MISSING`, `HEAD_BRANCH_UNPUSHED`, `PR_EXISTS`, `EMPTY_DIFF`, `CANCELLED`, `AWAITING_USER`, `TOOLS_MISSING`, `ESCALATED`, or unresolved `CREATE_UNCERTAIN`. Old codes are reasons, not final statuses. |
| `TerminalError`   | `PR_CREATE: ERROR`      | Missing/malformed output, checker failure, unrecoverable operation failure, specialist `ERROR`, or definitive `CREATE_ERROR`. After ambiguous submission, state that an object may exist; no retry.                                            |

| Property                     | Evidence / limit                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every active state reachable | Start reaches inspection; unresolved facts reach topology/target/platform/fallback gates. Preflight reaches publication gates, diff reaches scope/source/draft choices, metadata reaches its gates, preview revision reaches `RouteRevision`, and approval reaches submission. |
| Every terminal reachable     | Submitter comparison reaches pass/gaps; prerequisites, abort/wait/caps reach blocked; any malformed reply or specialist error reaches error.                                                                                                                                   |
| Nonterminal dead states      | None. Every state has a forward edge, a named bounded revisit/wait, or a global terminal guard.                                                                                                                                                                                |
| Revisit boundedness          | All automatic revisits and re-asks have explicit ledgers above; success rows precede recovery-cap rows. User-originated revisions consume the same run's ledgers.                                                                                                              |
| Submission prerequisite      | Checked safe path/state, fresh preflight pins, accepted scope, checked draft/metadata, exact shown preview, current-run actual approval, then immediate head/duplicate recheck.                                                                                                |
| Validation limit             | Structural routes and caps can be checked statically. This table is not evidence of fresh-context runtime behavior or remote consistency.                                                                                                                                      |
