# State Machine — pr-creator

Finite-state execution model for this skill. This table is the only normative list of states, transitions, guards, and terminals. `ResolveMode` sets `EXECUTION_MODE` to `dispatch` or `inline`.

Six specialists stay separate: each owns a distinct status prefix and failure mode (topology, preflight/push, scope, draft, metadata, submit). That split is earned complexity, not decoration.

## Transitions

| From                      | To                        | Guard / event                                                      |
| ------------------------- | ------------------------- | ------------------------------------------------------------------ |
| `[*]`                     | `ResolveMode`             | run start                                                          |
| `ResolveMode`             | `NormalizeInputs`         | mode recorded                                                      |
| `NormalizeInputs`         | `InspectRepo`             | inputs normalized                                                  |
| `InspectRepo`             | `TerminalBlocked`         | `REPO_STATE` is `BLOCKED` or `ERROR`                               |
| `InspectRepo`             | `GateTopology`            | `PASS` and topology ambiguous                                      |
| `InspectRepo`             | `GateTargetBranch`        | `PASS`, topology clear, target missing                             |
| `InspectRepo`             | `AdaptPlatform`           | `PASS`, topology clear, target known, adapter needed               |
| `InspectRepo`             | `GateStateFallback`       | `PASS`, path clear, draft unsupported                              |
| `InspectRepo`             | `RunPreflight`            | `PASS`, path clear, state supported                                |
| `GateTopology`            | `TerminalAwaitingUser`    | question pending                                                   |
| `GateTopology`            | `GateTargetBranch`        | remotes chosen, target missing                                     |
| `GateTopology`            | `AdaptPlatform`           | remotes chosen, target known, adapter needed                       |
| `GateTopology`            | `RunPreflight`            | remotes chosen, ready for preflight                                |
| `GateTargetBranch`        | `TerminalAwaitingUser`    | question pending                                                   |
| `GateTargetBranch`        | `AdaptPlatform`           | target chosen, adapter needed                                      |
| `GateTargetBranch`        | `GateStateFallback`       | target chosen, draft unsupported                                   |
| `GateTargetBranch`        | `RunPreflight`            | target chosen, ready for preflight                                 |
| `AdaptPlatform`           | `GatePlatformTooling`     | safe create path unknown                                           |
| `AdaptPlatform`           | `GateStateFallback`       | path known, draft unsupported                                      |
| `AdaptPlatform`           | `RunPreflight`            | path known, state supported                                        |
| `GatePlatformTooling`     | `TerminalAwaitingUser`    | question pending                                                   |
| `GatePlatformTooling`     | `AdaptPlatform`           | tooling answered                                                   |
| `GateStateFallback`       | `TerminalCancelled`       | user stops                                                         |
| `GateStateFallback`       | `RunPreflight`            | proceed as `ready`                                                 |
| `RunPreflight`            | `AnalyzeDiff`             | `PREFLIGHT: PASS`                                                  |
| `RunPreflight`            | `TerminalPrExists`        | `PR_EXISTS`                                                        |
| `RunPreflight`            | `GatePush`                | `PUSH_REQUIRED` and push cycles &lt; 3                             |
| `RunPreflight`            | `GatePushRejected`        | `PUSH_REJECTED`                                                    |
| `RunPreflight`            | `TerminalAuth`            | `AUTH`                                                             |
| `RunPreflight`            | `TerminalBaseMissing`     | `BASE_BRANCH_MISSING`                                              |
| `RunPreflight`            | `TerminalHeadUnpushed`    | `HEAD_BRANCH_UNPUSHED`                                             |
| `RunPreflight`            | `TerminalBlocked`         | `BLOCKED` or `ERROR`                                               |
| `RunPreflight`            | `FinalDecision`           | `PUSH_REQUIRED` and push cycles ≥ 3                                |
| `GatePush`                | `RunPreflight`            | plain push approved; redispatch with push `APPROVAL_RECORD`        |
| `GatePush`                | `TerminalHeadUnpushed`    | push declined                                                      |
| `GatePushRejected`        | `RunPreflight`            | user confirms manual resolution                                    |
| `GatePushRejected`        | `TerminalHeadUnpushed`    | stop                                                               |
| `AnalyzeDiff`             | `DraftPr`                 | `DIFF_ANALYSIS: PASS`                                              |
| `AnalyzeDiff`             | `GateScope`               | `LARGE_PR_CONFIRMATION_REQUIRED` and scope cycles &lt; 3           |
| `AnalyzeDiff`             | `TerminalEmptyDiff`       | `EMPTY_DIFF`                                                       |
| `AnalyzeDiff`             | `TerminalBlocked`         | `ERROR`                                                            |
| `AnalyzeDiff`             | `FinalDecision`           | scope cycles ≥ 3                                                   |
| `GateScope`               | `AnalyzeDiff`             | large/mixed approved; redispatch                                   |
| `GateScope`               | `TerminalCancelled`       | scope declined                                                     |
| `DraftPr`                 | `SuggestMetadata`         | `PR_DRAFT: PASS`                                                   |
| `DraftPr`                 | `GateTypeScope`           | `NEEDS_CHOICE` and type/scope cycles &lt; 3                        |
| `DraftPr`                 | `TerminalBlocked`         | `ERROR` or unresolved choice                                       |
| `DraftPr`                 | `FinalDecision`           | type/scope cycles ≥ 3                                              |
| `GateTypeScope`           | `TerminalAwaitingUser`    | question pending                                                   |
| `GateTypeScope`           | `DraftPr`                 | choice answered; redispatch                                        |
| `SuggestMetadata`         | `ShowPreview`             | `REVIEW_METADATA: PASS`                                            |
| `SuggestMetadata`         | `GateReviewer`            | `NEEDS_REVIEWER` and reviewer cycles &lt; 3                        |
| `SuggestMetadata`         | `GateLabels`              | `INVALID_LABELS` and label cycles &lt; 3                           |
| `SuggestMetadata`         | `TerminalAuth`            | `AUTH`                                                             |
| `SuggestMetadata`         | `TerminalBlocked`         | `ERROR`                                                            |
| `SuggestMetadata`         | `FinalDecision`           | reviewer or label cycles ≥ 3                                       |
| `GateReviewer`            | `TerminalAwaitingUser`    | question pending                                                   |
| `GateReviewer`            | `SuggestMetadata`         | reviewers or `none`; redispatch                                    |
| `GateLabels`              | `TerminalAwaitingUser`    | question pending                                                   |
| `GateLabels`              | `SuggestMetadata`         | labels resolved; redispatch                                        |
| `ShowPreview`             | `GatePreview`             | preview shown                                                      |
| `GatePreview`             | `FreezeApproval`          | exact preview approved                                             |
| `GatePreview`             | `TerminalCancelled`       | declined without edits                                             |
| `GatePreview`             | `InspectRepo`             | edits; earliest phase is repo/platform; preview-edit cycles &lt; 3 |
| `GatePreview`             | `AnalyzeDiff`             | edits; earliest phase is diff/scope; cycles &lt; 3                 |
| `GatePreview`             | `DraftPr`                 | edits; earliest phase is title/body; cycles &lt; 3                 |
| `GatePreview`             | `SuggestMetadata`         | edits; earliest phase is reviewers/labels; cycles &lt; 3           |
| `GatePreview`             | `FinalDecision`           | preview-edit cycles ≥ 3                                            |
| `FreezeApproval`          | `SubmitPr`                | freeze + preview `APPROVAL_RECORD` ready                           |
| `SubmitPr`                | `AnalyzeDiff`             | `HEAD_MOVED` (counts as preview-edit cycle)                        |
| `SubmitPr`                | `VerifySubmit`            | `PR_SUBMIT: PASS`                                                  |
| `SubmitPr`                | `TerminalCreateUncertain` | `CREATE_UNCERTAIN`                                                 |
| `SubmitPr`                | `TerminalCreateError`     | `CREATE_ERROR`                                                     |
| `SubmitPr`                | `TerminalAuth`            | `AUTH`                                                             |
| `SubmitPr`                | `TerminalBlocked`         | `BLOCKED` or `ERROR`                                               |
| `VerifySubmit`            | `TerminalSuccess`         | every echoed field and both body digests match                     |
| `VerifySubmit`            | `TerminalCreateError`     | mismatch                                                           |
| `FinalDecision`           | `InspectRepo`             | exact recovery targets repo/branch                                 |
| `FinalDecision`           | `RunPreflight`            | exact recovery targets preflight                                   |
| `FinalDecision`           | `AnalyzeDiff`             | exact recovery targets diff                                        |
| `FinalDecision`           | `DraftPr`                 | exact recovery targets draft                                       |
| `FinalDecision`           | `SuggestMetadata`         | exact recovery targets metadata                                    |
| `FinalDecision`           | `TerminalEscalated`       | stop or unusable recovery                                          |
| `TerminalSuccess`         | `[*]`                     | report verified PR and details in prose                                                 |
| `TerminalAwaitingUser`    | `[*]`                     | suspend; resume on answer                                          |
| `TerminalPrExists`        | `[*]`                     | explain stop and next action in prose                                              |
| `TerminalAuth`            | `[*]`                     | explain stop and next action in prose                                              |
| `TerminalBaseMissing`     | `[*]`                     | explain stop and next action in prose                                              |
| `TerminalHeadUnpushed`    | `[*]`                     | explain stop and next action in prose                                              |
| `TerminalEmptyDiff`       | `[*]`                     | explain stop and next action in prose                                              |
| `TerminalBlocked`         | `[*]`                     | explain stop and next action in prose                                              |
| `TerminalCancelled`       | `[*]`                     | explain stop and next action in prose                                              |
| `TerminalCreateError`     | `[*]`                     | explain stop and next action in prose                                              |
| `TerminalCreateUncertain` | `[*]`                     | explain stop and next action in prose                                              |
| `TerminalEscalated`       | `[*]`                     | explain stop and next action in prose                                              |

## Cycle ledgers

Independent counters (max 3 non-`PASS` redispatches per gate, then `FinalDecision`): `push`, `scope`, `type/scope`, `reviewer`, `label`, `preview-edit`. Submission uses only the bounded create retry inside `pr-submitter`.

## Terminal decisions

Success: verified PR/MR URL. Internal failure/suspension outcomes: `AUTH`, `BASE_BRANCH_MISSING`, `HEAD_BRANCH_UNPUSHED`, `EMPTY_DIFF`, `PR_EXISTS`, `BLOCKED`, `AWAITING_USER`, `CANCELLED`, `CREATE_ERROR`, `CREATE_UNCERTAIN`, `ESCALATED`. `AWAITING_USER` suspends rather than stops; never use `BLOCKED` for a pending question.
