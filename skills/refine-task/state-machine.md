# State Machine — refine-task

Finite-state execution model for this skill. This table is the authoritative list of states, transitions, guards, and terminals. Normative gate wording lives in [`references/reviewer-policy.md`](./references/reviewer-policy.md).

## States

| State                        | Kind     | Role                                                                                                                  |
| ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `Intake`                     | active   | Capture `ITEM_URL`, `ITEM_CONTEXT`, `WRITE_MODE`, `POSTING_APPROVAL`, `HUMAN_APPROVALS`; ambiguous write → draft path |
| `GateSource`                 | active   | Require `ITEM_URL` or non-empty `ITEM_CONTEXT`                                                                        |
| `AskSource`                  | active   | One source question; interactive wait                                                                                 |
| `GateMutation`               | active   | Mutation-only vs review / mixed                                                                                       |
| `ResolveTooling`             | active   | Resolve read path; resolve write only if posting requested                                                            |
| `GatePlatform`               | active   | Classify Jira/GitHub vs unsupported                                                                                   |
| `AskPlatform`                | active   | One question for usable context on unsupported URL                                                                    |
| `GateReadPath`               | active   | Confirm read path or usable pasted context                                                                            |
| `AskRead`                    | active   | One access question                                                                                                   |
| `GatePostingClarity`         | active   | If posting requested, confirm auth/write tooling                                                                      |
| `AskPosting`                 | active   | One posting-clarity question                                                                                          |
| `DispatchReviewer`           | active   | Dispatch refinement-reviewer with absolute SKILL_ROOT                                                                 |
| `ParseReturn`                | active   | Require known `REVIEW` syntax; retain compact fields only                                                             |
| `Redispatch`                 | active   | Exactly one re-dispatch with malformed-return note                                                                    |
| `RouteReview`                | active   | Route on `PASS` / `BLOCKED` / `FAIL` / `ERROR`                                                                        |
| `ChooseOutputPath`           | active   | Draft/unknown vs `post-comment` after `REVIEW: PASS`                                                                  |
| `GatePostPreconditions`      | active   | Check posting preconditions 1–4; preview and idempotency follow                                                                                     |
| `PreviewGate`                | active   | Preview confirm, decline, unattended, or quoted pre-approval                                                          |
| `IdempotencyCheck`           | active   | Detect matching existing refinement comment                                                                           |
| `AttemptPost`                | active   | Exactly one post of the exact comment                                                                                 |
| `VerifyPost`                 | active   | Verify success, safe failure, or indeterminate readback                                                               |
| `TerminalBlockedNotReviewed` | terminal | Review blocked before dispatch; explain why in prose                                                                               |
| `TerminalDeferred`           | terminal | Mutation deferred without review; explain in prose                                                                              |
| `TerminalBlocked`            | terminal | Blocked after dispatch or unsafe post; explain in prose                                                                         |
| `TerminalDraft`              | terminal | Unposted draft with prose outcome                                                                                                         |
| `TerminalReadyToPost`        | terminal | Comment available pending approval; prose outcome                                                                                                 |
| `TerminalPosted`             | terminal | Verified posting; prose outcome                                                                                                        |
| `TerminalAlreadyPosted`      | terminal | Existing matching comment; prose outcome                                                                                                |

## Transitions

