# State Machine — review-software-engineer-cv

Finite-state execution model for this skill and the sole source of truth for states, transitions, guards, and terminals.

Actions not implied by state names: `NormalizeMode` defaults a missing or unsupported `OUTPUT_MODE` to `review`; `AskRequiredSource` and `AskEvidence` ask for the smallest missing source or detail and never silently switch modes; `DispatchRoleFit` passes intake plus ledgers; `ClaimResolve` requires `references/cv-review-contract.md` loaded; `DispatchEditorFix` redispatches **only** `cv-tailoring-editor` with the prior draft plus `REVIEW_FIXES`; `Assemble` builds the selected-mode user output and strips internal status headers.

## Status vocabulary by phase (intentional asymmetry)

| Phase handoff     | Allowed statuses                      | Notes                              |
| ----------------- | ------------------------------------- | ---------------------------------- |
| `SOURCE_INTAKE`   | `PASS`, `PARTIAL`, `BLOCKED`, `ERROR` | Only intake uses `BLOCKED`         |
| `ROLE_FIT`        | `PASS`, `PARTIAL`, `ERROR`            | No `BLOCKED`                       |
| `TAILORING_DRAFT` | `PASS`, `PARTIAL`, `ERROR`            | No `BLOCKED`                       |
| `CV_REVIEW`       | `PASS`, `FAIL`, `ERROR`               | Only review uses `FAIL` (fix loop) |

Do not invent statuses absent from a phase. `ERROR` means inputs/tools are unusable for that phase — not “sources are thin but reviewable” (use `PARTIAL` / limitations / `FAIL` fixes instead).

## Transitions

| From                                  | To                                    | Guard / event                                                    |
| ------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `[*]`                                 | `NormalizeMode`                       | run start                                                        |
| `NormalizeMode`                       | `GateRequiredInputs`                  | mode normalized                                                  |
| `GateRequiredInputs`                  | `AskRequiredSource`                   | `CV` or `JOB_POSTING` missing/unreadable                         |
| `GateRequiredInputs`                  | `DispatchIntake`                      | both required sources readable                                   |
| `AskRequiredSource`                   | `TerminalBlockedMissingSource`        | user asked; stop                                                 |
| `DispatchIntake`                      | `RouteIntake`                         | `SOURCE_INTAKE` returned                                         |
| `RouteIntake`                         | `TerminalPhaseError`                  | `ERROR`                                                          |
| `RouteIntake`                         | `TerminalBlockedInsufficientEvidence` | `BLOCKED`                                                        |
| `RouteIntake`                         | `GateEvidenceThreshold`               | `PASS` or `PARTIAL` (open/update ledgers)                        |
| `GateEvidenceThreshold`               | `AskEvidence`                         | `PARTIAL` and mode threshold unmet                               |
| `GateEvidenceThreshold`               | `DispatchRoleFit`                     | `PASS`, or `PARTIAL` and threshold met                           |
| `AskEvidence`                         | `TerminalBlockedInsufficientEvidence` | user asked; stop                                                 |
| `DispatchRoleFit`                     | `RouteRoleFit`                        | `ROLE_FIT` returned                                              |
| `RouteRoleFit`                        | `TerminalPhaseError`                  | `ERROR`                                                          |
| `RouteRoleFit`                        | `DispatchEditor`                      | `PASS` or `PARTIAL` (record fit; update limitations)             |
| `DispatchEditor`                      | `RouteEditor`                         | `TAILORING_DRAFT` returned                                       |
| `RouteEditor`                         | `TerminalPhaseError`                  | `ERROR`                                                          |
| `RouteEditor`                         | `ClaimResolve`                        | `PASS` or `PARTIAL`                                              |
| `ClaimResolve`                        | `GateSafeDeliverable`                 | claims supported, weakened, excluded, or questioned per contract |
| `GateSafeDeliverable`                 | `TerminalBlockedIntegrityRisk`        | no safe selected-mode deliverable                                |
| `GateSafeDeliverable`                 | `DispatchReviewer`                    | safe deliverable remains                                         |
| `DispatchReviewer`                    | `RouteReview`                         | `CV_REVIEW` returned                                             |
| `RouteReview`                         | `TerminalPhaseError`                  | `ERROR`                                                          |
| `RouteReview`                         | `Assemble`                            | `PASS`                                                           |
| `RouteReview`                         | `GateFixBudget`                       | `FAIL`                                                           |
| `GateFixBudget`                       | `TerminalBlockedIntegrityRisk`        | `fix_cycles >= 3`                                                |
| `GateFixBudget`                       | `DispatchEditorFix`                   | `fix_cycles < 3` (increment counter)                             |
| `DispatchEditorFix`                   | `RouteEditorFix`                      | fix-cycle draft returned                                         |
| `RouteEditorFix`                      | `TerminalPhaseError`                  | `ERROR`                                                          |
| `RouteEditorFix`                      | `ClaimResolve`                        | `PASS` or `PARTIAL` (re-enter claim gate before review)          |
| `Assemble`                            | `EmitPartial`                         | `LIMITATIONS_LEDGER` non-empty                                   |
| `Assemble`                            | `EmitFull`                            | `LIMITATIONS_LEDGER` empty                                       |
| `Assemble`                            | `TerminalBlockedIntegrityRisk`        | privacy breach detected                                          |
| `EmitFull`                            | `TerminalCompleteFull`                | mode output returned                                             |
| `EmitPartial`                         | `TerminalCompletePartial`             | partial mode output returned                                     |
| `TerminalBlockedMissingSource`        | `[*]`                                 | handoff complete                                                 |
| `TerminalBlockedInsufficientEvidence` | `[*]`                                 | handoff complete                                                 |
| `TerminalBlockedIntegrityRisk`        | `[*]`                                 | handoff complete                                                 |
| `TerminalPhaseError`                  | `[*]`                                 | handoff complete                                                 |
| `TerminalCompleteFull`                | `[*]`                                 | handoff complete                                                 |
| `TerminalCompletePartial`             | `[*]`                                 | handoff complete                                                 |

### Continuous privacy transitions

From any state that performed external I/O (`DispatchIntake`, `DispatchEditor`, `DispatchEditorFix`, `Assemble`, or any subagent fetch), if private candidate or draft material was submitted externally → `TerminalBlockedIntegrityRisk`.

## Terminal outcomes

| Terminal                              | User-facing meaning                                       |
| ------------------------------------- | --------------------------------------------------------- |
| `TerminalCompleteFull`                | Full selected-mode report                                 |
| `TerminalCompletePartial`             | Partial selected-mode report with labeled limitations     |
| `TerminalBlockedMissingSource`        | Need readable `CV` and/or `JOB_POSTING`                   |
| `TerminalBlockedInsufficientEvidence` | Need smallest missing detail for the mode                 |
| `TerminalBlockedIntegrityRisk`        | Unsafe claims, three failed fix cycles, or privacy breach |
| `TerminalPhaseError`                  | Unexpected phase failure + recovery hint                  |

Terminal names and phase statuses above are internal routing values. On blocked/error outcomes, tell the user what prevented the review and what input or recovery action is needed in prose; never print a machine-readable status line.
