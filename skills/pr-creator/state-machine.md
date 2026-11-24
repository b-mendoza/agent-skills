# State Machine — pr-creator

This table is the only normative list of states, transitions, guards and terminals. `ResolveMode` sets `EXECUTION_MODE` to `dispatch` or `inline`. For each state, evaluate competing guards in first-match order, from top to bottom.

Guard terms:

- **Existing request:** `EXISTING_PR=update` or `BODY_EDIT` given.
- **Issue step needed:** `CLOSES_ISSUES` or `RELATED_ISSUES` names at least one issue, or discovery is on and `Issue mentions` is not `none`. Discovery is on by default; `ISSUE_DISCOVERY=off` or setting both issue lists to `none` turns it off.
- **Offer:** the flag for this run's one rebase-or-publish offer: `open` initially, then `declined` or `done`.
- **Offer source**, **Source behind base**: preflight's fields.

## Transitions

| From | To | Guard / event |
| --- | --- | --- |
| `[*]` | `ResolveMode` | run start |
| `ResolveMode` | `NormalizeInputs` | mode recorded |
| `NormalizeInputs` | `InspectRepo` | inputs normalized |
| `InspectRepo` | `TerminalBlocked` | `REPO_STATE` is `BLOCKED` or `ERROR` |
| `InspectRepo` | `GateTopology` | `PASS` and topology ambiguous |
| `InspectRepo` | `GateTargetBranch` | `PASS`, topology clear, target missing |
| `InspectRepo` | `AdaptPlatform` | `PASS`, topology clear, target known, adapter needed |
| `InspectRepo` | `GateStateFallback` | `PASS`, path clear, draft unsupported |
| `InspectRepo` | `RunPreflight` | `PASS`, path clear, state supported |
| `GateTopology` | `TerminalAwaitingUser` | question pending |
| `GateTopology` | `GateTargetBranch` | remotes chosen, target missing |
| `GateTopology` | `AdaptPlatform` | remotes chosen, target known, adapter needed |
| `GateTopology` | `RunPreflight` | remotes chosen, ready for preflight |
| `GateTargetBranch` | `TerminalAwaitingUser` | question pending |
| `GateTargetBranch` | `AdaptPlatform` | target chosen, adapter needed |
| `GateTargetBranch` | `GateStateFallback` | target chosen, draft unsupported |
| `GateTargetBranch` | `RunPreflight` | target chosen, ready for preflight |
| `AdaptPlatform` | `GatePlatformTooling` | safe create path unknown |
| `AdaptPlatform` | `GateStateFallback` | path known, draft unsupported |
| `AdaptPlatform` | `RunPreflight` | path known, state supported |
| `GatePlatformTooling` | `TerminalAwaitingUser` | question pending |
| `GatePlatformTooling` | `AdaptPlatform` | tooling answered |
| `GateStateFallback` | `TerminalCancelled` | user stops |
| `GateStateFallback` | `RunPreflight` | proceed as `ready` |
| `RunPreflight` | `TerminalPrExists` | `PR_EXISTS` and `EXISTING_PR=stop` |
| `RunPreflight` | `TerminalBlocked` | `PASS` and `BODY_EDIT` given: no open PR to act on |
| `RunPreflight` | `GateRebase` | `PASS` or `PR_EXISTS`; `Offer source` is `published` or `local`; `Source behind base` > 0; `REBASE` is not `never`; offer `open`; rebase cycles < 2 |
| `RunPreflight` | `GateForcePush` | `PASS` or `PR_EXISTS`; `Offer source: local`; `Source behind base` = 0; offer `open`; rebase cycles < 2 |
| `RunPreflight` | `ContinueRequest` | `PASS` or `PR_EXISTS` otherwise, including `Offer source: none` (a published-only commit, a series over 200 commits, a mirror remote or `push.recurseSubmodules=only`); if the base is ahead of the source or no offer was made, report that and why |
| `RunPreflight` | `GatePush` | `PUSH_REQUIRED` and push cycles < 3 |
| `RunPreflight` | `GatePushRejected` | `PUSH_REJECTED` |
| `RunPreflight` | `TerminalAuth` | `AUTH` |
| `RunPreflight` | `TerminalBaseMissing` | `BASE_BRANCH_MISSING` |
| `RunPreflight` | `TerminalHeadUnpushed` | `HEAD_BRANCH_UNPUSHED` |
| `RunPreflight` | `TerminalBlocked` | `BLOCKED` or `ERROR` |
| `RunPreflight` | `FinalDecision` | `PUSH_REQUIRED` and push cycles ≥ 3 |
| `GatePush` | `RunPreflight` | plain push approved; redispatch with push `APPROVAL_RECORD` |
| `GatePush` | `TerminalAwaitingUser` | question pending; the proposal has no editable part, so a change request is answered with the available choices and asked again |
| `GatePush` | `TerminalHeadUnpushed` | push declined |
| `GatePushRejected` | `RunPreflight` | user confirms manual resolution |
| `GatePushRejected` | `TerminalHeadUnpushed` | stop |
| `GateRebase` | `TerminalAwaitingUser` | question pending; the offer has no editable part, so a change request is answered with the three choices and asked again |
| `GateRebase` | `RunRebase` | approved; `rebase` record written |
| `GateRebase` | `TerminalCancelled` | user stops the run |
| `GateRebase` | `ContinueRequest` | declined; offer `declined` |
| `RunRebase` | `GateForcePush` | `REBASE: REBASED` |
| `RunRebase` | `TerminalRebaseStopped` | `CONFLICT` or `BLOCKED` |
| `RunRebase` | `TerminalBlocked` | `ERROR`, or a status of another action (`PUSHED`, `LEASE_REJECTED`, `PUSH_REJECTED`, `KEPT`, `DISCARDED`) |
| `GateForcePush` | `TerminalAwaitingUser` | question pending |
| `GateForcePush` | `RunForcePush` | approved; `force-push` record written |
| `GateForcePush` | `GateRebaseResult` | declined or change requested, after a rebase this run produced; nothing pushed |
| `GateForcePush` | `ContinueRequest` | declined or change requested, direct publish of the local branch; offer `declined`; nothing pushed |
| `GateForcePush` | `TerminalCancelled` | user stops the run |
| `GateRebaseResult` | `TerminalAwaitingUser` | question pending; any answer other than the two choices or a stop is answered with the choices and asked again |
| `GateRebaseResult` | `SettleRebase` | `preserve` or `discard` chosen |
| `GateRebaseResult` | `TerminalCancelled` | user stops the run; this run's two refs removed at cleanup |
| `SettleRebase` | `ContinueRequest` | `KEPT` or `DISCARDED`; offer `declined`; published head and pins unchanged |
| `SettleRebase` | `TerminalBlocked` | `BLOCKED`, `ERROR` or any other status |
| `RunForcePush` | `RunPreflight` | `PUSHED`; offer `done`; re-pin |
| `RunForcePush` | `RunPreflight` | `LEASE_REJECTED`; discard the result; offer `open`; count one rebase cycle |
| `RunForcePush` | `TerminalRebaseStopped` | `PUSH_REJECTED` or `BLOCKED` |
| `RunForcePush` | `TerminalBlocked` | `ERROR`, or a status of another action (`REBASED`, `CONFLICT`, `KEPT`, `DISCARDED`) |
| `ContinueRequest` | `ReadBaseline` | open PR and existing request |
| `ContinueRequest` | `GateExistingPr` | open PR otherwise |
| `ContinueRequest` | `AnalyzeDiff` | no open PR |
| `GateExistingPr` | `TerminalAwaitingUser` | question pending |
| `GateExistingPr` | `ReadBaseline` | user chooses update |
| `GateExistingPr` | `TerminalPrExists` | user chooses stop |
| `ReadBaseline` | `PlanActions` | `PR_UPDATE: BASELINE` |
| `ReadBaseline` | `TerminalAuth` | `AUTH` |
| `ReadBaseline` | `TerminalBlocked` | `BLOCKED`, `ERROR`, or an apply-action status (`UPDATED`, `UPDATED_WITH_ADDITIONS`, `PARTIAL`, `PR_CHANGED`) |
| `PlanActions` | `TerminalBlocked` | request needs a removal or a base or head change; nothing written |
| `PlanActions` | `TerminalPrExists` | no action requested |
| `PlanActions` | `NextAction` | queue contains the requested PR update |
| `NextAction` | `TerminalActionsDone` | queue empty |
| `NextAction` | `AnalyzeDiff` | next is the PR update and it regenerates title or body or changes issue references |
| `NextAction` | `DraftPr` | next is the PR update with `TITLE_OVERRIDE`, `BODY_OVERRIDE` or `BODY_EDIT`; metadata or state inputs may accompany it |
| `NextAction` | `SuggestMetadata` | next is the PR update with reviewer, label or assignee inputs and no title or body input |
| `NextAction` | `ReviewResults` | next is the PR update with only a state change |
| `AnalyzeDiff` | `ResolveIssues` | `DIFF_ANALYSIS: PASS` and issue step needed |
| `AnalyzeDiff` | `DraftPr` | `DIFF_ANALYSIS: PASS` otherwise |
| `AnalyzeDiff` | `GateScope` | `LARGE_PR_CONFIRMATION_REQUIRED` and scope cycles < 3 |
| `AnalyzeDiff` | `TerminalEmptyDiff` | `EMPTY_DIFF` |
| `AnalyzeDiff` | `RunPreflight` | `STALE_PINS`; discard scope and preview approval |
| `AnalyzeDiff` | `TerminalBlocked` | `ERROR` |
| `AnalyzeDiff` | `FinalDecision` | scope cycles ≥ 3 |
| `GateScope` | `AnalyzeDiff` | current scope approved; record pinned SHA/evidence digest and redispatch |
| `GateScope` | `TerminalAwaitingUser` | question pending; the proposal has no editable part, so a change request is answered with the available choices and asked again |
| `GateScope` | `TerminalCancelled` | scope declined |
| `ResolveIssues` | `DraftPr` | `ISSUE_REFS: PASS` |
| `ResolveIssues` | `GateIssueRefs` | `NEEDS_DECISION` or `INVALID_ISSUES`, issue-refs cycles < 3 |
| `ResolveIssues` | `FinalDecision` | `NEEDS_DECISION` or `INVALID_ISSUES`, issue-refs cycles ≥ 3 |
| `ResolveIssues` | `TerminalAuth` | `AUTH` |
| `ResolveIssues` | `TerminalBlocked` | `ERROR` |
| `GateIssueRefs` | `TerminalAwaitingUser` | question pending |
| `GateIssueRefs` | `ResolveIssues` | candidates classified or left unclassified after the re-ask (`Not referenced`), invalid references fixed or dropped, or keyword decision made; redispatch |
| `DraftPr` | `DraftPr` | `PR_DRAFT: PASS`, title changed, `title` check exits non-zero, type/scope cycles < 3; redispatch with findings |
| `DraftPr` | `SuggestMetadata` | `PASS`, title check passes or title unchanged, and create path or reviewer/label/assignee inputs given |
| `DraftPr` | `ReviewResults` | `PASS`, title check passes or title unchanged, existing-PR path with no metadata inputs |
| `DraftPr` | `GateTypeScope` | `NEEDS_CHOICE` and type/scope cycles < 3 |
| `DraftPr` | `TerminalBlocked` | `ERROR` or unresolved choice |
| `DraftPr` | `FinalDecision` | type/scope cycles ≥ 3 (including a failing `title` check) |
| `GateTypeScope` | `TerminalAwaitingUser` | question pending |
| `GateTypeScope` | `DraftPr` | choice answered; redispatch |
| `SuggestMetadata` | `ReviewResults` | `REVIEW_METADATA: PASS` |
| `SuggestMetadata` | `GateReviewer` | `NEEDS_REVIEWER` and reviewer cycles < 3 |
| `SuggestMetadata` | `GateLabels` | `INVALID_LABELS` and label cycles < 3 |
| `SuggestMetadata` | `GateAssignees` | `INVALID_ASSIGNEES` and assignee cycles < 3 |
| `SuggestMetadata` | `TerminalAuth` | `AUTH` |
| `SuggestMetadata` | `TerminalBlocked` | `ERROR` |
| `SuggestMetadata` | `FinalDecision` | reviewer, label or assignee cycles ≥ 3 |
| `GateReviewer` | `TerminalAwaitingUser` | question pending |
| `GateReviewer` | `SuggestMetadata` | reviewers or `none`; redispatch |
| `GateLabels` | `TerminalAwaitingUser` | question pending |
| `GateLabels` | `SuggestMetadata` | labels resolved; redispatch |
| `GateAssignees` | `TerminalAwaitingUser` | question pending |
| `GateAssignees` | `SuggestMetadata` | assignable users or none supplied; redispatch |
| `ReviewResults` | `FinalDecision` | values digest exits 1 and (the offending text is a user override or review rounds ≥ 2) |
| `ReviewResults` | `AnalyzeDiff` | findings; earliest affected specialist is `diff-analyzer`; review rounds < 2 |
| `ReviewResults` | `ResolveIssues` | findings; earliest is `issue-reference-resolver`; review rounds < 2 |
| `ReviewResults` | `DraftPr` | findings; earliest is `pr-drafter`; review rounds < 2 |
| `ReviewResults` | `SuggestMetadata` | findings; earliest is `review-metadata-suggester`; review rounds < 2 |
| `ReviewResults` | `ShowPreview` | create path; digest computed; no findings, or review rounds ≥ 2 with findings disclosed |
| `ReviewResults` | `ShowUpdatePreview` | existing-PR path; same condition |
| `ShowPreview` | `GatePreview` | preview shown; `pending.json` written |
| `GatePreview` | `ResolveIssues` | edits; earliest phase is issue references; preview-edit cycles < 3 |
| `GatePreview` | `TerminalAwaitingUser` | question pending |
| `GatePreview` | `FreezeApproval` | exact preview approved |
| `GatePreview` | `TerminalCancelled` | declined without edits |
| `GatePreview` | `InspectRepo` | edits; earliest phase is repo/platform; preview-edit cycles < 3 |
| `GatePreview` | `AnalyzeDiff` | edits; earliest phase is diff/scope; cycles < 3 |
| `GatePreview` | `DraftPr` | edits; earliest phase is title/body; cycles < 3 |
| `GatePreview` | `SuggestMetadata` | edits; earliest phase is reviewers/labels/assignees; cycles < 3 |
| `GatePreview` | `FinalDecision` | preview-edit cycles ≥ 3 |
| `FreezeApproval` | `SubmitPr` | freeze + preview `APPROVAL_RECORD` ready |
| `SubmitPr` | `VerifySubmit` | `PR_SUBMIT: PASS`, `CREATED_WITH_ADDITIONS` or `CREATED_WITH_DRIFT` |
| `SubmitPr` | `RunPreflight` | `HEAD_MOVED`; clear scope/preview approval (preview-edit cycle) |
| `SubmitPr` | `TerminalCreateUncertain` | `CREATE_UNCERTAIN` |
| `SubmitPr` | `TerminalCreateError` | `CREATE_ERROR` |
| `SubmitPr` | `TerminalAuth` | `AUTH` |
| `SubmitPr` | `TerminalBlocked` | `BLOCKED` or `ERROR` |
| `VerifySubmit` | `TerminalSuccess` | status `PASS` and the orchestrator's `compare preview` outcome is `exact` |
| `VerifySubmit` | `TerminalCreatedWithAdditions` | the worse of the two outcomes is `additions` |
| `VerifySubmit` | `TerminalCreatedWithDrift` | the worse of the two outcomes is `drift`, or `compare` cannot run |
| `ShowUpdatePreview` | `GateUpdate` | update preview shown; `pending.json` written |
| `GateUpdate` | `TerminalAwaitingUser` | question pending |
| `GateUpdate` | `FreezeUpdate` | exact update approved |
| `GateUpdate` | `ReadBaseline` | edits; preview-edit cycles < 3; approval void |
| `GateUpdate` | `FinalDecision` | preview-edit cycles ≥ 3 |
| `GateUpdate` | `TerminalCancelled` | declined without edits; nothing written |
| `FreezeUpdate` | `ApplyUpdate` | `update` record written; values digest equals `pending.json` |
| `ApplyUpdate` | `VerifyUpdate` | `UPDATED`, `UPDATED_WITH_ADDITIONS` or `PARTIAL` |
| `ApplyUpdate` | `ReadBaseline` | `PR_CHANGED`, update-refresh cycles < 3; approval void; nothing written |
| `ApplyUpdate` | `TerminalActionsPartial` | `PR_CHANGED` with update-refresh cycles ≥ 3, or `AUTH`, `BLOCKED`, `ERROR`, `BASELINE` |
| `VerifyUpdate` | `NextAction` | status not `PARTIAL`; `Repository` and `Number` equal the frozen values; `Approval record: valid`; the orchestrator's `compare update` outcome is `exact` or `additions`; result recorded |
| `VerifyUpdate` | `TerminalActionsPartial` | `PARTIAL`, outcome `drift`, or `compare` cannot run |
| `FinalDecision` | `ResolveIssues` | exact recovery targets issue references |
| `FinalDecision` | `ReadBaseline` | exact recovery targets the pending update |
| `FinalDecision` | `InspectRepo` | exact recovery targets repo/branch |
| `FinalDecision` | `RunPreflight` | exact recovery targets preflight |
| `FinalDecision` | `AnalyzeDiff` | exact recovery targets diff |
| `FinalDecision` | `DraftPr` | exact recovery targets draft |
| `FinalDecision` | `SuggestMetadata` | exact recovery targets metadata |
| `FinalDecision` | `TerminalEscalated` | stop or unusable recovery |
| `TerminalSuccess` | `[*]` | report verified PR and details in prose |
| `TerminalAwaitingUser` | `[*]` | suspend; resume on answer |
| `TerminalPrExists` | `[*]` | return the URL; nothing created or edited; say an update can be requested |
| `TerminalAuth` | `[*]` | explain stop and next action in prose |
| `TerminalBaseMissing` | `[*]` | explain stop and next action in prose |
| `TerminalHeadUnpushed` | `[*]` | explain stop and next action in prose |
| `TerminalEmptyDiff` | `[*]` | explain stop and next action in prose |
| `TerminalBlocked` | `[*]` | explain stop and next action in prose |
| `TerminalCancelled` | `[*]` | explain stop and next action in prose |
| `TerminalCreatedWithDrift` | `[*]` | report PR exists with each mismatched/unreadable field, not exact verified success |
| `TerminalCreateError` | `[*]` | explain stop and next action in prose |
| `TerminalCreateUncertain` | `[*]` | explain stop and next action in prose |
| `TerminalEscalated` | `[*]` | explain stop and next action in prose |
| `TerminalRebaseStopped` | `[*]` | explain why the rebase, the publish or its push stopped, what did and did not change, and the next action |
| `TerminalCreatedWithAdditions` | `[*]` | report the URL, that all approved content is present unchanged, and each addition; not exact agreement |
| `TerminalActionsDone` | `[*]` | report the verified PR update |
| `TerminalActionsPartial` | `[*]` | report the failed or partial update and its evidence |

