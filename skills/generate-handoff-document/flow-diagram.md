# Generate Handoff Document Flow Diagram

Canonical execution model: finite state machine. Guards, variables, and terminals are tabulated in [`state-machine.md`](./state-machine.md); this diagram is illustrative and defers to that table on any mismatch.

```mermaid
stateDiagram-v2
  [*] --> Intake

  Intake --> AskTarget: TARGET_FILE unclear
  Intake --> PathSafety: TARGET_FILE clear

  AskTarget --> PathSafety: path resolved
  AskTarget --> BlockedUnclearTarget: unresolvable or abandoned

  PathSafety --> AskUpdateMode: exists and UPDATE_MODE absent
  PathSafety --> DeriveContracts: safe and mode known or new target
  PathSafety --> BlockedUnsafePath: criterion failed

  AskUpdateMode --> AskTarget: new path
  AskUpdateMode --> DeriveContracts: overwrite or update
  AskUpdateMode --> BlockedUnclearTarget: abandoned

  DeriveContracts --> MaterializeSource: siblings and absolute refs ready

  MaterializeSource --> ExternalDecide: TRANSCRIPT_FILE faithful
  MaterializeSource --> AskTranscript: snapshot not faithful

  AskTranscript --> MaterializeSource: file supplied
  AskTranscript --> BlockedNoSource: abandoned

  ExternalDecide --> ExtractContext: SKIPPED or USED or optional UNAVAILABLE
  ExternalDecide --> BlockedExternal: required unreachable

  ExtractContext --> DocumentInsights: verified PASS or WARN
  ExtractContext --> BlockedStage: stage error after retry
  ExtractContext --> BlockedArtifact: verify failed twice

  DocumentInsights --> AskEmptySession: empty session gate
  DocumentInsights --> ValidateClaims: tracking files present
  DocumentInsights --> SkipClaims: no tracking files
  DocumentInsights --> BlockedStage: stage error after retry
  DocumentInsights --> BlockedArtifact: verify failed twice

  AskEmptySession --> ValidateClaims: continue with tracking
  AskEmptySession --> SkipClaims: continue without tracking
  AskEmptySession --> CompletedDeclinedEmpty: decline or abandon

  ValidateClaims --> AssembleHandoff: verified PASS or WARN
  ValidateClaims --> BlockedStage: stage error after retry
  ValidateClaims --> BlockedArtifact: verify failed twice

  SkipClaims --> AssembleHandoff: CLAIMS SKIPPED recorded

  AssembleHandoff --> ReviewHandoff: verified PASS or WARN
  AssembleHandoff --> BlockedStage: stage error after retry
  AssembleHandoff --> BlockedArtifact: verify failed twice

  ReviewHandoff --> CompletedReviewPass: REVIEW PASS
  ReviewHandoff --> CompletedReviewWarn: REVIEW WARN
  ReviewHandoff --> PlanRepair: REVIEW FAIL and repair_cycles under 3
  ReviewHandoff --> BlockedRepairExhausted: REVIEW FAIL and repair_cycles at least 3
  ReviewHandoff --> BlockedStage: REVIEW ERROR after retry

  PlanRepair --> ExtractContext: earliest context
  PlanRepair --> DocumentInsights: earliest insights
  PlanRepair --> ValidateClaims: earliest claims with tracking
  PlanRepair --> SkipClaims: earliest claims without tracking
  PlanRepair --> AssembleHandoff: earliest assembly or default
  PlanRepair --> ReviewHandoff: review only

  CompletedReviewPass --> [*]
  CompletedReviewWarn --> [*]
  CompletedDeclinedEmpty --> [*]
  BlockedUnclearTarget --> [*]
  BlockedNoSource --> [*]
  BlockedUnsafePath --> [*]
  BlockedExternal --> [*]
  BlockedStage --> [*]
  BlockedArtifact --> [*]
  BlockedRepairExhausted --> [*]
```

## Terminal outcomes

| State                    | Outcome in prose                                               |
| ------------------------ | ---------------------------------------------------------- |
| `CompletedReviewPass`    | `The handoff passed review.`                                   |
| `CompletedReviewWarn`    | `The handoff passed review with warnings.`                     |
| `CompletedDeclinedEmpty` | `No handoff was written because the empty-session handoff was declined.`              |
| `BlockedUnclearTarget`   | `A clear target path is needed before writing the handoff.`                             |
| `BlockedNoSource`        | `A usable source transcript is needed before writing the handoff.`                     |
| `BlockedUnsafePath`      | `The handoff was not written because the path is unsafe or inaccessible.` |
| `BlockedExternal`        | `The handoff cannot proceed because a required external dependency is unavailable.`        |
| `BlockedStage`           | `The handoff cannot proceed because a stage failed or was unexpectedly skipped.`     |
| `BlockedArtifact`        | `The handoff cannot proceed because an artifact failed its contract.`                     |
| `BlockedRepairExhausted` | `The handoff still fails review after the repair limit.`                          |
