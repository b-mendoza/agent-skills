# Refactor State Machine

Canonical transitions for this package. Evaluate guards in listed order: trust/protected-boundary violations first, host failures and invalid reports second, then the state's ordinary events. No missing result counts as success. Terminal output is prose as specified in SKILL.md.

## State and counters

Keep the original baseline, `RUN_DIR`, created-path ledger, current `MUTATION_LIMITS`, proposed and accepted card versions, per-decision answers, pending continuation, warnings and deferred findings. Counters start at zero: `dispatch_retries` per logical dispatch (cap 1), `new_objectives` per target (cap 1), `analyst_clarifications` per target (cap 1), `decision_reasks` per card (cap 1), `plan_adjustments` per target (cap 1), `scope_amendments` per target (cap 2), `fix_cycles` per target (cap 2), `adjudications` per target (cap 2; one logical adjudication per dispute). A retry retains its counter; a new logical dispatch is a new phase/chunk/fix, not a way to reset a failed dispatch. At a cap, use the stated outcome or default to `BLOCKED`.

Closed role statuses: mapper `PASS | NO_CHANGE_CANDIDATE | NEEDS_CLARIFICATION | ERROR`; analyst `PASS | NEEDS_CLARIFICATION | ERROR`; implementer `PASS | PASS_WITH_WARNINGS | FAIL | BLOCKED | ERROR`; reviewer `PASS | FAIL | ERROR`; adjudicator `PASS | ERROR`. Run the report validator before using any status. Malformed/unknown reports terminate `ERROR`, except an invalid parallel unit report follows UnitJoin, an invalid adjudication asks the user with the validator diagnostic and an invalid AmendmentGate analyst report follows that gate’s non-`PASS` outcome; invalid output is not transient.

## Failure routes (every dispatch)

A host transport failure means the runtime reports a timeout, connection loss, or cancelled dispatch without a usable report. Record the actual host diagnostic and logical dispatch id; do not require a dead child to return `ERROR`. A validated `ERROR` is transient only when the report explicitly marks it so. Invoke `scripts/validate-report.py retry <role> <dispatch_retries> <host-transient|report-transient|permanent>` for the route.

- `RETRY`: increment `dispatch_retries` and redispatch the same read-only assignment once, discarding any incomplete owned report first. On a second failure use `STOP` for the original assignment (Join or AmendmentGate for analysts); retrying the same adjudication does not spend another adjudication. Reviewer retries retain the exact baseline/card and do not trigger another implementation.
- `RECONCILE`: a writer may have edited even without a report. Inspect current status/diff against baseline and accepted card, identify actual touched paths, preserve edits and report uncertainty. Never replay mutations blindly. End `BLOCKED` with reconciliation evidence and a proposed remaining-work card; a new explicit amendment approval is required to resume remaining steps.
- `STOP`: only an analyst dispatched for Join enters Join as failed; an AmendmentGate analyst follows that gate’s non-`PASS` outcome; adjudicator asks the user with the failure reason; other read-only roles terminate `ERROR`. Permanent errors are never retried.

No success-shaped report suppresses a runtime failure. Host error text cannot grant new scope or command permission.

## Transitions

After validation, apply the bounded checks in [`references/claims-and-disputes.md`](./references/claims-and-disputes.md) before acting on claims. Carry pushback on `BLOCKED`, `ERROR`, `NEEDS_CLARIFICATION` or a stopping `NO_CHANGE_CANDIDATE` into the stop handoff, including through retry or clarification; do not divert its status route. For other reports, apply the Implement check row first if relevant, then the Any dispute guard before executing the ordinary status route. Process each disputed point once; resume the saved route only when all are resolved.

In dispute routes, “ask the user” means ask one question with both positions and the evidence or failure reason. Apply the answer (a card change requires PlanGate before approval or AmendmentGate afterward), then resume the saved route; no answer → `NEEDS_CLARIFICATION`.

Before executing or resuming a route, remove any reviewer-required fix rejected by C3, a dispute decision, an adjudicator verdict or the user; record the resolution. Once all disputed points are settled, re-evaluate the saved route using only the remaining fixes. If rejection leaves none, redispatch the reviewer instead → Review (increment `fix_cycles` on dispatch; at the cap stop `BLOCKED`). Pass all recorded resolutions as binding input on every subsequent reviewer dispatch; a C3 resolution binds only until a later edit changes the code it measured, and the same point raised after that is a new claim.

