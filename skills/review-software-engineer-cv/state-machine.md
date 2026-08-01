# State Machine — review-software-engineer-cv

Finite-state execution model for this skill. Mermaid SoT: [`flow-diagram.md`](./flow-diagram.md). This table is the authoritative list of states, transitions, guards, and terminals.

## States

| State | Kind | Role |
| --- | --- | --- |
| `NormalizeMode` | active | Set `OUTPUT_MODE` to `review`, `rewrite`, `checklist`, or `questions-only`; default missing/unsupported to `review` |
| `GateRequiredInputs` | active | Require readable `JOB_POSTING` and `CV` |
| `AskRequiredSource` | active | Ask for the smallest missing required source |
| `DispatchIntake` | active | Dispatch `source-intake-analyst` |
| `RouteIntake` | active | Route on `SOURCE_INTAKE: PASS \| PARTIAL \| BLOCKED \| ERROR` |
| `GateEvidenceThreshold` | active | For `PARTIAL`, enforce mode minimum evidence from `cv-review-contract.md` |
| `AskEvidence` | active | Ask for the smallest missing source detail; do not silently switch modes |
| `DispatchRoleFit` | active | Dispatch `role-fit-mapper` with intake + ledgers |
| `RouteRoleFit` | active | Route on `ROLE_FIT: PASS \| PARTIAL \| ERROR` |
| `DispatchEditor` | active | Dispatch `cv-tailoring-editor` for the selected mode |
| `RouteEditor` | active | Route on `TAILORING_DRAFT: PASS \| PARTIAL \| ERROR` |
| `ClaimResolve` | active | Load `cv-review-contract.md`; resolve unsupported sensitive claims |
| `GateSafeDeliverable` | active | Continue only if a safe selected-mode deliverable remains |
| `DispatchReviewer` | active | Dispatch `cv-reviewer` |
| `RouteReview` | active | Route on `CV_REVIEW: PASS \| FAIL \| ERROR` |
| `GateFixBudget` | active | Allow editor redispatch only while `fix_cycles < 3` |
| `DispatchEditorFix` | active | Redispatch **only** `cv-tailoring-editor` with prior draft + `REVIEW_FIXES` |
| `RouteEditorFix` | active | Route fix-cycle `TAILORING_DRAFT` status |
| `Assemble` | active | Build selected-mode user output; strip internal status headers on success paths |
| `EmitFull` | active | Return full selected-mode output |
| `EmitPartial` | active | Return partial selected-mode output with labeled limitations |
| `TerminalBlockedMissingSource` | terminal | Missing/unreadable required source |
| `TerminalBlockedInsufficientEvidence` | terminal | Intake `BLOCKED` or mode threshold unmet |
| `TerminalBlockedIntegrityRisk` | terminal | Unsafe claims, exhausted fix budget, or privacy breach |
| `TerminalPhaseError` | terminal | Phase `ERROR` with smallest recovery action |
| `TerminalCompleteFull` | terminal | Full selected-mode output delivered |
| `TerminalCompletePartial` | terminal | Partial selected-mode output delivered |

## Status vocabulary by phase (intentional asymmetry)

| Phase handoff | Allowed statuses | Notes |
| --- | --- | --- |
| `SOURCE_INTAKE` | `PASS`, `PARTIAL`, `BLOCKED`, `ERROR` | Only intake uses `BLOCKED` |
| `ROLE_FIT` | `PASS`, `PARTIAL`, `ERROR` | No `BLOCKED` |
| `TAILORING_DRAFT` | `PASS`, `PARTIAL`, `ERROR` | No `BLOCKED` |
| `CV_REVIEW` | `PASS`, `FAIL`, `ERROR` | Only review uses `FAIL` (fix loop) |

Do not invent statuses absent from a phase. `ERROR` means inputs/tools are unusable for that phase — not “sources are thin but reviewable” (use `PARTIAL` / limitations / `FAIL` fixes instead).

## Transitions