No edge leads from `SubmitPr`, `VerifySubmit` or any create terminal into `ReadBaseline` or `ApplyUpdate`. Each mutating state is entered only from its own `Freeze*` or gate-approved state. `SettleRebase` moves a local branch only after `preserve` is chosen at `GateRebaseResult`. `RunPreflight` is read-only unless entered with the plain push approved at `GatePush`.

## Consumer validation

Before routing on output from every registered specialist, the orchestrator runs the shipped `envelope` validator for that specialist. An invalid envelope gets one redispatch with findings; a second invalid result, a usage failure or missing Python/shell goes to `TerminalBlocked`. Never route on unchecked fields. Before leaving `DraftPr`, the orchestrator runs the validator's `title` mode on a changed title.

Approval gates: `GatePush`, `GateScope`, `GateRebase`, `GateForcePush`, `GatePreview`, `GateUpdate`. All others, including `GateRebaseResult`, are choice gates. Use the plain-approval rule in [approval-protocol.md](references/approval-protocol.md). `GateTypeScope` also resolves template selection and bounded title conventions.

## Cycle ledgers

Independent counters, caps and over-cap routes:

- `push`, `scope`, `type/scope`, `reviewer`, `label`, `assignee`: 3 each; `FinalDecision`.
- `preview-edit`: 3 per gate (`GatePreview`, `GateUpdate`); both go to `FinalDecision`.
- `validation`: 1; `TerminalBlocked`. Applies to every registered specialist.
- `approval-reask[gate]`: 1; `TerminalAwaitingUser`.
- `issue-refs`: 3; `ResolveIssues` to `FinalDecision`.
- `review`: 2; `ReviewResults` to `ShowPreview` or `ShowUpdatePreview` with findings disclosed, or `FinalDecision` when no digest can be computed.
- `rebase`: 2 stale leases, whichever source; over the cap, no further offer.
- `update-refresh`: 3; `ApplyUpdate` to `TerminalActionsPartial`.

Submission uses only the bounded create retry inside `pr-submitter`.

## Terminal decisions

Create outcomes: a verified PR/MR URL, `CREATED_WITH_ADDITIONS`, `CREATED_WITH_DRIFT`, `CREATE_ERROR` or `CREATE_UNCERTAIN`. Rebase can end with `REBASE_STOPPED`; queued actions end with `ACTIONS_DONE` or `ACTIONS_PARTIAL`.

Other outcomes: `AUTH`, `BASE_BRANCH_MISSING`, `HEAD_BRANCH_UNPUSHED`, `EMPTY_DIFF`, `PR_EXISTS`, `BLOCKED`, `AWAITING_USER`, `CANCELLED`, `ESCALATED`. `AWAITING_USER` suspends rather than stops; never use `BLOCKED` for a pending question.
