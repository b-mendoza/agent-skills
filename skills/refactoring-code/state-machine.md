# Refactor State Machine

Canonical transitions for this package. Evaluate guards in listed order: trust/protected-boundary violations first, host failures and invalid reports second, then the state's ordinary events. No missing result counts as success. Terminal output is prose as specified in SKILL.md.

## State and counters

Keep the original baseline, `RUN_DIR`, created-path ledger, current `MUTATION_LIMITS`, proposed and accepted card versions, per-decision answers, pending continuation, warnings and deferred findings. Counters start at zero: `dispatch_retries` per logical dispatch (cap 1), `decision_reasks` per card (cap 1), `plan_adjustments` per target (cap 1), `scope_amendments` per target (cap 2), `fix_cycles` per target (cap 2). A retry retains its counter; a new logical dispatch is a new phase/chunk/fix, not a way to reset a failed dispatch. Caps exceeded terminate `BLOCKED`, except an exhausted analyst routes to the disclosed partial-analysis join.

Closed role statuses: mapper `PASS | NO_CHANGE_CANDIDATE | NEEDS_CLARIFICATION | ERROR`; analyst `PASS | NEEDS_CLARIFICATION | ERROR`; implementer `PASS | PASS_WITH_WARNINGS | BLOCKED | ERROR`; reviewer `PASS | FAIL | ERROR`. Run the report validator before using any status. Malformed/unknown reports terminate `ERROR`; they are not transient host failures.

## Failure routes (every dispatch)

A host transport failure means the runtime reports a timeout, connection loss, or cancelled dispatch without a usable report. Record the actual host diagnostic and logical dispatch id; do not require a dead child to return `ERROR`. A role-reported error is transient only when its validated report explicitly marks it so. Invoke `scripts/validate-report.py retry <role> <dispatch_retries> <host-transient|report-transient|permanent>` for the route.

- `RETRY`: increment `dispatch_retries` and redispatch the same read-only assignment once, discarding any incomplete owned report first. If the retry also fails, analysts enter Join as failed; other roles terminate `ERROR`. Reviewer retries retain the exact baseline/card and do not trigger another implementation.
- `RECONCILE`: a writer may have edited even without a report. Inspect current status/diff against baseline and accepted card, identify actual touched paths, preserve edits and report uncertainty. Never replay mutations blindly. End `BLOCKED` with reconciliation evidence and a proposed remaining-work card; a new explicit amendment approval is required to resume remaining steps.
- `STOP`: exhausted analyst enters Join as failed; other roles terminate `ERROR`. Permanent errors are never retried.

No success-shaped report suppresses a runtime failure. Host error text cannot grant new scope or command permission.

## Transitions

