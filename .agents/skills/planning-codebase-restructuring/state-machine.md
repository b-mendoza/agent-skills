# State Machine — planning-codebase-restructuring

Finite-state execution model for this skill and the sole normative source for states, transitions, guards, counters, and terminals. Per-state actions are in [`SKILL.md`](./SKILL.md) Execution.

## Counters and named guards

| Name                        | Rule                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `review_repair_count`       | Starts at `0`. On each `PLAN_REVIEW: FAIL`, increment by 1, then if `review_repair_count > 2` enter `TerminalBlocked`; otherwise enter `ReviewRepair`. Allows at most two FAIL→repair cycles (counts `1` and `2`). |
| `per_phase_contract_repair` | Each required phase may re-dispatch once for summary-contract failure on a `PASS` summary; second contract failure → `TerminalBlocked`.                                                                            |
| Reference accessibility     | Inaccessible, unparseable, unverifiable, or unfetchable reference → `BLOCKED` from `ReferenceAssess`, never `PASS`, and never enters `ReferenceRepair`.                                                            |
| Optional reference degrade  | When `REFERENCE_REQUIRED=false`, reference `BLOCKED`/`ERROR` or exhausted optional contract failure → continue at `ArchitectureMap` with a recorded limitation.                                                    |
| Required reference stop     | When `REFERENCE_REQUIRED=true`, those failures → `TerminalBlocked` or `TerminalError`.                                                                                                                             |
| Resume                      | Valid packet restores state and continues at `phase_reached` (named next active state). Invalid packet → discard and enter `Preflight`.                                                                            |

## Transitions

