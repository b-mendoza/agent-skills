# State Machine — pr-creator

This table is the only normative list of states, transitions, guards and terminals. `ResolveMode` sets `EXECUTION_MODE` to `dispatch` or `inline`. For each state, evaluate competing guards in first-match order, from top to bottom.

Guard terms:

- **Issue step needed:** `CLOSES_ISSUES` or `RELATED_ISSUES` names at least one issue, or discovery is on and `Issue mentions` is not `none`. Discovery is on by default; `ISSUE_DISCOVERY=off` or setting both issue lists to `none` turns it off.
- **Offer:** the flag for this run's one rebase offer: `open` initially, then `declined` or `done`.
- **Offer source**, **Source behind base**: preflight's fields.

## Transitions

| From                       | To                         | Guard / event                                                                      |
| -------------------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `[*]`                      | `ResolveMode`              | run start                                                                          |
| `ResolveMode`              | `NormalizeInputs`          | mode recorded                                                                      |
| `NormalizeInputs`          | `InspectRepo`              | inputs normalized                                                                  |
| `InspectRepo`              | `TerminalBlocked`          | `REPO_STATE` is `BLOCKED` or `ERROR`                                               |
| `InspectRepo`              | `GateTopology`             | `PASS` and topology ambiguous                                                      |
| `InspectRepo`              | `GateTargetBranch`         | `PASS`, topology clear, target missing                                             |
| `InspectRepo`              | `AdaptPlatform`            | `PASS`, topology clear, target known, adapter needed                               |
| `InspectRepo`              | `GateStateFallback`        | `PASS`, path clear, draft unsupported                                              |
| `InspectRepo`              | `RunPreflight`             | `PASS`, path clear, state supported                                                |
| `GateTopology`             | `TerminalAwaitingUser`     | question pending                                                                   |
| `GateTopology`             | `GateTargetBranch`         | remotes chosen, target missing                                                     |
| `GateTopology`             | `AdaptPlatform`            | remotes chosen, target known, adapter needed                                       |
| `GateTopology`             | `RunPreflight`             | remotes chosen, ready for preflight                                                |
| `GateTargetBranch`         | `TerminalAwaitingUser`     | question pending                                                                   |
| `GateTargetBranch`         | `AdaptPlatform`            | target chosen, adapter needed                                                      |
| `GateTargetBranch`         | `GateStateFallback`        | target chosen, draft unsupported                                                   |
| `GateTargetBranch`         | `RunPreflight`             | target chosen, ready for preflight                                                 |
| `AdaptPlatform`            | `GatePlatformTooling`      | safe create path unknown                                                           |
| `AdaptPlatform`            | `GateStateFallback`        | path known, draft unsupported                                                      |
| `AdaptPlatform`            | `RunPreflight`             | path known, state supported                                                        |
| `GatePlatformTooling`      | `TerminalAwaitingUser`     | question pending                                                                   |
| `GatePlatformTooling`      | `AdaptPlatform`            | tooling answered                                                                   |
| `GateStateFallback`        | `TerminalCancelled`        | user stops                                                                         |
| `GateStateFallback`        | `RunPreflight`             | proceed as `ready`                                                                 |
| `RunPreflight` | `GateRebase` | `PASS` or `PR_EXISTS`; `Offer source` is `published`; `Source behind base` > 0; `REBASE` is not `never`; offer `open`; rebase cycles < 2 |
| `RunPreflight` | `ContinueRequest` | `PASS` or `PR_EXISTS` otherwise, including `Offer source: none` (a series over 200 commits, a mirror remote or `push.recurseSubmodules=only`); if the base is ahead of the source or no offer was made, report that and why |
| `RunPreflight`             | `GatePush`                 | `PUSH_REQUIRED` for a checkout head and push cycles &lt; 3                                             |
| `RunPreflight`             | `GatePushRejected`         | `PUSH_REJECTED`                                                                    |
| `RunPreflight`             | `TerminalAuth`             | `AUTH`                                                                             |
| `RunPreflight`             | `TerminalBaseMissing`      | `BASE_BRANCH_MISSING`                                                              |
| `RunPreflight`             | `TerminalHeadUnpushed`     | `HEAD_BRANCH_UNPUSHED`, including a named remote head that is missing; never offer a plain push for `Head source: remote` |
| `RunPreflight`             | `TerminalBlocked`          | `BLOCKED` or `ERROR`                                                               |
| `RunPreflight`             | `FinalDecision`            | `PUSH_REQUIRED` for a checkout head and push cycles ≥ 3                                                |
| `GatePush`                 | `RunPreflight`             | plain push approved; redispatch with `headRemote headBranch headSha extras action` and push `APPROVAL_RECORD`                        |
| `GatePush`                 | `TerminalAwaitingUser`     | question pending; the proposal has no editable part, so a change request is answered with the available choices and asked again                                                                   |
| `GatePush`                 | `TerminalHeadUnpushed`     | push declined                                                                      |
| `GatePushRejected`         | `RunPreflight`             | user confirms manual resolution                                                    |
| `GatePushRejected`         | `TerminalHeadUnpushed`     | stop                                                                               |
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
| `ContinueRequest` | `TerminalPrExists` | open PR |
| `ContinueRequest` | `AnalyzeDiff` | no open PR |
| `AnalyzeDiff` | `ResolveIssues` | `DIFF_ANALYSIS: PASS` and issue step needed |
| `AnalyzeDiff` | `DraftPr` | `DIFF_ANALYSIS: PASS` otherwise |
| `AnalyzeDiff`              | `GateScope`                | `LARGE_PR_CONFIRMATION_REQUIRED`: rule fired with missing or stale approval; scope cycles &lt; 3                           |
| `AnalyzeDiff`              | `TerminalEmptyDiff`        | `EMPTY_DIFF`                                                                       |
| `AnalyzeDiff`              | `RunPreflight`             | `STALE_PINS`; discard scope and preview approval                                   |
| `AnalyzeDiff`              | `TerminalBlocked`          | `ERROR`                                                                            |
| `AnalyzeDiff`              | `FinalDecision`            | scope cycles ≥ 3                                                                   |
| `GateScope`                | `AnalyzeDiff`              | current scope approved; redispatch with the verbatim `Scope values` and record to verify fresh pins, paths and counts     |
| `GateScope`                | `TerminalAwaitingUser`     | question pending; the proposal has no editable part, so a change request is answered with the available choices and asked again                                                                   |
| `GateScope`                | `TerminalCancelled`        | scope declined                                                                     |
| `ResolveIssues` | `DraftPr` | `ISSUE_REFS: PASS` |
| `ResolveIssues` | `GateIssueRefs` | `NEEDS_DECISION` or `INVALID_ISSUES`, issue-refs cycles < 3 |
| `ResolveIssues` | `FinalDecision` | `NEEDS_DECISION` or `INVALID_ISSUES`, issue-refs cycles ≥ 3 |
| `ResolveIssues` | `TerminalAuth` | `AUTH` |
| `ResolveIssues` | `TerminalBlocked` | `ERROR` |
| `GateIssueRefs` | `TerminalAwaitingUser` | question pending |
| `GateIssueRefs` | `ResolveIssues` | candidates classified or left unclassified after the re-ask (`Not referenced`), invalid references fixed or dropped, or keyword decision made; redispatch |
| `DraftPr` | `DraftPr` | `PR_DRAFT: PASS`, `title` check exits non-zero, type/scope cycles < 3; redispatch with findings |
| `DraftPr` | `SuggestMetadata` | `PR_DRAFT: PASS` and title check passes |
| `DraftPr`                  | `GateTypeScope`            | `NEEDS_CHOICE` and type/scope cycles &lt; 3                                        |
| `DraftPr`                  | `TerminalBlocked`          | `ERROR` or unresolved choice                                                       |
| `DraftPr` | `FinalDecision` | type/scope cycles ≥ 3 (including a failing `title` check) |
| `GateTypeScope`            | `TerminalAwaitingUser`     | question pending                                                                   |
| `GateTypeScope`            | `DraftPr`                  | choice answered; redispatch                                                        |
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
| `FinalDecision` | `ResolveIssues` | exact recovery targets issue references |
| `FinalDecision`            | `InspectRepo`              | exact recovery targets repo/branch                                                 |
| `FinalDecision`            | `RunPreflight`             | exact recovery targets preflight                                                   |
| `FinalDecision`            | `AnalyzeDiff`              | exact recovery targets diff                                                        |
| `FinalDecision`            | `DraftPr`                  | exact recovery targets draft                                                       |
| `FinalDecision`            | `SuggestMetadata`          | exact recovery targets metadata                                                    |
| `FinalDecision`            | `TerminalEscalated`        | stop or unusable recovery                                                          |
| `TerminalSuccess`          | `[*]`                      | report verified PR and details in prose                                            |
| `TerminalAwaitingUser`     | `[*]`                      | suspend; resume on answer                                                          |
| `TerminalPrExists`         | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalAuth`             | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalBaseMissing`      | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalHeadUnpushed`     | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalEmptyDiff`        | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalBlocked`          | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalCancelled`        | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalCreatedWithDrift` | `[*]` | report PR exists with each mismatched/unreadable field, not exact verified success |
| `TerminalCreatedWithAdditions` | `[*]` | report the URL, that all approved content is present unchanged, and each addition; not exact agreement |
| `TerminalCreateError`      | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalCreateUncertain`  | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalEscalated`        | `[*]`                      | explain stop and next action in prose                                              |
| `TerminalRebaseStopped` | `[*]` | explain why the rebase, the publish or its push stopped, what did and did not change, and the next action |

`SettleRebase` moves a local branch only after `preserve` is chosen at `GateRebaseResult`. `RunPreflight` is read-only unless entered with the plain push approved at `GatePush`.

## Consumer validation

Before routing on output from every registered specialist, the orchestrator runs the shipped `envelope` validator for that specialist. An invalid envelope gets one redispatch with findings; a second invalid result, a usage failure or missing Python/shell goes to `TerminalBlocked`. Never route on unchecked fields. Before leaving `DraftPr`, the orchestrator runs the validator's `title` mode on the title.

Approval gates: `GatePush`, `GateScope`, `GateRebase`, `GateForcePush`, `GatePreview`. All others, including `GateRebaseResult`, are choice gates. Use the plain-approval rule in [approval-protocol.md](references/approval-protocol.md). `GateTypeScope` also resolves template selection and bounded title conventions.

## Cycle ledgers

Independent counters (max 3 non-`PASS` redispatches per gate, then `FinalDecision`): `push`, `scope`, `type/scope`, `reviewer`, `label`, `assignee`, `issue-refs`, `preview-edit`. Submission uses only the bounded create retry inside `pr-submitter`.

- `validation`: 1; `TerminalBlocked`. Applies to every registered specialist.
- `approval-reask[gate]`: 1; `TerminalAwaitingUser`.
- `review`: 2; `ReviewResults` to `ShowPreview` with findings disclosed, or `FinalDecision` when no digest can be computed.
- `rebase`: 2 stale leases; over the cap, no further offer.

## Terminal decisions

Success: verified PR/MR URL. Report additions separately from exact success. Internal failure/suspension outcomes: `AUTH`, `BASE_BRANCH_MISSING`, `HEAD_BRANCH_UNPUSHED`, `EMPTY_DIFF`, `PR_EXISTS`, `REBASE_STOPPED`, `BLOCKED`, `AWAITING_USER`, `CANCELLED`, `CREATE_ERROR`, `CREATED_WITH_DRIFT`, `CREATE_UNCERTAIN`, `ESCALATED`. `AWAITING_USER` suspends rather than stops; never use `BLOCKED` for a pending question.