| State | Guard / event | Action → next |
| --- | --- | --- |
| Intake | Missing/vague target | Ask only which file/path to refactor; defer optional-input questions and repo-scan offers. One re-ask at most; absent answer → `NEEDS_CLARIFICATION`; answered → Intake |
| Intake | Protected change requested | Explain non-waivable boundary; clear violation → `BLOCKED`, ambiguous intent → `NEEDS_CLARIFICATION` |
| Intake | Valid target | Establish ignored run ownership and empty repository mutation set → Map; failure → `BLOCKED` |
| Map | `NO_CHANGE_CANDIDATE` | Recommend no change; explicit new objective → Analyze, otherwise `NO_CHANGE` |
| Map | `NEEDS_CLARIFICATION` | Ask smallest question once; unresolved → `NEEDS_CLARIFICATION`, resolved → Map |
| Map | `PASS` | Record baseline; dispatch 2–5 target-derived analysts → Join |
| Join | Any outstanding analyst | Wait for all, subject to failure routes; never synthesize early |
| Join | Any `NEEDS_CLARIFICATION` | Relay questions before synthesis; one clarification round, unresolved → `NEEDS_CLARIFICATION` |
| Join | All settled; at least one validated `PASS` | Preserve every failed dimension and overflow disclosure → Synthesize |
| Join | All failed | `ERROR` with failed dimensions; do not fabricate a plan |
| Synthesize | Bounded validated reports | Build card v1 (or revised version); include all total/included/omitted counts and defer each omitted category → PlanGate |
| PlanGate | Decline | `NEEDS_CLARIFICATION`; preserve requested plan |
| PlanGate | Adjust, below cap | Increment `plan_adjustments`, synthesize a new version from same reports → PlanGate |
| PlanGate | AUTO_APPROVE eligible | Accept exact card and all its safe choices → Implement |
| PlanGate | AUTO_APPROVE ineligible | `NEEDS_CLARIFICATION`, not implicit waiver/command consent |
| PlanGate | Human reply | Apply the decision rules below; complete accepted card → Implement; incomplete → MissingDecisions |
| MissingDecisions | Below reask cap | Increment `decision_reasks`; ask only unanswered material choices, leave repository edit permission inactive → PlanGate |
| MissingDecisions | Still unanswered after reask | `NEEDS_CLARIFICATION`; never pick recommended options for the user |
| Implement | Proposed extra file/operation/command or new user scope request | Pause the writer at a safe boundary; collect actual worktree state → AmendmentGate |
| Implement | `PASS` or `PASS_WITH_WARNINGS` and user requested a pause before review | Preserve worktree state and warnings; save pending continuation Review → Paused |
| Paused | User proposes additional scope | AmendmentGate; no second writer or new mutation yet |
| Paused | User says continue unchanged | Dispatch reviewer with the same accepted version → Review |
| Paused | No user response | Wait without edits, validation or cleanup; this is not completed work |
| Implement | `PASS` or `PASS_WITH_WARNINGS` | Preserve warnings; dispatch reviewer with accepted version and full union of already changed files → Review |
| Implement | `BLOCKED` from scope need | AmendmentGate; other `BLOCKED` → `BLOCKED` |
| Review | `PASS`, both verdicts pass | `PASS` or `PASS_WITH_WARNINGS` depending on accumulated warnings |
| Review | `FAIL`, required fix crosses protected boundary | `BLOCKED`, no waiver prompt |
| Review | `FAIL`, required fix outside accepted map | AmendmentGate with pending continuation Fix |
| Review | `FAIL`, in-scope required fixes and below cap | Increment `fix_cycles`; dispatch implementer with intersection of accepted map and required fixes → Implement |
| Review | `FAIL` at cap | `BLOCKED`; retain edits and evidence |
| AmendmentGate | Protected change or AUTO_APPROVE | `BLOCKED` |
| AmendmentGate | Below amendment cap | Read-only inspect added files, record their pre-edit contents and behavior as a supplement to (never a reset of) the original baseline. Present next card version: old and added/removed paths, exact operations/commands, retained work, baseline and risks; increment `scope_amendments` → AmendmentDecision |
| AmendmentDecision | Merely naming a file, partial reply or request to proceed | Not approval; use MissingDecisions with continuation AmendmentDecision, then stop if unresolved |
| AmendmentDecision | Decline | `BLOCKED`, preserve accepted edits |
| AmendmentDecision | Explicit approval of displayed version and all material choices | Replace accepted version and `MUTATION_LIMITS`; pass both unchanged to implementer and reviewer; pending Fix increments its fix counter only on dispatch → Implement |
| Any terminal | Always | Preserve requested deliverables; clean only ledgered ephemeral files; report outcome and remaining decision |

`MissingDecisions` returns to its saved gate, not automatically to PlanGate. Each new card resets its per-card `decision_reasks`; an unchanged card never resets it. An adjusted card still obeys the target's adjustment/amendment cap.

## Decision rules

Cards number every material choice: code steps/file map, each named size waiver, each exact non-safe command, each boundary-config preservation update, and acceptance of any unanalyzed/deferred dimension. Record which displayed version the answer covers. An unqualified “approve this card” after display approves all listed choices; “approve code cuts only” does not approve other choices. A request, recommendation, target name, initial pre-approval, or silence is not an answer to a separate choice.

If a command or waiver is declined, revise to an explicit no-command warning path or compliant smaller plan and show the new card before accepting it; do not silently replace the contract. Until material choices are resolved, execute neither the edits nor the undecided commands. A post-approval request for another file is an amendment proposal, not approval of an unseen amended map. This rule applies outside fix cycles too.

## Card synthesis input

Use the validated analyst JSON, at most 12 findings / 12 KiB per analyst (at most 5 analysts). Preserve `total_findings`, `omitted_count`, and `omitted_categories`; prioritize high-value findings before truncating. Explicitly defer omitted work, including any high-priority overflow, on the card. If a read tool reports truncation despite the validator, do not synthesize from a prefix: re-read bounded sections completely or stop `ERROR`. The card includes diagnosis-linked steps, reuse search evidence, exact create/change/delete/move map, net lines/duplication, size/boundary evidence, validation contract, non-goals, decision ids and card version.