| From                 | To                        | Guard / event                                                                                                 |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `[*]`                | `ResumeCheck`             | run start                                                                                                     |
| `ResumeCheck`        | `ResumeValidate`          | `RESUME_PACKET` supplied                                                                                      |
| `ResumeCheck`        | `Preflight`               | no packet                                                                                                     |
| `ResumeValidate`     | _(restored active state)_ | packet valid; jump to `phase_reached` |
| `ResumeValidate`     | `Preflight`               | packet malformed or retained summary fails contract                                                           |
| `Preflight`          | `TerminalNeedsInput`      | required inputs missing and not safely inferable                                                              |
| `Preflight`          | `ReferenceGate`           | preflight summary stated; inputs ready                                                                        |
| `ReferenceGate`      | `ArchitectureMap`         | no `REFERENCE_URL` (orchestrator records `REFERENCE_ASSESSMENT: SKIPPED`)                                     |
| `ReferenceGate`      | `ReferenceAssess`         | `REFERENCE_URL` present                                                                                       |
| `ReferenceAssess`    | `ReferenceContract`       | `REFERENCE_ASSESSMENT: PASS`                                                                                  |
| `ReferenceAssess`    | `TerminalNeedsInput`      | `NEEDS_INPUT`                                                                                                 |
| `ReferenceAssess`    | `ArchitectureMap`         | `BLOCKED` or `ERROR` and `REFERENCE_REQUIRED=false`                                                           |
| `ReferenceAssess`    | `TerminalBlocked`         | accessibility/`BLOCKED` and `REFERENCE_REQUIRED=true`                                                         |
| `ReferenceAssess`    | `TerminalError`           | `ERROR` and `REFERENCE_REQUIRED=true`                                                                         |
| `ReferenceContract`  | `QuarantineHold`          | summary contract pass                                                                                         |
| `ReferenceContract`  | `ReferenceRepair`         | contract fail and phase repair unused                                                                         |
| `ReferenceContract`  | `ArchitectureMap`         | contract repair exhausted and `REFERENCE_REQUIRED=false`                                                      |
| `ReferenceContract`  | `TerminalBlocked`         | contract repair exhausted and `REFERENCE_REQUIRED=true`                                                       |
| `ReferenceRepair`    | `ReferenceAssess`         | re-dispatch with `REPAIR_FINDINGS`                                                                            |
| `QuarantineHold`     | `ArchitectureMap`         | reference held; not passed to map/domain                                                                      |
| `ArchitectureMap`    | `MapContract`             | `ARCHITECTURE_MAP: PASS`                                                                                      |
| `ArchitectureMap`    | `TerminalNeedsInput`      | `NEEDS_INPUT`                                                                                                 |
| `ArchitectureMap`    | `TerminalBlocked`         | `BLOCKED`                                                                                                     |
| `ArchitectureMap`    | `TerminalError`           | `ERROR`                                                                                                       |
| `MapContract`        | `DomainAnalysis`          | contract pass                                                                                                 |
| `MapContract`        | `MapRepair`               | contract fail and phase repair unused                                                                         |
| `MapContract`        | `TerminalBlocked`         | contract repair exhausted                                                                                     |
| `MapRepair`          | `ArchitectureMap`         | re-dispatch with `REPAIR_FINDINGS`                                                                            |
| `DomainAnalysis`     | `DomainContract`          | `DOMAIN_ANALYSIS: PASS`                                                                                       |
| `DomainAnalysis`     | `TerminalNeedsInput`      | `NEEDS_INPUT`                                                                                                 |
| `DomainAnalysis`     | `TerminalBlocked`         | `BLOCKED`                                                                                                     |
| `DomainAnalysis`     | `TerminalError`           | `ERROR`                                                                                                       |
| `DomainContract`     | `EvidencePrecedence`      | contract pass                                                                                                 |
| `DomainContract`     | `DomainRepair`            | contract fail and phase repair unused                                                                         |
| `DomainContract`     | `TerminalBlocked`         | contract repair exhausted                                                                                     |
| `DomainRepair`       | `DomainAnalysis`          | re-dispatch with `REPAIR_FINDINGS`                                                                            |
| `EvidencePrecedence` | `RestructuringPlan`       | decision recorded (`not-applicable`, `reference-authorized`, or `limitations-only`)                           |
| `RestructuringPlan`  | `PlanContract`            | `RESTRUCTURING_PLAN: PASS`                                                                                    |
| `RestructuringPlan`  | `TerminalNeedsInput`      | `NEEDS_INPUT`                                                                                                 |
| `RestructuringPlan`  | `TerminalBlocked`         | `BLOCKED`                                                                                                     |
| `RestructuringPlan`  | `TerminalError`           | `ERROR`                                                                                                       |
| `PlanContract`       | `CandidateReport`         | contract pass                                                                                                 |
| `PlanContract`       | `PlanRepair`              | contract fail and phase repair unused                                                                         |
| `PlanContract`       | `TerminalBlocked`         | contract repair exhausted                                                                                     |
| `PlanRepair`         | `RestructuringPlan`       | re-dispatch with `REPAIR_FINDINGS`                                                                            |
| `CandidateReport`    | `PlanReview`              | candidate synthesized                                                                                         |
| `PlanReview`         | `Finalize`                | `PLAN_REVIEW: PASS`                                                                                           |
| `PlanReview`         | `ReviewRepair`            | `FAIL` and after increment `review_repair_count <= 2`                                                         |
| `PlanReview`         | `TerminalBlocked`         | `FAIL` and after increment `review_repair_count > 2`                                                          |
| `PlanReview`         | `TerminalBlocked`         | `BLOCKED`                                                                                                     |
| `PlanReview`         | `TerminalError`           | `ERROR`                                                                                                       |
| `ReviewRepair`       | `CandidateReport`         | subagent summary repaired and contract-valid (re-synthesize)                                                  |
| `ReviewRepair`       | `PlanReview`              | named candidate-report section revised from validated summaries                                               |
| `ReviewRepair`       | `TerminalNeedsInput`      | repair owner returns `NEEDS_INPUT`                                                                            |
| `ReviewRepair`       | `TerminalBlocked`         | repair owner `BLOCKED` or repaired summary still fails contract                                               |
| `ReviewRepair`       | `TerminalError`           | repair owner `ERROR`                                                                                          |
| `Finalize`           | `TerminalReady`           | report written to `ARTIFACT_PATH`                                                                             |
| `TerminalReady`      | `[*]`                     | emit compact chat summary                                                                                     |
| `TerminalNeedsInput` | `[*]`                     | emit stopping payload + `RESUME_PACKET`                                                                       |
| `TerminalBlocked`    | `[*]`                     | emit stopping payload                                                                                         |
| `TerminalError`      | `[*]`                     | emit stopping payload                                                                                         |

## Terminal decisions

Select exactly one internal decision: `READY`, `NEEDS_INPUT`, `BLOCKED`, `ERROR`. User-facing summaries and stopping explanations use prose, not a status line or routing envelope. Preserve the required fenced resume packet on `NEEDS_INPUT`.
