# Repair Protocol

Load only after changed-file validation fails or conformance reports a repairable mismatch.

## Budget

`REPAIR_TOTAL` counts every repair attempt and every dispatch retry in the run. Maximum three. Increment immediately before each attempt. Never reset.

## Cause-First Routing

Failure causes are assigned by baseline diff.

| Cause | Route |
| ----- | ----- |
| `test refactor regression` | If budget remains, repair via `test-refactorer`, then re-enter conformance |
| `production bug exposed` | Ask dual authority when in scope; declined or out of scope returns `COMPLETE_PRODUCTION_BUG_EXPOSED` |
| `pre-existing failure` with changed files | Ask keep-or-revert when answer channel exists, then `VALIDATION_FAILED` with raw-log path, workspace state, and revert record |
| `empty-selection` | Repair command selection once if budget remains, else `VALIDATION_FAILED` |
| `unknown` retry plausible | One validation retry with the same guarded command if budget remains |
| `unknown` not retry plausible | `VALIDATION_FAILED` |
| Budget exhausted | `VALIDATION_FAILED`, or `COMPLETE_PRODUCTION_BUG_EXPOSED` when a production bug was identified |

## Repair Packets

Repair packets satisfy the receiving subagent's full input contract. Refactor repair packets include the approved plan, reports, authority records, `VALIDATION_FAILURE`, and `REPAIR_TOTAL`. Validator retry packets include validator inputs plus the confirmed guarded command.

## Re-Entry

Test-edit repairs re-enter conformance. Validation retries and command-selection fixes re-enter validation routing. Dispatch retries re-enter the exact dispatch that errored per the universal dispatch-retry rule; there is no other error-retry mechanism.