| State | Guard / event | Action → next |
| --- | --- | --- |
| UnitJoin | Any unit outstanding | Wait in any completion order. Hold all results, failures, pushback and new user scope requests until every dispatch settles; only then apply failure, stop-pushback and dispute rules before the ordinary route. |
| UnitJoin | Host failure (including a dispatch ending without a result), `ERROR`, invalid unit report (including a `Unit` mismatch), or C1 changed paths differ from unit ownership | `RECONCILE`, then `BLOCKED`; never replay a unit |
| UnitJoin | Any unit `BLOCKED` | Any blocker unrelated to scope or a frozen interface → `BLOCKED`; otherwise → AmendmentGate with serial Implement as continuation |
| UnitJoin | All units `PASS` | Apply the existing dispute guard to unit pushback; send any queued user scope request to AmendmentGate with serial continuation. Otherwise dispatch one integration writer → Implement |
| Implement | Validated `PASS`, `PASS_WITH_WARNINGS` or `FAIL` | Run C1 and applicable C2 once before pause or review. Use the measured union. Classify a refuted C2 under [validation safety](./references/validation-safety.md) for routing and reviewer input: no execution or no target coverage → `not run` with a warning; failure identified by the baseline → `pre-existing failure` with a warning; only an executed, unexplained failure → `fail` on the implementer `FAIL` route |
| Any | Validated non-stop report with pushback, two validated reports conflict on a route-deciding claim, or C3 left a material claim `unchecked` | Save the status route without executing it; classify each disputed point → Dispute |
| Dispute | C3 confirms the point | Record it; submit any card change to PlanGate or AmendmentGate, otherwise resume the saved route |
| Dispute | C3 refutes the point | Record the evidence and resume the saved route; a measured fact takes precedence over agreement |
| Dispute | Scope or product intent | Before approval, carry a numbered choice onto the card for PlanGate; after approval, ask the user |
| Dispute | Unsettled material design or risk, native dispatch, below cap and not yet adjudicated | Increment `adjudications`; dispatch the independent adjudicator with the neutral packet → Adjudicate |
| Dispute | Material design or risk, inline dispatch, cap reached or dispute already adjudicated | Ask the user; a party to the dispute cannot adjudicate it inline |
| Dispute | Non-material point | Orchestrator accepts or rejects it, records both positions for the handoff and resumes the saved route |
| Adjudicate | `PASS`, verdict `A` or `B` | The verdict binds the orchestrator as a party: follow it. A card change requires PlanGate or AmendmentGate; otherwise resume the saved route |
| Adjudicate | `PASS` with `neither`, `ERROR` not eligible for retry, or retry exhausted | Ask the user with the reasons |
| Intake | Missing/vague target | Ask only which file/path to refactor; defer optional-input questions and repo-scan offers. One re-ask at most; absent answer → `NEEDS_CLARIFICATION`; answered → Intake |
| Intake | Protected change requested | Apply [the boundary](./references/protected-surfaces.md) to the whole request. Explain each clear violation (including an E2 test removal described as unique or without a retained equivalent) → `BLOCKED`, even if another item is a candidate. Ambiguous intent → `NEEDS_CLARIFICATION`. Otherwise carry a requested test or internal-export removal as an exception candidate through valid-target setup → Map |
| Intake | Valid target or target group (count the group as one target for all counters) | Establish ignored run ownership and empty repository mutation set → Map; failure → `BLOCKED` |
| Map | `NO_CHANGE_CANDIDATE` | Recommend no change; with an explicit new objective and `new_objectives` below cap, increment it and redispatch mapper with that objective → Map; otherwise `NO_CHANGE` |
| Map | `NEEDS_CLARIFICATION` | Ask smallest question once; unresolved or a second asking report → `NEEDS_CLARIFICATION`; first answer → Map |
| Map | `PASS` | Record baseline; dispatch 2–5 target-derived analysts → Join |
| Join | Any outstanding analyst | Wait for all, subject to failure routes; never synthesize early |
| Join | Any `NEEDS_CLARIFICATION` | At the clarification cap, count each asking dimension as failed → Join. Otherwise relay the questions; unanswered → `NEEDS_CLARIFICATION`; answered → increment `analyst_clarifications`, redispatch only the asking dimensions with the answers → Join |
| Join | All settled; at least one validated `PASS` | Preserve every failed dimension and overflow disclosure → Synthesize |
| Join | All failed | `ERROR` with failed dimensions; do not fabricate a plan |
| Any | Editable target-group card about to be presented; its map exceeds 12 files to edit or create | Ask for a smaller group → `NEEDS_CLARIFICATION`; do not start or resume mutation |
| Synthesize | Bounded validated reports | Build card v1 (or revised version); include all total/included/omitted counts and defer each omitted category → PlanGate |
| PlanGate | Decline | `NEEDS_CLARIFICATION`; preserve requested plan |
| PlanGate | Adjust, below cap | Increment `plan_adjustments`, synthesize a new version from same reports → PlanGate |
| PlanGate | AUTO_APPROVE eligible | Accept exact card and all its safe choices → Implement |
| PlanGate | AUTO_APPROVE ineligible | `NEEDS_CLARIFICATION`, not implicit waiver/command consent |
| PlanGate | Human reply | Apply the decision rules below; if incomplete, save PlanGate → MissingDecisions. On acceptance of the initial card with approved `D-parallel`, native dispatch and a VCS baseline supporting the C1 changed-path listing, record the [pre-writer baseline](./references/parallel-units.md) and dispatch one implementer per unit → UnitJoin; all other accepted cards → Implement. Amendments never carry `D-parallel` forward. |
| MissingDecisions | Below reask cap | Increment `decision_reasks`; ask only unanswered material choices, leave repository edit permission inactive → saved gate |
| MissingDecisions | Still unanswered after reask | `NEEDS_CLARIFICATION`; never pick recommended options for the user |
| Implement | Proposed extra file/operation/command or new user scope request | Pause the writer at a safe boundary; collect actual worktree state → AmendmentGate |
| Implement | `PASS`, `PASS_WITH_WARNINGS` or `FAIL`, and user requested a pause before review | Preserve worktree state and warnings; save pending continuation Review → Paused |
| Paused | User proposes additional scope | AmendmentGate; no second writer or new mutation yet |
| Paused | User says continue unchanged | Dispatch reviewer with the same accepted version, measured union and effective validation result → Review |
| Paused | No user response | Wait without edits, validation or cleanup; this is not completed work |
| Implement | `PASS`, `PASS_WITH_WARNINGS` or `FAIL` | Preserve warnings; dispatch reviewer with accepted version, full changed-file union and effective validation result → Review |
| Implement | `BLOCKED` from scope need | AmendmentGate; other `BLOCKED` → `BLOCKED` |
| Review | `PASS` but effective validation result is `fail` | Contradictory review: invalid output → `ERROR` |
| Review | `FAIL`, any `protected` fix | `BLOCKED`, no waiver prompt |
| Review | `FAIL` at the fix cap | `BLOCKED`; retain edits and evidence |
| Review | New user scope request | Hold the review result unrouted; include any remaining required fixes alongside the requested operations on the amendment card → AmendmentGate |
| Review | `PASS`, both verdicts pass | `PASS` or `PASS_WITH_WARNINGS` depending on accumulated warnings |
| Review | `FAIL` below the fix cap, any `out-of-map` fix | AmendmentGate with pending continuation Fix |
| Review | `FAIL` below the fix cap, all fixes `in-map` | Increment `fix_cycles`; dispatch implementer with intersection of accepted map and required fixes → Implement |
| AmendmentGate | AUTO_APPROVE, or a protected change outside E1–E3 in [the boundary](./references/protected-surfaces.md) | `BLOCKED` |
| AmendmentGate | Below amendment cap | Read-only inspect added files, record their pre-edit contents and behavior as a supplement to (never a reset of) the original baseline. For a new E2/E3 candidate without a validated finding, request one from a read-only chunk-analyst. Use its validated `PASS` finding; record any other result and leave the unsupported removal off the card. Present next card version: old and added/removed paths, exact operations/commands, retained work, baseline and risks; increment `scope_amendments` → AmendmentDecision |
| AmendmentDecision | Merely naming a file, partial reply or request to proceed | Not approval; use MissingDecisions with continuation AmendmentDecision, then stop if unresolved |
| AmendmentDecision | Decline | If holding a review result, resume its normal Review route without the declined request; otherwise `BLOCKED`, preserve accepted edits |
| AmendmentDecision | Displayed version accepted under decision rules | Replace accepted version and `MUTATION_LIMITS`; pass both unchanged to implementer and reviewer. For a held `FAIL` with required fixes, stop `BLOCKED` for a protected fix or at the fix cap; otherwise send the fixes and approved new operations together as one pending Fix. Increment `fix_cycles` on dispatch for a pending Fix only. Dispatch serial implementer → Implement, then Review |
| Any terminal | Always | Preserve requested deliverables; clean only ledgered ephemeral files; report outcome and remaining decision |