| From                         | To                           | Guard / event                                    |
| ---------------------------- | ---------------------------- | ------------------------------------------------ |
| `[*]`                        | `Intake`                     | run start                                        |
| `Intake`                     | `GateSource`                 | inputs captured                                  |
| `GateSource`                 | `AskSource`                  | no source pointer                                |
| `GateSource`                 | `GateMutation`               | source pointer exists                            |
| `AskSource`                  | `Intake`                     | answered interactive                             |
| `AskSource`                  | `TerminalBlockedNotReviewed` | unattended or unanswered                         |
| `GateMutation`               | `TerminalDeferred`           | mutation-only                                    |
| `GateMutation`               | `ResolveTooling`             | review or mixed (record declined mutations)      |
| `ResolveTooling`             | `GatePlatform`               | read path recorded (or absence noted)            |
| `GatePlatform`               | `GateReadPath`               | Jira or GitHub                                   |
| `GatePlatform`               | `GatePostingClarity`         | unsupported URL with usable context (draft-only) |
| `GatePlatform`               | `AskPlatform`                | unsupported URL without usable context           |
| `AskPlatform`                | `Intake`                     | answered interactive                             |
| `AskPlatform`                | `TerminalBlockedNotReviewed` | unattended or unanswered                         |
| `GateReadPath`               | `AskRead`                    | no read path and no usable context               |
| `GateReadPath`               | `GatePostingClarity`         | read path or usable context                      |
| `AskRead`                    | `ResolveTooling`             | answered interactive                             |
| `AskRead`                    | `TerminalBlockedNotReviewed` | unattended or unanswered                         |
| `GatePostingClarity`         | `AskPosting`                 | `post-comment` and auth/tooling unclear          |
| `GatePostingClarity`         | `DispatchReviewer`           | posting clear or not requested                   |
| `AskPosting`                 | `GatePostingClarity`         | answered interactive                             |
| `AskPosting`                 | `DispatchReviewer`           | unattended → downgrade to draft                  |
| `DispatchReviewer`           | `ParseReturn`                | reviewer returned                                |
| `ParseReturn`                | `Redispatch`                 | missing/unknown `REVIEW`, first time             |
| `ParseReturn`                | `RouteReview`                | known `REVIEW` state                             |
| `Redispatch`                 | `DispatchReviewer`           | one re-dispatch with defect note                 |
| `ParseReturn`                | `RouteReview`                | second malformed → treat as `REVIEW: ERROR`      |
| `RouteReview`                | `TerminalBlocked`            | `REVIEW: BLOCKED` or `REVIEW: ERROR`             |
| `RouteReview`                | `TerminalDraft`              | `REVIEW: FAIL`                                   |
| `RouteReview`                | `ChooseOutputPath`           | `REVIEW: PASS`                                   |
| `ChooseOutputPath`           | `TerminalReadyToPost`        | draft/unknown and `Comment mode: Ready to post`  |
| `ChooseOutputPath`           | `TerminalDraft`              | draft/unknown and `Comment mode: Draft`          |
| `ChooseOutputPath`           | `GatePostPreconditions`      | `WRITE_MODE=post-comment`                        |
| `GatePostPreconditions`      | `TerminalReadyToPost`        | preconditions fail; comment ready                |
| `GatePostPreconditions`      | `TerminalDraft`              | preconditions fail; comment draft                |
| `GatePostPreconditions`      | `PreviewGate`                | posting preconditions 1–4 true               |
| `PreviewGate`                | `TerminalDraft`              | preview declined                                 |
| `PreviewGate`                | `TerminalReadyToPost`        | preview unattended                               |
| `PreviewGate`                | `IdempotencyCheck`           | preview confirmed or pre-approved quoted         |
| `IdempotencyCheck`           | `TerminalAlreadyPosted`      | matching comment exists                          |
| `IdempotencyCheck`           | `AttemptPost`                | idempotency clean                                |
| `AttemptPost`                | `VerifyPost`                 | one exact post attempted                         |
| `VerifyPost`                 | `TerminalPosted`             | verified success or readback found               |
| `VerifyPost`                 | `TerminalReadyToPost`        | definite safe failure or readback absent         |
| `VerifyPost`                 | `TerminalBlocked`            | unsafe failure or indeterminate unverifiable     |
| `TerminalBlockedNotReviewed` | `[*]`                        | emit output contract                             |
| `TerminalDeferred`           | `[*]`                        | emit output contract                             |
| `TerminalBlocked`            | `[*]`                        | emit output contract                             |
| `TerminalDraft`              | `[*]`                        | emit output contract                             |
| `TerminalReadyToPost`        | `[*]`                        | emit output contract                             |
| `TerminalPosted`             | `[*]`                        | emit output contract                             |
| `TerminalAlreadyPosted`      | `[*]`                        | emit output contract                             |

## Terminal decisions (internal modes)

Exactly one of: `Blocked` (+ `Not reviewed` when pre-dispatch), `Deferred`, `Draft`, `Ready to post`, `Posted`, `Already posted`.
