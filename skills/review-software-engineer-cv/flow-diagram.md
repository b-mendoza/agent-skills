# Review Software Engineer CV — Flow

Finite-state control flow for this skill. Companion transition table:
[`state-machine.md`](./state-machine.md). Load both at run start with
`SKILL.md`.

Privacy is a **continuous invariant**: never submit CV text, applicant context,
contact details, private job text, or drafts to external scanners, forms, or
analysis tools. A detected breach transitions to `TerminalBlockedIntegrityRisk`
from any state that performed external I/O.

```mermaid
stateDiagram-v2
  [*] --> NormalizeMode

  NormalizeMode --> GateRequiredInputs: OUTPUT_MODE normalized

  GateRequiredInputs --> AskRequiredSource: CV or JOB_POSTING missing or unreadable
  GateRequiredInputs --> DispatchIntake: both required sources readable

  AskRequiredSource --> TerminalBlockedMissingSource: asked and stop

  DispatchIntake --> RouteIntake: SOURCE_INTAKE returned

  RouteIntake --> TerminalPhaseError: ERROR
  RouteIntake --> TerminalBlockedInsufficientEvidence: BLOCKED
  RouteIntake --> GateEvidenceThreshold: PASS or PARTIAL

  GateEvidenceThreshold --> AskEvidence: PARTIAL and mode threshold unmet
  GateEvidenceThreshold --> DispatchRoleFit: PASS, or PARTIAL and threshold met

  AskEvidence --> TerminalBlockedInsufficientEvidence: asked and stop

  DispatchRoleFit --> RouteRoleFit: ROLE_FIT returned

  RouteRoleFit --> TerminalPhaseError: ERROR
  RouteRoleFit --> DispatchEditor: PASS or PARTIAL

  DispatchEditor --> RouteEditor: TAILORING_DRAFT returned

  RouteEditor --> TerminalPhaseError: ERROR
  RouteEditor --> ClaimResolve: PASS or PARTIAL

  ClaimResolve --> GateSafeDeliverable: sensitive claims resolved via contract

  GateSafeDeliverable --> TerminalBlockedIntegrityRisk: no safe selected-mode deliverable
  GateSafeDeliverable --> DispatchReviewer: safe deliverable remains

  DispatchReviewer --> RouteReview: CV_REVIEW returned

  RouteReview --> TerminalPhaseError: ERROR
  RouteReview --> Assemble: PASS
  RouteReview --> GateFixBudget: FAIL

  GateFixBudget --> TerminalBlockedIntegrityRisk: fix_cycles >= 3
  GateFixBudget --> DispatchEditorFix: fix_cycles < 3

  DispatchEditorFix --> RouteEditorFix: TAILORING_DRAFT returned

  RouteEditorFix --> TerminalPhaseError: ERROR
  RouteEditorFix --> ClaimResolve: PASS or PARTIAL

  Assemble --> EmitPartial: LIMITATIONS_LEDGER non-empty
  Assemble --> EmitFull: LIMITATIONS_LEDGER empty
  Assemble --> TerminalBlockedIntegrityRisk: privacy breach detected

  EmitFull --> TerminalCompleteFull: selected-mode output returned
  EmitPartial --> TerminalCompletePartial: partial selected-mode output returned

  TerminalBlockedMissingSource --> [*]
  TerminalBlockedInsufficientEvidence --> [*]
  TerminalBlockedIntegrityRisk --> [*]
  TerminalPhaseError --> [*]
  TerminalCompleteFull --> [*]
  TerminalCompletePartial --> [*]
```

## Canonical rules

- Status vocabularies are **phase-asymmetric** by design; see `state-machine.md`
  and `references/cv-review-contract.md`. Do not invent missing statuses.
- Review `FAIL` redispatches **only** `cv-tailoring-editor`, then re-enters
  `ClaimResolve` before `DispatchReviewer`. Cap: three fix cycles.
- `ClaimResolve` requires `references/cv-review-contract.md` loaded.
- Completion: full output, partial output with labeled limitations, or an
  explicit blocked/error terminal — never a silent incomplete review.