| From | To | Guard / event |
| --- | --- | --- |
| `[*]` | `NormalizeMode` | run start |
| `NormalizeMode` | `GateRequiredInputs` | mode normalized |
| `GateRequiredInputs` | `AskRequiredSource` | `CV` or `JOB_POSTING` missing/unreadable |
| `GateRequiredInputs` | `DispatchIntake` | both required sources readable |
| `AskRequiredSource` | `TerminalBlockedMissingSource` | user asked; stop |
| `DispatchIntake` | `RouteIntake` | `SOURCE_INTAKE` returned |
| `RouteIntake` | `TerminalPhaseError` | `ERROR` |
| `RouteIntake` | `TerminalBlockedInsufficientEvidence` | `BLOCKED` |
| `RouteIntake` | `GateEvidenceThreshold` | `PASS` or `PARTIAL` (open/update ledgers) |
| `GateEvidenceThreshold` | `AskEvidence` | `PARTIAL` and mode threshold unmet |
| `GateEvidenceThreshold` | `DispatchRoleFit` | `PASS`, or `PARTIAL` and threshold met |
| `AskEvidence` | `TerminalBlockedInsufficientEvidence` | user asked; stop |
| `DispatchRoleFit` | `RouteRoleFit` | `ROLE_FIT` returned |
| `RouteRoleFit` | `TerminalPhaseError` | `ERROR` |
| `RouteRoleFit` | `DispatchEditor` | `PASS` or `PARTIAL` (record fit; update limitations) |
| `DispatchEditor` | `RouteEditor` | `TAILORING_DRAFT` returned |
| `RouteEditor` | `TerminalPhaseError` | `ERROR` |
| `RouteEditor` | `ClaimResolve` | `PASS` or `PARTIAL` |
| `ClaimResolve` | `GateSafeDeliverable` | claims supported, weakened, excluded, or questioned per contract |
| `GateSafeDeliverable` | `TerminalBlockedIntegrityRisk` | no safe selected-mode deliverable |
| `GateSafeDeliverable` | `DispatchReviewer` | safe deliverable remains |
| `DispatchReviewer` | `RouteReview` | `CV_REVIEW` returned |
| `RouteReview` | `TerminalPhaseError` | `ERROR` |
| `RouteReview` | `Assemble` | `PASS` |
| `RouteReview` | `GateFixBudget` | `FAIL` |
| `GateFixBudget` | `TerminalBlockedIntegrityRisk` | `fix_cycles >= 3` |
| `GateFixBudget` | `DispatchEditorFix` | `fix_cycles < 3` (increment counter) |
| `DispatchEditorFix` | `RouteEditorFix` | fix-cycle draft returned |
| `RouteEditorFix` | `TerminalPhaseError` | `ERROR` |
| `RouteEditorFix` | `ClaimResolve` | `PASS` or `PARTIAL` (re-enter claim gate before review) |
| `Assemble` | `EmitPartial` | `LIMITATIONS_LEDGER` non-empty |
| `Assemble` | `EmitFull` | `LIMITATIONS_LEDGER` empty |
| `Assemble` | `TerminalBlockedIntegrityRisk` | privacy breach detected |
| `EmitFull` | `TerminalCompleteFull` | mode output returned |
| `EmitPartial` | `TerminalCompletePartial` | partial mode output returned |
| `TerminalBlockedMissingSource` | `[*]` | handoff complete |
| `TerminalBlockedInsufficientEvidence` | `[*]` | handoff complete |
| `TerminalBlockedIntegrityRisk` | `[*]` | handoff complete |
| `TerminalPhaseError` | `[*]` | handoff complete |
| `TerminalCompleteFull` | `[*]` | handoff complete |
| `TerminalCompletePartial` | `[*]` | handoff complete |

### Continuous privacy transitions

From any state that performed external I/O (`DispatchIntake`, `DispatchEditor`, `DispatchEditorFix`, `Assemble`, or any subagent fetch), if private candidate or draft material was submitted externally → `TerminalBlockedIntegrityRisk`.

## Terminal outcomes

| Terminal | User-facing meaning |
| --- | --- |
| `TerminalCompleteFull` | Full selected-mode report |
| `TerminalCompletePartial` | Partial selected-mode report with labeled limitations |
| `TerminalBlockedMissingSource` | Need readable `CV` and/or `JOB_POSTING` |
| `TerminalBlockedInsufficientEvidence` | Need smallest missing detail for the mode |
| `TerminalBlockedIntegrityRisk` | Unsafe claims, three failed fix cycles, or privacy breach |
| `TerminalPhaseError` | Unexpected phase failure + recovery hint |

## Reachability and dead-state checks

| Property | Result |
| --- | --- |
| Every active state reachable from `NormalizeMode` | yes |
| Every terminal reachable | yes |
| Dead states (no outgoing, non-terminal) | none |
| Fix loop bounded | yes — `fix_cycles` max 3 before `TerminalBlockedIntegrityRisk` |
| FAIL path re-enters `ClaimResolve` | yes — via `RouteEditorFix` |
