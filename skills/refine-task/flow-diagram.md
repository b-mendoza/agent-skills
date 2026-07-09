# Refine Task Flow Diagram

Finite-state execution model for `refine-task`. Companion transition table:
[`state-machine.md`](./state-machine.md). Summary — normative text for
definitions, gates, states, boundaries, and posting lives in
[`./references/reviewer-policy.md`](./references/reviewer-policy.md).

```mermaid
stateDiagram-v2
  [*] --> Intake

  Intake --> GateSource: inputs captured
  GateSource --> AskSource: no ITEM_URL or ITEM_CONTEXT
  GateSource --> GateMutation: source pointer exists
  AskSource --> Intake: answered interactive
  AskSource --> TerminalBlockedNotReviewed: unattended or unanswered

  GateMutation --> TerminalDeferred: mutation-only
  GateMutation --> ResolveTooling: review or mixed

  ResolveTooling --> GatePlatform: read path recorded
  GatePlatform --> GateReadPath: Jira or GitHub
  GatePlatform --> GatePostingClarity: unsupported with usable context
  GatePlatform --> AskPlatform: unsupported without context
  AskPlatform --> Intake: answered interactive
  AskPlatform --> TerminalBlockedNotReviewed: unattended or unanswered

  GateReadPath --> AskRead: no read path and no usable context
  GateReadPath --> GatePostingClarity: read path or usable context
  AskRead --> ResolveTooling: answered interactive
  AskRead --> TerminalBlockedNotReviewed: unattended or unanswered

  GatePostingClarity --> AskPosting: post-comment and auth or tooling unclear
  GatePostingClarity --> DispatchReviewer: posting clear or not requested
  AskPosting --> GatePostingClarity: answered interactive
  AskPosting --> DispatchReviewer: unattended downgrade to draft

  DispatchReviewer --> ParseReturn: reviewer returned
  ParseReturn --> Redispatch: missing or unknown REVIEW first time
  ParseReturn --> RouteReview: known REVIEW state
  Redispatch --> DispatchReviewer: one re-dispatch with defect note
  ParseReturn --> RouteReview: second malformed as REVIEW ERROR

  RouteReview --> TerminalBlocked: REVIEW BLOCKED or ERROR
  RouteReview --> TerminalDraft: REVIEW FAIL
  RouteReview --> ChooseOutputPath: REVIEW PASS

  ChooseOutputPath --> TerminalReadyToPost: draft or unknown and Comment mode Ready to post
  ChooseOutputPath --> TerminalDraft: draft or unknown and Comment mode Draft
  ChooseOutputPath --> GatePostPreconditions: WRITE_MODE post-comment

  GatePostPreconditions --> TerminalReadyToPost: preconditions fail and comment ready
  GatePostPreconditions --> TerminalDraft: preconditions fail and comment draft
  GatePostPreconditions --> PreviewGate: all six posting preconditions true

  PreviewGate --> TerminalDraft: preview declined
  PreviewGate --> TerminalReadyToPost: preview unattended
  PreviewGate --> IdempotencyCheck: preview confirmed or pre-approved quoted

  IdempotencyCheck --> TerminalAlreadyPosted: matching comment exists
  IdempotencyCheck --> AttemptPost: idempotency clean

  AttemptPost --> VerifyPost: one exact post attempted
  VerifyPost --> TerminalPosted: verified success or readback found
  VerifyPost --> TerminalReadyToPost: definite safe failure or readback absent
  VerifyPost --> TerminalBlocked: unsafe failure or indeterminate unverifiable

  TerminalBlockedNotReviewed --> [*]
  TerminalDeferred --> [*]
  TerminalBlocked --> [*]
  TerminalDraft --> [*]
  TerminalReadyToPost --> [*]
  TerminalPosted --> [*]
  TerminalAlreadyPosted --> [*]
```

## Invariants

- Every terminal output includes `Mode`, `Status`, `Comment`,
  `Deferred actions`, and `Run notes`.
- The reviewer is dispatched once, plus at most one re-dispatch for a named
  malformed return.
- No path posts without explicit posting intent, confirmed write tooling,
  `REVIEW: PASS`, `POST_ALLOWED: yes`, preview or quoted pre-approval, and a
  clean idempotency check.
- `Status` is the reviewer `REVIEW_STATUS` verbatim after dispatch;
  `Not reviewed` is used only before dispatch.
