# Workflow Examples

Load this file for the plan approval card skeleton or a failure cleanup example.

## Plan Approval Card

All user decisions — steps, waivers, non-`safe` commands, conflicts, unanalyzed dimensions — are batched into this single card.

```text
Plan approval required before mutation.

Diagnosis (from chunk analysis):
- D1 [duplication-reuse]: roundMoney in calculate.ts duplicates
  src/shared/money.ts:roundCurrency.
- D2 [complexity-idiom]: calculateInvoice nests discount rules three levels
  deep inside formatting orchestration.

Ordered steps:
- S1: Delete local roundMoney; reuse src/shared/money.ts:roundCurrency;
  traces to D1; reuse rung: reuse-repo.
- S2: Extract private discount helper with guard clauses; traces to D2;
  reuse rung: new-code (smallest form).

Files to change or create:
- Change: src/invoice/calculate.ts
- Create: none
(Adding any file not listed here later requires re-approval.)

Expected outcome:
- Net lines: about -18
- Duplication removed: 1 helper; introduced: none

Size plan:
- src/invoice/calculate.ts: 214/250, within limit

Batched decisions requiring your approval:
- Size waivers: none
- Non-safe commands: none
- Unanalyzed dimensions: none

Validation contract:
- npm test -- invoice
- Safety class: safe

Non-goals:
- Preserve all protected surfaces per `references/protected-surfaces.md`.

Decision: approve, adjust, or decline.
```

## Failure Cleanup Block

```text
Worktree state after stop:
- src/invoice/calculate.ts: edited-from-clean. Refactor-only file; safe manual
  revert option: git checkout -- src/invoice/calculate.ts
- src/invoice/config.ts: edited-over-pre-existing. Manual review required before
  reverting because user changes existed at baseline.

The workflow never auto-reverts. It reports scoped guidance so the user can
choose the recovery action.
```
