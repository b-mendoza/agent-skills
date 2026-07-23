# Generate Handoff Document Flow Diagram

Canonical execution model: finite state machine. Guards, variables, and
terminals are tabulated in [`state-machine.md`](./state-machine.md); this
diagram is illustrative and defers to that table on any mismatch.

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

## Terminal Strings

| State | Exact string |
| ----- | ------------ |
| `CompletedReviewPass` | `Completed: review pass` |
| `CompletedReviewWarn` | `Completed: review pass with warnings` |
| `CompletedDeclinedEmpty` | `Completed: handoff declined (empty session)` |
| `BlockedUnclearTarget` | `Blocked: unclear target path` |
| `BlockedNoSource` | `Blocked: no usable source transcript` |
| `BlockedUnsafePath` | `Blocked: unsafe writes or missing readable/writable path` |
| `BlockedExternal` | `Blocked: required external dependency unavailable` |
| `BlockedStage` | `Blocked: subagent error, failure, or unexpected skip` |
| `BlockedArtifact` | `Blocked: artifact contract violation` |
| `BlockedRepairExhausted` | `Blocked: repair limit exhausted` |
