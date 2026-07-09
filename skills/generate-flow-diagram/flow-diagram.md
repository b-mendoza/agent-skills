# Flow Diagram

Canonical execution model: finite state machine. Guards and terminals are
tabulated in [`state-machine.md`](./state-machine.md).

```mermaid
stateDiagram-v2
  [*] --> Intake

  Intake --> Classify: PROCESS_INPUTS ready
  Intake --> NeedsInput: missing contract-changing field
  Intake --> ValidateApprovedGaps: refinement resume with gap reply

  Classify --> BuildCandidate: RUN_MODE new or repair
  Classify --> RefinementPreflight: RUN_MODE refinement
  Classify --> DecomposeInputGate: RUN_MODE decompose
  Classify --> NeedsInput: no classification row

  RefinementPreflight --> BuildCandidate: PREFLIGHT PASS
  RefinementPreflight --> AwaitRefinementApproval: PREFLIGHT NEEDS_CONFIRMATION
  RefinementPreflight --> Blocked: PREFLIGHT BLOCKED
  RefinementPreflight --> Error: PREFLIGHT ERROR

  AwaitRefinementApproval --> NeedsConfirmation: inventory presented

  ValidateApprovedGaps --> BuildCandidate: IDs valid or none
  ValidateApprovedGaps --> AwaitRefinementApproval: unknown IDs and reask budget left
  ValidateApprovedGaps --> NeedsConfirmation: unknown IDs and reask exhausted

  BuildCandidate --> ReviewCandidate: BUILD PASS
  BuildCandidate --> NeedsInput: BUILD NEEDS_INPUT
  BuildCandidate --> Error: BUILD ERROR

  ReviewCandidate --> FinalPassed: REVIEW PASS and not decompose
  ReviewCandidate --> Blocked: REVIEW BLOCKED
  ReviewCandidate --> Error: REVIEW ERROR
  ReviewCandidate --> AwaitRepairApproval: FAIL under approval none
  ReviewCandidate --> PackageRepair: FAIL and repair_cycles under 3
  ReviewCandidate --> RepairLimitReached: FAIL and repair_cycles at 3

  PackageRepair --> BuildCandidate: failed checks packaged

  AwaitRepairApproval --> NeedsConfirmationRepair: repair question presented

  DecomposeInputGate --> NeedsInput: package or registry incomplete
  DecomposeInputGate --> NoChangesNeeded: empty registry confirmed
  DecomposeInputGate --> DeriveLimits: inputs complete

  DeriveLimits --> PlanDecompose: MUTATION_LIMITS derived

  PlanDecompose --> NeedsInput: PLAN NEEDS_INPUT
  PlanDecompose --> Blocked: PLAN BLOCKED
  PlanDecompose --> Error: PLAN ERROR
  PlanDecompose --> NoChangesNeeded: PLAN PASS and noop
  PlanDecompose --> AwaitDecomposeApproval: PLAN PASS and ask
  PlanDecompose --> StageCandidates: PLAN PASS and auto

  AwaitDecomposeApproval --> NeedsConfirmation: plan presented
  AwaitDecomposeApproval --> StageCandidates: user approved

  StageCandidates --> WriteBatch: every candidate REVIEW PASS
  StageCandidates --> RepairLimitReached: any candidate repair exhausted

  WriteBatch --> DecompositionComplete: WRITE PASS
  WriteBatch --> WriteError: WRITE ERROR

  FinalPassed --> [*]
  DecompositionComplete --> [*]
  NoChangesNeeded --> [*]
  NeedsConfirmation --> [*]
  NeedsConfirmationRepair --> [*]
  NeedsInput --> [*]
  Blocked --> [*]
  Error --> [*]
  WriteError --> [*]
  RepairLimitReached --> [*]
```

## Gate And Branch Summary

| Gate | Guard | Pass path | Stop / alternate |
| ---- | ----- | --------- | ---------------- |
| Contract-missing gate | Missing field changes authority, sensitive actions, outputs, evidence, confirmation, or terminals | `Classify` | `NeedsInput` |
| Classification gate | Precedence table row matches | Mode-specific state | `NeedsInput` |
| Refinement preflight | `PREFLIGHT: PASS` | `BuildCandidate` | Await confirmation, `Blocked`, or `Error` |
| Gap-ID validation | IDs ⊆ retained inventory or exact `none` | `BuildCandidate` | One re-ask then `NeedsConfirmation` |
| Build gate | `BUILD: PASS` | `ReviewCandidate` | `NeedsInput` or `Error` |
| Review gate | `REVIEW: PASS` | `FinalPassed` (non-decompose) | Repair, repair-under-`none`, `Blocked`, `Error`, or repair limit |
| Repair budget | `repair_cycles` < 3 | `PackageRepair` → `BuildCandidate` | `RepairLimitReached` |
| Repair-under-`none` | `approval_scope` is exact `none` and repair would change baseline | — | `NeedsConfirmationRepair` |
| Decompose input gate | Package path + non-empty registry | `DeriveLimits` | `NeedsInput` or `NoChangesNeeded` |
| Plan gate | `PLAN: PASS` and work remains | Await approval or `StageCandidates` if `auto` | No-op, `NeedsInput`, `Blocked`, `Error` |
| All-pass staging | Every staged candidate `REVIEW: PASS` | `WriteBatch` | `RepairLimitReached` (no writes) |
| Write gate | `WRITE: PASS` inside `MUTATION_LIMITS` | `DecompositionComplete` | `WriteError` |

## Terminal States

- Success: `FinalPassed`, `DecompositionComplete`, `NoChangesNeeded`
- Confirmation: `NeedsConfirmation`, `NeedsConfirmationRepair`
- Failure / stop: `NeedsInput`, `Blocked`, `Error`, `WriteError`, `RepairLimitReached`