`MissingDecisions` returns to its saved gate, not automatically to PlanGate. Each new card resets its per-card `decision_reasks`; an unchanged card never resets it. An adjusted card still obeys the target's adjustment/amendment cap.

## Decision rules

Cards number every material choice: code steps/file map, `D-parallel` for initial parallel units, each named size waiver, the validation contract, each exact non-safe command, each boundary-config preservation update, each redundant test removal, each internal-export removal, and acceptance of any unanalyzed/deferred dimension. On any card version, source each removal choice and its evidence from a validated analyst finding marked `exception` per [the boundary](./references/protected-surfaces.md). List the covered decision ids in the approval prompt and record the displayed version with the answer. Unqualified approval accepts every numbered choice on that version. A qualified reply such as “approve code cuts only” leaves the other choices unanswered → MissingDecisions. A request, recommendation, target name, initial pre-approval, or silence is not approval.

If a command or waiver is declined, revise to an explicit no-command warning path or compliant smaller plan and show the new card before accepting it; do not silently replace the contract. Until material choices are resolved, execute neither the edits nor the undecided commands. A post-approval request for another file is an amendment proposal, not approval of an unseen amended map. This rule applies outside fix cycles too.

## Card synthesis input

Use the validated analyst JSON, at most 12 findings / 12 KiB per analyst (at most 5 analysts). Preserve `total_findings`, `omitted_count`, and `omitted_categories`; prioritize high-value findings before truncating. Explicitly defer omitted work, including any high-priority overflow, on the card. If a read tool reports truncation despite the validator, do not synthesize from a prefix: re-read bounded sections completely or stop `ERROR`. The card includes diagnosis-linked steps, reuse search evidence, exact create/change/delete/move map, net lines/duplication, size/boundary evidence, validation contract, non-goals, decision ids and card version.
